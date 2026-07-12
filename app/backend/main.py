"""
main.py - FastAPI backend for BlackBox AI GPU Telemetry Streaming

# RUN INSTRUCTIONS
# pip install -r requirements.txt
# Requires rocm-smi installed and a real AMD GPU (AMD Developer Cloud container)
# Frontend connects to: ws://localhost:8000/ws/telemetry/job123

# END-TO-END LOOP
# training_job running → rocm_monitor polls GPU telemetry → 
# state_classifier detects state changes → WebSocket streams to frontend →
# frontend audio engine plays pitch changes + issue_detected sound
"""

import asyncio
import uuid
from collections import deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import rocm_monitor
import state_classifier
import training_job

# Connection state
websocket_connections: dict[str, WebSocket] = {}
telemetry_histories: dict[str, deque] = {}
previous_states: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    print("[main] BlackBox AI Backend starting up...")
    if rocm_monitor.is_rocm_available():
        print("[main] ROCm detected – live GPU telemetry active.")
    else:
        print("[main] WARNING: ROCm not available – telemetry will return zeros.")
    yield
    print("[main] Shutting down...")
    training_job.stop_training_job()


app = FastAPI(
    title="BlackBox AI GPU Telemetry",
    description="Real-time AMD GPU telemetry streaming via WebSocket",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "running",
        "rocm_available": rocm_monitor.is_rocm_available(),
        "training_active": training_job.is_running()
    }


@app.post("/api/training/start")
async def start_training():
    """
    Start the MNIST training job in the background.
    
    Returns:
        job_id: unique identifier for this training session
    """
    job_id = training_job.start_training_job()
    print(f"[main] Training started with job_id: {job_id}")
    return {"job_id": job_id, "status": "started"}


@app.websocket("/ws/telemetry/{job_id}")
async def websocket_telemetry(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for streaming GPU telemetry.
    
    Streams telemetry every 200ms with state change detection.
    Sends immediate 'issue_detected' events on state transitions.
    
    Message format (matches frontend audio-engine.js expectations and the
    notebook testing script in train_model.ipynb):
    {
        "type": "telemetry",
        "computeUtil": float,    # GPU utilization %
        "memBandwidthPct": float, # Memory pressure score 0-100
        "powerW": float,          # Power consumption in Watts
        "state": str,            # healthy|memory_bound|comms_bound|power_throttled
        "confidence": float,     # optional classifier confidence
        "evidence": str          # optional human-readable explanation
    }
    
    Event format:
    {
        "type": "event",
        "event": "issue_detected"
    }
    """
    await websocket.accept()
    print(f"[main] WebSocket connected: job_id={job_id}")
    
    websocket_connections[job_id] = websocket
    telemetry_histories[job_id] = deque(maxlen=25)
    previous_states[job_id] = "healthy"
    
    try:
        while True:
            # 1. Poll GPU telemetry (live from ROCm)
            telemetry = rocm_monitor.poll_gpu()
            
            # 2. Add to rolling history
            history = telemetry_histories[job_id]
            history.append(telemetry)
            
            # 3. Calculate memory pressure over the same 5-second window used
            #    by the notebook test script.
            memory_pressure = rocm_monitor.get_memory_bandwidth_pressure(list(history))
            
            # 4. Classify state (uses model if available, else rule-based)
            classification = state_classifier.classify(list(history))
            current_state = classification["state"]
            
            # 5. Send telemetry message
            message = {
                "type": "telemetry",
                "computeUtil": telemetry["gpu_util_pct"],
                "memBandwidthPct": memory_pressure,
                "powerW": telemetry["power_w"],
                "state": current_state,
                "confidence": classification.get("confidence", 0.0),
                "evidence": classification.get("evidence", ""),
                "jobId": job_id,
                "windowSeconds": 5
            }
            await websocket.send_json(message)
            
            # 6. Check for state transition - send immediate event
            prev_state = previous_states[job_id]
            if current_state != prev_state and current_state != "healthy":
                event_message = {
                    "type": "event",
                    "event": "issue_detected",
                    "state": current_state,
                    "confidence": classification.get("confidence", 0.0),
                    "evidence": classification.get("evidence", "")
                }
                await websocket.send_json(event_message)
                print(f"[main] STATE TRANSITION: {prev_state} → {current_state} | evidence: {classification['evidence']}")
                print(f"[main] SENT issue_detected event to client")
            
            previous_states[job_id] = current_state
            
            # TODO PHASE 2: call Fireworks AI classifier here
            # TODO PHASE 2: send "event": "processing" after issue_detected
            # TODO PHASE 2: apply constrained action based on LLM recommendation
            # TODO PHASE 2: send "event": "success" or "failed" or "human_intervention_required"
            
            # 7. Wait 200ms before next poll
            await asyncio.sleep(0.2)
            
    except WebSocketDisconnect:
        print(f"[main] WebSocket disconnected: job_id={job_id}")
    except Exception as e:
        print(f"[main] WebSocket error: job_id={job_id}, error={e}")
    finally:
        # Cleanup
        websocket_connections.pop(job_id, None)
        telemetry_histories.pop(job_id, None)
        previous_states.pop(job_id, None)
        print(f"[main] Cleaned up connection state for job_id={job_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)