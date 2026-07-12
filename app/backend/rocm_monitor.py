"""
rocm_monitor.py - Live AMD GPU telemetry via rocm-smi.
"""

import subprocess
import re
import time
from typing import Optional


def is_rocm_available() -> bool:
    """Check if rocm-smi is installed and a GPU is reachable."""
    try:
        subprocess.run(["rocm-smi", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        return False


def poll_gpu() -> dict:
    """
    Poll the first AMD GPU for:
      - GPU utilization (%)
      - Memory utilization (%)
      - Power consumption (W)
    Returns a dict with these keys plus a timestamp.
    """
    try:
        # rocm-smi command to get stats for GPU 0
        # We parse lines like:
        # GPU[0]	: 85%  (utilization)
        # GPU[0]	: 4.5 GB / 16 GB  (memory)
        # GPU[0]	: 120.0 W  (power)
        output = subprocess.check_output(
            ["rocm-smi", "--showuse", "--showmemuse", "--showpower"],
            text=True,
            stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError as e:
        # If rocm-smi fails, return zeros (or raise an exception)
        print(f"[rocm_monitor] rocm-smi error: {e}")
        return _zero_telemetry()

    # Parse output
    gpu_util = 0.0
    mem_util = 0.0
    power = 0.0

    for line in output.splitlines():
        # Example: "GPU[0]          : 85%"
        if "GPU[0]" in line and "%" in line and "W" not in line and "GB" not in line:
            match = re.search(r"(\d+)%", line)
            if match:
                gpu_util = float(match.group(1))
        # Memory line: "GPU[0]          : 4.5 GB / 16 GB"
        if "GPU[0]" in line and "GB" in line and "/" in line:
            match = re.search(r"([\d.]+)\s*GB\s*/\s*([\d.]+)\s*GB", line)
            if match:
                used = float(match.group(1))
                total = float(match.group(2))
                if total > 0:
                    mem_util = (used / total) * 100.0
        # Power line: "GPU[0]          : 120.0 W"
        if "GPU[0]" in line and "W" in line:
            match = re.search(r"([\d.]+)\s*W", line)
            if match:
                power = float(match.group(1))

    # If we got zeros unexpectedly, maybe parsing failed; fallback to zeros
    if gpu_util == 0.0 and mem_util == 0.0 and power == 0.0:
        print("[rocm_monitor] Warning: All metrics zero – rocm-smi output may have changed.")
        # You can raise an exception here if you prefer
        # return _zero_telemetry() 

    return {
        "gpu_util_pct": gpu_util,
        "mem_util_pct": mem_util,
        "power_w": power,
        "timestamp": time.time()
    }


def _zero_telemetry() -> dict:
    """Return zeroed telemetry (safe fallback)."""
    return {
        "gpu_util_pct": 0.0,
        "mem_util_pct": 0.0,
        "power_w": 0.0,
        "timestamp": time.time()
    }


def get_memory_bandwidth_pressure(history: list[dict]) -> float:
    """
    Calculate a memory pressure score (0‑100) from the last 10 samples.
    This is the same heuristic as before – it doesn't require live ROCm.
    """
    if len(history) < 3:
        return 0.0

    recent = history[-10:]
    avg_gpu = sum(p.get("gpu_util_pct", 0.0) for p in recent) / len(recent)
    avg_mem = sum(p.get("mem_util_pct", 0.0) for p in recent) / len(recent)
    gpu_trend = recent[-1]["gpu_util_pct"] - recent[0]["gpu_util_pct"] if len(recent) >= 3 else 0

    base = avg_mem * 0.4
    bonus = min(50, abs(gpu_trend) * 0.8) if gpu_trend < -10 and avg_mem > 60 else 0
    starve = min(30, (70 - avg_gpu) * 0.5) if avg_gpu < 50 and avg_mem > 70 else 0
    return round(min(100, base + bonus + starve), 1)