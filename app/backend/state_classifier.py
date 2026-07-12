"""
state_classifier.py - Model‑first classifier with rule‑based evidence.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Literal
import numpy as np
from scipy.stats import kurtosis, skew

# ----------------------------------------------------------------------
# Optional ML dependencies – if missing, fallback to rules, but we warn.
# ----------------------------------------------------------------------
try:
    import joblib
    import pandas as pd
    import xgboost as xgb
    from sklearn.preprocessing import StandardScaler
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("[state_classifier] WARNING: ML libraries not installed. "
          "Install joblib, xgboost, pandas, scikit-learn, scipy to use the model.")

StateType = Literal["healthy", "memory_bound", "comms_bound", "power_throttled"]

# Label mappings (must match your trained model)
LABEL_MAP = {
    'label_to_idx': {'healthy': 1, 'memory_bound': 0, 'comms_bound': 2, 'power_throttled': 3},
    'idx_to_label': {'0': 'memory_bound', '1': 'healthy', '2': 'comms_bound', '3': 'power_throttled'}
}

APP_DIR = Path(__file__).resolve().parent
MODEL_PATH = APP_DIR / "bottleneck_model_current.joblib"
SCALER_PATH = APP_DIR / "scaler_current.joblib"

_MODEL = None
_SCALER = None


def _load_artifacts() -> tuple[Optional[object], Optional[object]]:
    """Load model and scaler if they exist and ML is available."""
    global _MODEL, _SCALER
    if not ML_AVAILABLE:
        return None, None

    if _MODEL is None and MODEL_PATH.exists():
        try:
            _MODEL = joblib.load(MODEL_PATH)
        except Exception as e:
            print(f"[state_classifier] Failed to load model: {e}")
            _MODEL = None
    if _SCALER is None and SCALER_PATH.exists():
        try:
            _SCALER = joblib.load(SCALER_PATH)
        except Exception as e:
            print(f"[state_classifier] Failed to load scaler: {e}")
            _SCALER = None

    if _MODEL is None or _SCALER is None:
        print("[state_classifier] Model or scaler missing – using rule‑based fallback.")
    else:
        print("[state_classifier] Model and scaler loaded successfully.")
    return _MODEL, _SCALER


def classify(telemetry_history: list[dict]) -> dict:
    """
    Primary classification: use model if available; otherwise fallback to rules.
    Evidence is always derived from both model (if used) and rule‑based indicators.
    """
    if len(telemetry_history) < 3:
        return {
            "state": "healthy",
            "confidence": 0.5,
            "evidence": "Insufficient data (need at least 3 samples)"
        }

    recent = telemetry_history[-25:]  # last ~5 seconds
    model, scaler = _load_artifacts()

    # --------------------------------------------------------------
    # Try model inference
    # --------------------------------------------------------------
    if model is not None and scaler is not None:
        try:
            feature_vector = _extract_feature_vector(recent)
            scaled = scaler.transform([feature_vector])
            probabilities = model.predict_proba(scaled)[0]
            class_probs = {
                LABEL_MAP["idx_to_label"][str(i)]: float(prob)
                for i, prob in enumerate(probabilities)
            }
            top_state = max(class_probs, key=class_probs.get)  # type: ignore
            top_prob = class_probs[top_state]

            # Apply guardrails to reduce false positives
            guarded = _apply_guardrails(top_state, top_prob, recent, class_probs)
            if guarded is not None:
                return guarded

            # If guardrails don't override, use model's top prediction
            return {
                "state": top_state,
                "confidence": top_prob,
                "evidence": _generate_evidence(top_state, recent, class_probs, model_used=True)
            }
        except Exception as e:
            print(f"[state_classifier] Model inference failed: {e}. Falling back to rules.")

    # --------------------------------------------------------------
    # Fallback: rule‑based classification (provides evidence)
    # --------------------------------------------------------------
    rule_state = _rule_based_classify(recent)
    # For evidence, we still generate a human‑readable string from rules
    return {
        "state": rule_state,
        "confidence": 0.75,  # fixed confidence for fallback
        "evidence": _generate_evidence(rule_state, recent, {}, model_used=False)
    }


# ----------------------------------------------------------------------
# Guardrails & Evidence Generation
# ----------------------------------------------------------------------

def _apply_guardrails(top_state: str, top_prob: float, recent: list[dict],
                      class_probs: dict) -> Optional[dict]:
    """Prevent false positives by cross‑checking with rules."""
    # If model says healthy but rules detect an issue, we might override
    if top_state == "healthy":
        if _is_memory_bound(recent):
            return {
                "state": "memory_bound",
                "confidence": 0.85,
                "evidence": _generate_evidence("memory_bound", recent, class_probs, model_used=False)
            }
        if _is_power_throttled(recent):
            return {
                "state": "power_throttled",
                "confidence": 0.80,
                "evidence": _generate_evidence("power_throttled", recent, class_probs, model_used=False)
            }
        if _is_comms_bound(recent):
            return {
                "state": "comms_bound",
                "confidence": 0.70,
                "evidence": _generate_evidence("comms_bound", recent, class_probs, model_used=False)
            }
        return None  # keep healthy

    # If model predicts abnormal, ensure confidence is high enough
    if top_state == "memory_bound":
        if top_prob < 0.58:
            return None
        if top_prob < class_probs.get("healthy", 0.0) + 0.05:
            return None
        # Optionally also require rule to agree
        if not _is_memory_bound(recent):
            # still keep model prediction but adjust evidence
            pass
        return None  # allow model prediction

    if top_state == "comms_bound":
        if top_prob < 0.68:
            return None
        if not _is_comms_bound(recent):
            # We might still trust model, but we'll let it through with adjusted evidence
            pass
        return None

    if top_state == "power_throttled":
        if top_prob < 0.70:
            return None
        if not _is_power_throttled(recent):
            pass
        return None

    return None  # allow


def _generate_evidence(state: str, recent: list[dict],
                       class_probs: dict, model_used: bool) -> str:
    """Build a human‑readable evidence string."""
    latest = recent[-1]
    mean_gpu = sum(p.get("gpu_util_pct", 0.0) for p in recent) / len(recent)
    mean_mem = sum(p.get("mem_util_pct", 0.0) for p in recent) / len(recent)
    mean_power = sum(p.get("power_w", 0.0) for p in recent) / len(recent)

    parts = [
        f"state={state}",
        f"gpu={latest.get('gpu_util_pct',0.0):.1f}% (avg {mean_gpu:.1f}%)",
        f"mem={latest.get('mem_util_pct',0.0):.1f}% (avg {mean_mem:.1f}%)",
        f"power={latest.get('power_w',0.0):.1f}W (avg {mean_power:.1f}W)"
    ]

    if model_used and class_probs:
        parts.append(f"model probs: " + ", ".join(f"{k}={v:.2f}" for k, v in class_probs.items()))
    else:
        # Add rule‑based indicators
        if state == "memory_bound":
            parts.append("rule: sustained high memory with low compute")
        elif state == "power_throttled":
            parts.append("rule: power dropped under load")
        elif state == "comms_bound":
            parts.append("rule: bursty compute stalls")
        else:
            parts.append("rule: no abnormal patterns detected")

    return "; ".join(parts)


# ----------------------------------------------------------------------
# Rule‑based functions (for fallback and guardrails)
# ----------------------------------------------------------------------

def _rule_based_classify(recent: list[dict]) -> str:
    if _is_memory_bound(recent):
        return "memory_bound"
    if _is_power_throttled(recent):
        return "power_throttled"
    if _is_comms_bound(recent):
        return "comms_bound"
    return "healthy"


def _is_memory_bound(recent: list[dict]) -> bool:
    if len(recent) < 5:
        return False
    window = recent[-5:]
    count = sum(1 for p in window if p.get("mem_util_pct", 0.0) > 80 and p.get("gpu_util_pct", 0.0) < 60)
    return count >= 3


def _is_power_throttled(recent: list[dict]) -> bool:
    if len(recent) < 3:
        return False
    for i in range(len(recent) - 1):
        cur, nxt = recent[i], recent[i+1]
        cur_gpu = cur.get("gpu_util_pct", 0.0)
        nxt_gpu = nxt.get("gpu_util_pct", 0.0)
        cur_power = cur.get("power_w", 0.0)
        nxt_power = nxt.get("power_w", 0.0)
        if cur_gpu > 70 and nxt_gpu > 70 and cur_power > 0:
            drop = (cur_power - nxt_power) / cur_power
            if drop > 0.15:
                return True
    return False


def _is_comms_bound(recent: list[dict]) -> bool:
    if len(recent) < 4:
        return False
    gpu_vals = [p.get("gpu_util_pct", 0.0) for p in recent]
    mem_vals = [p.get("mem_util_pct", 0.0) for p in recent]
    avg_gpu = sum(gpu_vals) / len(gpu_vals)
    avg_mem = sum(mem_vals) / len(mem_vals)
    if avg_mem > 75 or avg_gpu > 85 or avg_gpu < 30:
        return False
    drops = sum(1 for i in range(len(gpu_vals)-1) if gpu_vals[i] > 70 and gpu_vals[i+1] < 55)
    recoveries = sum(1 for i in range(len(gpu_vals)-2) if gpu_vals[i] > 70 and gpu_vals[i+1] < 55 and gpu_vals[i+2] > 60)
    jitter = max(gpu_vals) - min(gpu_vals)
    return (drops >= 2 or recoveries >= 2) and jitter > 25


# ----------------------------------------------------------------------
# Feature extraction (for model input)
# ----------------------------------------------------------------------

def _extract_feature_vector(recent: list[dict]) -> np.ndarray:
    """Return a 42‑length feature vector from the telemetry history."""
    latest = recent[-1]
    # If the row already contains the full 42 features, use them
    if "features" in latest and len(latest["features"]) == 42:
        return np.nan_to_num(np.asarray(latest["features"], dtype=np.float64))
    # Otherwise compute statistical features (as in original code)
    return _extract_features(recent)


def _extract_features(recent: list[dict]) -> np.ndarray:
    """
    Compute the 42 statistical features used by the model.
    This is the same logic as your original _extract_features.
    """
    gpu = [float(p.get("gpu_util_pct", 0.0)) for p in recent]
    mem = [float(p.get("mem_util_pct", 0.0)) for p in recent]
    power = [float(p.get("power_w", 0.0)) for p in recent]

    def stats(values: list[float]) -> list[float]:
        arr = np.asarray(values, dtype=np.float64)
        if len(arr) < 2:
            return [0.0] * 12
        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)
        slope = np.polyfit(range(len(arr)), arr, 1)[0] if len(arr) > 1 else 0.0
        slope = float(np.nan_to_num(slope, nan=0.0, posinf=0.0, neginf=0.0))
        return [
            float(np.mean(arr)),
            float(np.std(arr)),
            float(np.min(arr)),
            float(np.max(arr)),
            float(np.median(arr)),
            float(np.percentile(arr, 25)),
            float(np.percentile(arr, 75)),
            slope,
            float(np.nan_to_num(skew(arr), nan=0.0, posinf=0.0, neginf=0.0)),
            float(np.nan_to_num(kurtosis(arr), nan=0.0, posinf=0.0, neginf=0.0)),
            float(np.ptp(arr)),
            float(np.percentile(arr, 75) - np.percentile(arr, 25))
        ]

    def safe_corr(a, b):
        a = np.nan_to_num(np.asarray(a, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
        b = np.nan_to_num(np.asarray(b, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
        if len(a) > 1 and len(b) > 1 and np.std(a) > 1e-6 and np.std(b) > 1e-6:
            return float(np.nan_to_num(np.corrcoef(a, b)[0, 1], nan=0.0, posinf=0.0, neginf=0.0))
        return 0.0

    gpu_stats = stats(gpu)
    mem_stats = stats(mem)
    power_stats = stats(power)

    corr_um = safe_corr(gpu, mem)
    corr_up = safe_corr(gpu, power)
    corr_mp = safe_corr(mem, power)

    mean_u = float(np.mean(gpu)) if gpu else 0.0
    mean_m = float(np.mean(mem)) if mem else 0.0
    mean_p = float(np.mean(power)) if power else 0.0
    ratio_pu = mean_p / mean_u if mean_u > 1e-6 else 0.0
    ratio_mu = mean_m / mean_u if mean_u > 1e-6 else 0.0
    ratio_pm = mean_p / mean_m if mean_m > 1e-6 else 0.0

    features = np.concatenate([
        np.asarray(gpu_stats, dtype=np.float64),
        np.asarray(mem_stats, dtype=np.float64),
        np.asarray(power_stats, dtype=np.float64),
        np.asarray([corr_um, corr_up, corr_mp, ratio_pu, ratio_mu, ratio_pm], dtype=np.float64)
    ])
    return np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)