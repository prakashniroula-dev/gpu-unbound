## Phase 1: Gateway & Onboarding Layer

### 1. Pre-Auth Landing Page (The Conceptual Hook)

* **The Hero Statement:** Displays a monospace banner reading `GPU_UNBOUND // TERMINAL_V1` next to the primary core value proposition: *"GPU Unbound: Break free from memory-bound and comms-bound constraints – fully unleashing your GPU cluster's potential."*

* **Web Audio API Active Preview:** Contains an interactive, client-side waveform canvas with a `[ TEST AUDIO CAPABILITY ]` diagnostic button. Clicking this safely runs a localized Web Audio API sandbox loop to demonstrate high-contrast auditory states to user/judge observers before app instantiation:


* **Healthy State Preview:** Emits a steady, low-frequency 130Hz triangle/sine wave to establish an efficient processing baseline hum.


* **Anomalous State Preview:** Alters the frequency vector dynamically into a sharp, jitter-laden pitch spike to mimic extreme operational distress (memory-bound, comms-bound scenarios).


* **The Architectural Pitch:** A strict dual-column layout explicitly highlighting the deep `rocprof` kernel-trace collection method over typical surface-level cluster tracking metrics.



### 2. Sign-Up / Sign-In Experience (The Infrastructure Bridge)

* **Enterprise OAuth Connectors:** Offers stylized button frames for cloud execution endpoints (`Sign in with AMD Cloud`, `Sign in with AWS`, `Sign in with GCP`).
* **Cluster Hook Formulation:** A targeted credential panel requiring the input of a dedicated cluster identifier (`JOB_ID`), backend authorization token string, and a cluster selection profile matrix (`AMD Cloud Sandbox`, `On-Premise Server Rack`).


* **Prototype Fallback Layer:** While enterprise-grade authorization profiles are configured visually, backend calls route straight past complex database verification blocks to a single, secure environment variable token string (`BLACKBOX_API_KEY`) to minimize operational blockages during high-pressure judge presentations.



---

## Phase 2: Target Cluster Setup & Configuration

```
[Target Cluster Container] ──(200ms telemetry samples)──> [FastAPI WebSocket] ──> [Next.js UI Engine (ui.jpeg)]

```

### 1. Automated Containerization (Docker Layer)

* **Base Image Declaration:** Pulls a standardized, pre-configured AMD hardware image layer directly within the configuration stack to instantly resolve environmental driver discrepancies:


```dockerfile
FROM rocm/pytorch:latest
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "telemetry_collector.py"]

```


* **Environmental Scope Execution:** Segregates processing duties perfectly: the core execution processes, training steps, and raw metric aggregators remain strictly containerized inside the target system environment. The frontend interface operates client-side, using persistent streaming links.



### 2. Low-Overhead Telemetry Sampling Daemon

* **Polling Loop Frequency:** Executes an asynchronous python-based event tracking loop within the cluster core, firing precisely every **200ms** to minimize hardware profiling noise.


* **System Telemetry Collector (`rocm-smi`):** Aggregates critical high-level processing indicators including operational capacity ratios, instant system power metrics, and device temperature values.


* **Kernel Profiling Daemon (`rocprof`):** Samples micro-level execution events inside active processing layers, extracting accurate kernel launch interval counts and memory pipeline latency metrics.



---

## Phase 3: Core Application Architecture (`ui.jpeg`)

Once an active processing sequence initiates, the visual framework morphs into the operational control matrix highlighted in **ui.jpeg**.

```
+---------------------------------------------------------------------------------------+
| BLACKBOX_AI // ROCM.V6                      GEMINI_API_ONLINE  COMPUTE_BOUND  v.4.2.1  |
+---------------------------------------------------+-----------------------------------|
|                                                   |                                   |
|   AUTONOMOUS OPTIMIZATION                         |  [05] COGNITIVE AGENT REASONER    |
|                                                   |       Live Structured JSON Stream |
|   98% CORE INDEX   0.042ms LATENCY   71°C THERMAL |       Constrained Action Overlay  |
|                                                   |                                   |
|  +-----------------------+  +------------------+  +-----------------------------------|
|  | [01] SONIFICATION     |  | [01] GPU MATH    |  |                                   |
|  |  Waveform Monitor     |  |  98% Util        |  |  [06] ROOT-CAUSE TIMELINE AUDIT   |
|  +-----------------------+  +------------------+  |       Vertical Historical Log     |
|  | [02] MEM BANDWIDTH    |  | [03] KERNEL GAP  |  |       (Detect->Diagnose->Act)     |
|  +-----------------------+  +------------------+  |                                   |
+---------------------------------------------------+-----------------------------------+
| [07] HISTORIC TELEMETRY STREAM (Continuous 60s Horizontal Tracking Component)        |
+---------------------------------------------------------------------------------------+

```

### 1. Left-to-Center Column: Real-Time Hardware State Telemetry

* **Project Meta-Metrics Overlay:** Displays the top status indicators from **ui.jpeg**, keeping tracking states visible via automated tags (`GEMINI_COGNITIVE_API_ONLINE`, `COMPUTE_BOUND`, `v.4.2.1-ROCM`).


* **Primary System Index Blocks:** Highlights large structural scale counters detailing immediate compute loads, performance delays, and core heat metrics.


* **`[01] SONIFICATION_ENGINE`:** Runs a real-time fluid oscilloscope graph within the canvas frame designated in **ui.jpeg**, drawing audio waveform signals via reactive data feeds.


* **Telemetry Grid Framework:** Splices secondary system characteristics into clean visual frames:


* **`[01] GPU MATH`:** Maps real-time core capability output against fixed percentage bars.


* **`[02] MEM BANDWIDTH`:** Tracks memory access saturation markers.


* **`[03] KERNEL GAP`:** Pinpoints processing delays to intercept memory starvation errors early.


* **`[04] CORE TEMP`:** Connects thermal values with exact device processing speeds and raw performance wattage draw indicators.





### 2. Enhanced Right Column: Cognitive Agent & Immutable Audit Trail

* **`[05] COGNITIVE AGENT REASONER` (The Fireworks AI Interface Layer):** A dynamic interface container focused entirely on formatting real-time system responses parsed from the pipeline. Includes a terminal window printing live JSON classifications directly onto the interface layout:


```json
{
  "state": "memory_bound",
  "confidence": 0.88,
  "evidence": "memory bandwidth sat > 80%"
}

```


* **`[06] ROOT-CAUSE TIMELINE AUDIT`:** A vertical chronological stream linked directly to system tracking storage models. Displays clear alert points mapping out recovery events:


* 🔴 **[TIMESTAMP - DETECTED]:** Saturation limit alerts triggered via automated system tools.


* 🟡 **[TIMESTAMP - DIAGNOSED]:** Processing error validation verified via cloud endpoint pipelines.


* 🔵 **[TIMESTAMP - ACTED]:** Whitelisted optimization commands initiated on the cluster framework.


* 🟢 **[TIMESTAMP - VERIFIED]:** Recovery sequence validation confirmed; audio feedback signals normal operations.





### 3. Bottom Row: `[07] HISTORIC TELEMETRY STREAM`

* An ultra-wide timeline canvas that logs hardware metrics over a rolling 60-second window. This provides clear visual confirmation of structural anomalies during validation presentations, displaying visible metric fluctuations the exact moment performance errors are injected.



---

## Phase 4: Cognitive Loop & Action Menu Orchestration

```
[Telemetry Window] ──> [Stage 1: Classifier LLM] ──(JSON)──> [Stage 2: Enum Action Selector] ──> [Pre-Validated Function Execution]

```

### 1. Minimal SQL Data Architecture

The data layer maps the full system lifecycle through a lightweight SQLite deployment layout containing three targeted storage models:

```sql
CREATE TABLE telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    gpu_util REAL,
    mem_bandwidth_sat REAL,
    power_draw REAL,
    kernel_gap REAL
);

CREATE TABLE diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    state TEXT NOT NULL, -- healthy / memory_bound / comms_bound / power_throttle
    confidence REAL,
    evidence TEXT
);

CREATE TABLE actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    action TEXT NOT NULL, -- whitelisted enum keys
    params TEXT,          -- JSON execution configuration values
    outcome TEXT          -- pending / resolved / no_change
);

```

### 2. Two-Stage Fireworks AI Agent Flow

To maximize response speed and formatting stability, the configuration routes processing snapshots to a Fireworks AI open-source execution instance using two distinct structural passes:

#### Stage 1: The Fast Classifier LLM

* **Objective:** Compresses 5-second telemetry data frames into quick system classifications.


* **Structural Prompt Control:** Strict structural directives enforce clean, zero-prose JSON generation to eliminate syntax issues during automated parsing loops:


```
You are an expert AMD GPU monitoring agent. Analyze the telemetry window and respond ONLY with a valid JSON object matching the few-shot template below. No explanations.

```



#### Stage 2: The Enum Action Selector

* **Strategic Boundary Control:** Restricts remediation decisions exclusively to a pre-defined array of administrative functions to prevent unverified script mutations on the cluster.


* **Whitelisted Action Profiles:** Maps hardware anomalies to fixed execution methods:


* `increase_batch_size` / `decrease_batch_size` $\rightarrow$ Corrects memory starvation errors dynamically by altering arithmetic processing volume per step.


* `enable_gradient_accumulation` $\rightarrow$ Mitigates tracking bottlenecks across deep processing chains.


* `adjust_nccl_flags` $\rightarrow$ Fixes cluster communication synchronization delays over multi-node arrays.





---

## Phase 5: Interactive Audio Synthesis & Demo Control

### 1. Web Audio API Sonification Map

System changes map directly to clear pitch and rhythmic adjustments in the browser:

* **Mathematical Frequency Scaling:** Normal background states compute cleanly, driving targeted synthesizer transformations:



$$f_{\text{target}} = 130\text{Hz} + (\text{mem\_bandwidth\_sat} \times 1.5)$$


* **Dissonance Induction:** Starvation alerts inject structural noise into target oscillator nodes:


```javascript
// High-saturation jitter injection loop
if (saturationRatio > 0.80) {
    oscillatorNode.frequency.setValueAtTime(
        targetFreq + (Math.random() - 0.5) * 25, 
        audioContext.currentTime
    );
}

```


* **Audio Transformation States:**
* `Healthy (Compute-Bound)`: Emits a steady, low-frequency 130Hz triangle hum with minor LFO modulation.


* `Memory-Bound`: Spikes output frequency vectors upward alongside high-frequency structural jitter.


* `Comms-Bound`: Drops tone parameters completely, outputting uneven, clicking audio signals.


* `Recovery Glide`: Smoothly transitions frequency values back to baseline markers over a 3-second window, offering clear audio confirmation that the automated optimization resolved the issue.





### 2. Presenter-Targeted Demo Control Systems

* **The Intentional Fault Injection Panel:** Adds specific diagnostic buttons (`[ INJECT MEM_BOUND ]`, `[ INJECT COMMS_STALL ]`) near the header navigation layer of **ui.jpeg**. This routes testing commands directly to the `/inject-bottleneck` backend route, allowing presenters to simulate structural crashes on demand during live judging evaluations.


* **Policy Enforcement Override Slider:** Incorporates a fast operational toggle (`AUTOMATIC ACTIONS / MANUAL OVERVIEW`). If live automation loops face communication latency issues during presentations, changing modes transforms the agent card into an overlay interface containing a single interaction choice: `[ CONFIRM AND DEPLOY AI RECOMMENDATION ]`. This ensures the presentation runs smoothly regardless of network behavior.