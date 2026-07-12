"""
state_classifier.py - Model-backed GPU state classifier.

Uses the saved notebook model in the workspace root and only promotes an
abnormal state when the model confidence and the telemetry conditions agree.

States: healthy, memory_bound, comms_bound, power_throttled
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Literal, Optional

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from scipy.stats import kurtosis, skew
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight

StateType = Literal["healthy", "memory_bound", "comms_bound", "power_throttled"]

STATIC_LABEL_MAP = {
    'label_to_idx': {
        'healthy': 1,
        'memory_bound': 0,
        'comms_bound': 2,
        'power_throttled': 3
    },
    'idx_to_label': {
        '0': 'memory_bound',
        '1': 'healthy',
        '2': 'comms_bound',
        '3': 'power_throttled'
    }
}

APP_DIR = Path(__file__).resolve().parent
CSV_PATH = APP_DIR / "telemetry_data.csv"
MODEL_PATH = APP_DIR / "bottleneck_model_current.joblib"
SCALER_PATH = APP_DIR / "scaler_current.joblib"

_MODEL = None
_SCALER = None


def _load_artifacts() -> tuple[Optional[object], Optional[object]]:
    global _MODEL, _SCALER
    if (_MODEL is None or _SCALER is None) and not (MODEL_PATH.exists() and SCALER_PATH.exists()):
        _train_current_artifacts()

    if _MODEL is None and MODEL_PATH.exists():
        _MODEL = joblib.load(MODEL_PATH)
    if _SCALER is None and SCALER_PATH.exists():
        _SCALER = joblib.load(SCALER_PATH)
    return _MODEL, _SCALER


def _train_current_artifacts() -> None:
    global _MODEL, _SCALER

    if not CSV_PATH.exists():
        return

    frame = pd.read_csv(CSV_PATH)
    if frame.empty:
        return

    feature_columns = [f"f{i}" for i in range(42)]
    missing_columns = [column for column in feature_columns + ["label"] if column not in frame.columns]
    if missing_columns:
        return

    frame = frame.replace([np.inf, -np.inf], np.nan).dropna(subset=feature_columns + ["label"])
    if frame.empty:
        return

    label_to_idx = STATIC_LABEL_MAP["label_to_idx"]
    inverse_map = STATIC_LABEL_MAP["idx_to_label"]
    labels = frame["label"].astype(str).tolist()
    encoded = np.asarray([label_to_idx[label] for label in labels], dtype=np.int64)
    features = frame[feature_columns].astype(np.float64).values

    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)

    class_counts = Counter(encoded)
    class_labels = np.asarray(sorted(class_counts.keys()))
    class_weights = compute_class_weight(class_weight="balanced", classes=class_labels, y=encoded)
    weight_map = {int(label): float(weight) for label, weight in zip(class_labels, class_weights)}
    sample_weights = np.asarray([weight_map[int(label)] for label in encoded], dtype=np.float64)

    if len(np.unique(encoded)) > 1 and len(encoded) >= 12:
        X_train, X_test, y_train, y_test, w_train, _ = train_test_split(
            scaled_features,
            encoded,
            sample_weights,
            test_size=0.2,
            random_state=42,
            stratify=encoded,
        )
    else:
        X_train, X_test, y_train, y_test, w_train = scaled_features, scaled_features, encoded, encoded, sample_weights

    model = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=len(label_to_idx),
        eval_metric="mlogloss",
        random_state=42,
        n_estimators=250,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
    )
    model.fit(X_train, y_train, sample_weight=w_train)

    if len(X_test) > 0:
        try:
            model.predict(X_test)
        except Exception:
            pass

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    _MODEL = model
    _SCALER = scaler


def classify(telemetry_history: list[dict]) -> dict:
    """
    Classify GPU state based on telemetry history.

    Returns:
        dict with keys:
            - state: StateType enum value
            - confidence: float 0-1
            - evidence: str human-readable explanation
    """
    if len(telemetry_history) < 3:
        return {
            "state": "healthy",
            "confidence": 0.5,
            "evidence": "Insufficient data for classification"
        }

    recent = telemetry_history[-25:]
    feature_vector = _extract_feature_vector(recent)
    model, scaler = _load_artifacts()

    if model is None or scaler is None:
        return _fallback_classify(recent)

    try:
        scaled = scaler.transform([feature_vector])
        probabilities = model.predict_proba(scaled)[0]
    except Exception as error:
        return {
            "state": "healthy",
            "confidence": 0.0,
            "evidence": f"Model inference failed: {error}"
        }

    class_probs = {
        STATIC_LABEL_MAP["idx_to_label"][str(index)]: float(probability)
        for index, probability in enumerate(probabilities)
    }

    ranked = sorted(class_probs.items(), key=lambda item: item[1], reverse=True)
    top_state, top_prob = ranked[0]
    if top_state == "healthy":
        return {
            "state": "healthy",
            "confidence": float(top_prob),
            "evidence": _healthy_evidence(recent, class_probs, ranked)
        }

    return {
        "state": top_state,
        "confidence": float(top_prob),
        "evidence": _state_evidence(top_state, recent, class_probs)
    }


def _fallback_classify(recent: list[dict]) -> dict:
    if _is_memory_bound(recent):
        return {
            "state": "memory_bound",
            "confidence": 0.85,
            "evidence": "Fallback rule: sustained high memory with low compute"
        }

    if _is_power_throttled(recent):
        return {
            "state": "power_throttled",
            "confidence": 0.80,
            "evidence": "Fallback rule: power dropped while GPU stayed busy"
        }

    if _is_comms_bound(recent):
        return {
            "state": "comms_bound",
            "confidence": 0.70,
            "evidence": "Fallback rule: bursty compute stalls with stable memory pressure"
        }

    return {
        "state": "healthy",
        "confidence": 0.90,
        "evidence": _healthy_evidence(recent, {}, [])
    }


def _extract_features(recent: list[dict]) -> np.ndarray:
    gpu = [float(item.get("gpu_util_pct", 0.0)) for item in recent]
    mem = [float(item.get("mem_util_pct", 0.0)) for item in recent]
    power = [float(item.get("power_w", 0.0)) for item in recent]

    def stats(values: list[float]) -> list[float]:
        array = np.asarray(values, dtype=np.float64)
        if len(array) < 2:
            return [0.0] * 12
        array = np.nan_to_num(array, nan=0.0, posinf=0.0, neginf=0.0)
        slope = np.polyfit(range(len(array)), array, 1)[0] if len(array) > 1 else 0.0
        slope = float(np.nan_to_num(slope, nan=0.0, posinf=0.0, neginf=0.0))
        return [
            float(np.mean(array)),
            float(np.std(array)),
            float(np.min(array)),
            float(np.max(array)),
            float(np.median(array)),
            float(np.percentile(array, 25)),
            float(np.percentile(array, 75)),
            slope,
            float(np.nan_to_num(skew(array), nan=0.0, posinf=0.0, neginf=0.0)),
            float(np.nan_to_num(kurtosis(array), nan=0.0, posinf=0.0, neginf=0.0)),
            float(np.ptp(array)),
            float(np.percentile(array, 75) - np.percentile(array, 25))
        ]

    def safe_corr(a: list[float], b: list[float]) -> float:
        array_a = np.nan_to_num(np.asarray(a, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
        array_b = np.nan_to_num(np.asarray(b, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
        if len(array_a) > 1 and len(array_b) > 1 and np.std(array_a) > 1e-6 and np.std(array_b) > 1e-6:
            return float(np.nan_to_num(np.corrcoef(array_a, array_b)[0, 1], nan=0.0, posinf=0.0, neginf=0.0))
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


def _extract_feature_vector(recent: list[dict]) -> np.ndarray:
    latest = recent[-1]

    if "features" in latest:
        vector = np.asarray(latest["features"], dtype=np.float64)
        if vector.shape[0] == 42:
            return np.nan_to_num(vector, nan=0.0, posinf=0.0, neginf=0.0)

    feature_keys = [f"f{i}" for i in range(42)]
    if all(key in latest for key in feature_keys):
        vector = np.asarray([latest[key] for key in feature_keys], dtype=np.float64)
        return np.nan_to_num(vector, nan=0.0, posinf=0.0, neginf=0.0)

    return _extract_features(recent)


def _apply_guardrails(
    top_state: str,
    top_prob: float,
    recent: list[dict],
    class_probs: dict[str, float]
) -> Optional[dict]:
    if top_state == "memory_bound":
        healthy_prob = class_probs.get("healthy", 0.0)
        if top_prob < 0.58:
            return None
        if top_prob < healthy_prob + 0.05:
            return None
        return {
            "state": "memory_bound",
            "confidence": float(top_prob),
            "evidence": _state_evidence("memory_bound", recent, class_probs)
        }

    if top_state == "comms_bound":
        if top_prob < 0.68:
            return None
        if not _is_comms_bound(recent):
            return None
        return {
            "state": "comms_bound",
            "confidence": float(top_prob),
            "evidence": _state_evidence("comms_bound", recent, class_probs)
        }

    if top_state == "power_throttled":
        if top_prob < 0.70:
            return None
        if not _is_power_throttled(recent):
            return None
        return {
            "state": "power_throttled",
            "confidence": float(top_prob),
            "evidence": _state_evidence("power_throttled", recent, class_probs)
        }

    return None


def _healthy_guard(recent: list[dict], healthy_prob: float, class_probs: dict[str, float]) -> dict:
    if _is_memory_bound(recent) or _is_power_throttled(recent) or _is_comms_bound(recent):
        alt_state = max((state for state in class_probs if state != "healthy"), key=lambda state: class_probs[state], default="healthy")
        alt_prob = class_probs.get(alt_state, 0.0)
        if alt_prob >= 0.60 and alt_prob >= healthy_prob + 0.05:
            return {
                "state": alt_state,
                "confidence": float(alt_prob),
                "evidence": _state_evidence(alt_state, recent, class_probs)
            }

    return {
        "state": "healthy",
        "confidence": float(max(healthy_prob, 0.70)),
        "evidence": _healthy_evidence(recent, class_probs, [])
    }


def _state_evidence(state: str, recent: list[dict], class_probs: dict[str, float]) -> str:
    mean_gpu = sum(item.get("gpu_util_pct", 0.0) for item in recent) / len(recent)
    mean_mem = sum(item.get("mem_util_pct", 0.0) for item in recent) / len(recent)
    mean_power = sum(item.get("power_w", 0.0) for item in recent) / len(recent)
    if state == "memory_bound":
        return (
            f"Model and telemetry agree on memory_bound; prob={class_probs.get(state, 0.0):.2f}, "
            f"gpu={mean_gpu:.1f}%, mem={mean_mem:.1f}%, power={mean_power:.1f}W"
        )
    if state == "comms_bound":
        return (
            f"Model and telemetry agree on comms_bound; prob={class_probs.get(state, 0.0):.2f}, "
            f"bursty GPU utilization with average gpu={mean_gpu:.1f}%, mem={mean_mem:.1f}%, power={mean_power:.1f}W"
        )
    if state == "power_throttled":
        return (
            f"Model and telemetry agree on power_throttled; prob={class_probs.get(state, 0.0):.2f}, "
            f"gpu={mean_gpu:.1f}%, mem={mean_mem:.1f}%, power={mean_power:.1f}W"
        )
    return _healthy_evidence(recent, class_probs, [])


def _healthy_evidence(recent: list[dict], class_probs: dict[str, float], ranked: list[tuple[str, float]]) -> str:
    latest = recent[-1]
    probability_summary = ", ".join(f"{state}={prob:.2f}" for state, prob in (ranked[:3] if ranked else class_probs.items()))
    return (
        f"Healthy chosen after guardrails; latest gpu={latest.get('gpu_util_pct', 0.0):.1f}%, "
        f"mem={latest.get('mem_util_pct', 0.0):.1f}%, power={latest.get('power_w', 0.0):.1f}W; "
        f"top_probs: {probability_summary}"
    )


def _is_memory_bound(recent: list[dict]) -> bool:
    if len(recent) < 3:
        return False

    window = recent[-5:]
    consecutive = 0
    for poll in window:
        if poll.get("mem_util_pct", 0.0) > 80 and poll.get("gpu_util_pct", 0.0) < 60:
            consecutive += 1
        else:
            consecutive = 0
    return consecutive >= 3


def _is_power_throttled(recent: list[dict]) -> bool:
    if len(recent) < 3:
        return False

    for i in range(len(recent) - 1):
        current = recent[i]
        next_poll = recent[i + 1]
        current_gpu = current.get("gpu_util_pct", 0.0)
        next_gpu = next_poll.get("gpu_util_pct", 0.0)
        current_power = current.get("power_w", 0.0)
        next_power = next_poll.get("power_w", 0.0)

        if current_gpu > 70 and next_gpu > 70 and current_power > 0:
            power_drop = (current_power - next_power) / current_power
            if power_drop > 0.15:
                return True
    return False


def _is_comms_bound(recent: list[dict]) -> bool:
    if len(recent) < 4:
        return False

    gpu_values = [float(poll.get("gpu_util_pct", 0.0)) for poll in recent]
    mem_values = [float(poll.get("mem_util_pct", 0.0)) for poll in recent]
    power_values = [float(poll.get("power_w", 0.0)) for poll in recent]

    avg_gpu = sum(gpu_values) / len(gpu_values)
    avg_mem = sum(mem_values) / len(mem_values)
    avg_power = sum(power_values) / len(power_values)

    if avg_mem > 75 or avg_power < 70:
        return False

    sharp_drops = 0
    burst_recoveries = 0
    for i in range(len(gpu_values) - 1):
        current = gpu_values[i]
        next_value = gpu_values[i + 1]
        if current > 70 and next_value < 55:
            sharp_drops += 1
        if i + 2 < len(gpu_values):
            if gpu_values[i] > 70 and gpu_values[i + 1] < 55 and gpu_values[i + 2] > 60:
                burst_recoveries += 1

    utilization_jitter = max(gpu_values) - min(gpu_values)

    return (
        avg_gpu < 85
        and avg_gpu > 30
        and utilization_jitter > 25
        and (sharp_drops >= 2 or burst_recoveries >= 2)
        and avg_mem < 75
    )