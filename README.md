Here is the revised **GPU Unbound** README, now without emojis.

---

# GPU Unbound

*Real-time GPU health, sonified, diagnosed, and fixed — before anyone looks at a screen.*

[AMD-ROCm] [Python-3.10+] [Next.js-14] [Status-Prototype]

Built by **Team Magnum Opus** for the AMD Developer Hackathon: ACT II, Unicorn Track.

---

## Table of Contents
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Why AMD?](#why-amd)
- [Tech Stack](#tech-stack)
- [Safety & Guardrails](#safety--guardrails)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Team Magnum Opus](#team-magnum-opus)
- [Closing](#closing)

---

## The Problem

Training runs fail quietly. A memory bottleneck can stall a job for hours while the utilization graph looks perfectly fine — because most dashboards show that *something* is wrong, not *why*. 

GPU compute is typically the largest line item in an AI team's infrastructure budget, so every silent stall is wasted money. Monitoring today demands constant visual attention that nobody has to spare, and utilization dashboards rarely explain the root cause of what they flag. By the time an engineer spots the issue, the job has already lost hours of progress.

---

## The Solution

**GPU Unbound** turns live AMD ROCm telemetry into real-time, audible intelligence.

- A **healthy** training run hums steadily.
- A **memory bottleneck** makes the tone rise and jitter.
- A **communication stall** produces arrhythmic clicks.
- A **power throttle** flattens and distorts the tone.

An AI agent continuously classifies the telemetry, selects a fix from a small pre-validated action menu, applies it, and logs the full **detect -> diagnose -> act -> verify** sequence to an auditable root-cause timeline. Engineers can now "hear" their infrastructure's health while focusing on higher-value work — and the system fixes many issues before anyone even glances at a dashboard.

---

## Why AMD?

Most tools show a utilization number going up and down. **GPU Unbound** reads:

- **`rocm-smi`** for real-time system vitals (power, temperature, memory usage, utilization)
- **`rocprof`** for kernel-level tracing and performance counters

This dual-layer telemetry lets us distinguish **compute-bound**, **memory-bound**, and **communications-bound** states apart — not just flag that something looks off. AMD's open ROCm ecosystem gives us the low-level access required to diagnose with surgical precision.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend / AI Agent** | Python 3.10+ — ingests ROCm telemetry, runs classification models, orchestrates actions |
| **Frontend / Dashboard** | Next.js 14 — renders the live sonification UI, real-time logs, and audit timeline |
| **Real-time Communication** | WebSockets (Socket.IO / native) — streams audio waveforms and telemetry events from Python to Next.js |
| **Audio Synthesis** | Web Audio API (browser) + Python (PyAudio / simple tone generation) — hybrid client/server sonification |
| **Telemetry Collection** | Subprocess wrappers around `rocm-smi` and `rocprof` in Python |
| **AI Classifier** | Lightweight scikit-learn / ONNX model — trained to classify bottleneck types from telemetry patterns |
| **Logging & Audit** | Structured JSON logs (Python) + Next.js timeline UI for full traceability |

The **Python** backend handles all hardware interaction, AI inference, and action execution. The **Next.js** frontend provides a responsive dashboard, audio playback controls, and a searchable audit log — but the magic is that the audio alone tells you everything you need, so you rarely need to look at it.

---

## Safety & Guardrails

> **The AI never writes or edits code.**

It only selects from a **fixed, pre-validated action menu**:

- Increase batch size  
- Decrease batch size  
- Enable gradient accumulation  
- Adjust NCCL flags  
- Reduce checkpoint frequency  

Every action is **timestamped**, **logged**, and **reversible**. The worst-case outcome is always a known-safe configuration change that can be rolled back instantly. This constraint ensures GPU Unbound augments human expertise without introducing new risks — production-ready by design.

---

## Architecture at a Glance

```
+-----------------+     +------------------+     +-----------------+
|   AMD GPU(s)    |---->|  Python Backend  |---->|  Next.js Frontend|
|  (ROCm stack)   |     | - rocm-smi/      |     | - Live dashboard |
|                 |     |   rocprof ingest |     | - Audio playback |
+-----------------+     | - AI classifier  |     | - Audit timeline |
                        | - Action engine  |     | - WebSocket     |
                        +------------------+     +-----------------+
                                |                        |
                                v                        v
                        +-----------------------------------------+
                        |   Auditable JSON Logs + Timeline       |
                        +-----------------------------------------+
```

The Python agent runs continuously, pushing telemetry-derived audio parameters and classification results to the Next.js UI via WebSockets. The browser synthesizes the final audio stream in real-time, keeping latency minimal.

---

## Team Magnum Opus

- Prakash Niroula — Lead
- Matin Niroula
- Prabesh Neupaney
- Ricky Bahadur Khulal
- Sakxam Kapar
- Shubham Sah

---

## Closing

**Five days, one idea, a system built to make GPU infra speak.**

GPU Unbound turns silent, expensive failures into audible, actionable intelligence. By combining AMD's low-level ROCm telemetry with Python's analytical horsepower and Next.js's real-time UI capabilities, we've created a monitoring experience that doesn't demand your eyes — it demands your attention, only when it matters. Every wasted cycle becomes a sound you can recognize, and every fix becomes a log entry you can trust.

---

*Made for the AMD Developer Hackathon: ACT II, Unicorn Track.*
