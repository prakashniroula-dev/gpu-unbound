"""
rocm_monitor.py - Telemetry replay monitor.

Replays saved telemetry rows from telemetry_data.csv so the backend can run
without live GPU hardware while still producing model-shaped input.
"""

from __future__ import annotations

import csv
import os
import time
from collections import defaultdict
from pathlib import Path

CSV_PATH = Path(__file__).resolve().parent / "telemetry_data.csv"

MOCK_MODE = os.environ.get("ROCM_MOCK", "0") == "1"

_replay_rows: list[dict] | None = None
_rows_by_label: dict[str, list[dict]] | None = None
_replay_index = 0
_label_indices: dict[str, int] = defaultdict(int)
_active_injection_label: str | None = None


def _load_replay_rows() -> list[dict]:
    global _replay_rows, _rows_by_label
    if _replay_rows is not None:
        return _replay_rows

    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Telemetry replay file not found: {CSV_PATH}")

    rows: list[dict] = []
    rows_by_label: dict[str, list[dict]] = defaultdict(list)
    with CSV_PATH.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for raw_row in reader:
            features = [float(raw_row[f"f{i}"]) for i in range(42)]
            label = raw_row.get("label", "healthy")
            row = {
                **{f"f{i}": features[i] for i in range(42)},
                "features": features,
                "label": label,
                "gpu_util_pct": float(features[0]),
                "mem_util_pct": float(features[12]),
                "power_w": float(features[24]),
                "timestamp": time.time(),
                "source": "telemetry_data.csv"
            }
            rows.append(row)
            rows_by_label[label].append(row)

    if not rows:
        raise RuntimeError(f"No telemetry rows found in {CSV_PATH}")

    _replay_rows = rows
    _rows_by_label = rows_by_label
    return rows


def set_injection_state(label: str | None) -> None:
    global _active_injection_label, _label_indices
    if label is None:
        _active_injection_label = None
        return

    rows = _load_replay_rows()
    if label not in _rows_by_label or not _rows_by_label[label]:
        raise ValueError(f"Unknown injection label: {label}")

    _active_injection_label = label
    _label_indices[label] = 0


def clear_injection_state() -> None:
    set_injection_state(None)


def get_injection_state() -> str | None:
    return _active_injection_label


def poll_gpu() -> dict:
    """
    Return the next saved telemetry row, cycling through telemetry_data.csv.
    """
    global _replay_index, _label_indices

    rows = _load_replay_rows()
    active_label = _active_injection_label
    if active_label:
        label_rows = _rows_by_label.get(active_label, []) if _rows_by_label else []
        if label_rows:
            row = label_rows[_label_indices[active_label] % len(label_rows)].copy()
            _label_indices[active_label] = (_label_indices[active_label] + 1) % len(label_rows)
        else:
            row = rows[_replay_index % len(rows)].copy()
    else:
        row = rows[_replay_index % len(rows)].copy()

    row["timestamp"] = time.time()
    row["row_index"] = _replay_index % len(rows)
    _replay_index = (_replay_index + 1) % len(rows)
    row["injection_state"] = active_label or row.get("label", "healthy")
    return row


def get_memory_bandwidth_pressure(history: list[dict]) -> float:
    """
    Calculate memory pressure score (0-100) based on telemetry history.
    
    Memory-bound signature: gpu_util dropping WHILE mem_util stays high.
    This indicates compute is idle while memory is busy (starved).
    
    Args:
        history: List of telemetry dicts from poll_gpu(), most recent last
        
    Returns:
        Memory pressure score from 0 (no pressure) to 100 (extreme pressure)
    """
    if len(history) < 3:
        return 0.0
    
    recent = history[-10:]
    
    avg_gpu_util = sum(p["gpu_util_pct"] for p in recent) / len(recent)
    avg_mem_util = sum(p["mem_util_pct"] for p in recent) / len(recent)
    
    if len(recent) >= 3:
        gpu_trend = recent[-1]["gpu_util_pct"] - recent[0]["gpu_util_pct"]
    else:
        gpu_trend = 0
    
    base_pressure = avg_mem_util * 0.4
    
    if gpu_trend < -10 and avg_mem_util > 60:
        pressure_bonus = min(50, abs(gpu_trend) * 0.8)
    else:
        pressure_bonus = 0
    
    if avg_gpu_util < 50 and avg_mem_util > 70:
        starve_bonus = min(30, (70 - avg_gpu_util) * 0.5)
    else:
        starve_bonus = 0
    
    total_pressure = min(100, base_pressure + pressure_bonus + starve_bonus)
    
    return round(total_pressure, 1)