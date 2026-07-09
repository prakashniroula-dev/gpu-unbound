"use client";

import { useState, useEffect, useCallback } from "react";

interface AIResponse {
  state:
    | "healthy"
    | "memory_bound"
    | "comms_bound"
    | "power_throttle"
    | "recovery";
  confidence: number;
  evidence: string;
  timestamp?: number;
}

interface CognitiveAgentReasonerProps {
  jsonStream?: AIResponse | null;
}

const STATES = [
  "healthy",
  "memory_bound",
  "comms_bound",
  "power_throttle",
] as const;

export default function CognitiveAgentReasoner({
  jsonStream,
}: CognitiveAgentReasonerProps) {
  const [response, setResponse] = useState<AIResponse | null>({
    state: 'healthy',
    confidence: 0.98,
    evidence: 'All metrics within normal ranges',
    timestamp: Date.now(),
  });
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (jsonStream) {
      setResponse(jsonStream);
    }
  }, [jsonStream]);

  // Generate system state response
  const generateResponse = useCallback(() => {
    const randomState = STATES[Math.floor(Math.random() * STATES.length)];

    const evidenceMap: Record<typeof randomState, string> = {
      healthy: "All metrics within normal ranges",
      memory_bound: "Memory bandwidth saturation > 80%",
      comms_bound: "Kernel launch latency exceeds threshold",
      power_throttle: "Power draw approaching thermal limits",
    };

    const mock: AIResponse = {
      state: randomState,
      confidence: Math.random() > 0.5 ? 0.88 : 0.95,
      evidence: evidenceMap[randomState],
      timestamp: Date.now(),
    };

    setResponse(mock);
  }, []);

  return (
    <div className="w-full border border-cyan-500/50 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full p-3 border-b border-cyan-500/30 flex items-center justify-between cursor-pointer hover:bg-cyan-500/5"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        aria-controls="analysis-panel"
      >
        <div className="text-left">
          <h3 className="text-sm font-mono text-cyan-500">SYSTEM ANALYSIS</h3>
          <p className="text-xs text-zinc-500">Current State Assessment</p>
        </div>
        <span className="text-cyan-500 text-xs" aria-hidden="true">
          {isCollapsed ? "[ + ]" : "[ - ]"}
        </span>
      </button>

      {!isCollapsed && (
        <div id="analysis-panel" className="h-80">
          <div className="p-3 w-full h-full bg-black/20 overflow-y-auto">
            <div className="font-mono w-full h-full flex flex-col justify-between text-xs space-y-2">
              {response ? (
                <>
                  <div className='w-full'>
                    <div className="text-zinc-500">
                      &gt; Live Structured JSON Stream
                    </div>
                    <pre className="text-green-500 text-sm whitespace-pre-wrap break-all overflow-x-auto">
                      {JSON.stringify(response, null, 2).replace("\"evidence\":", "\"evidence\":\n   ")}
                    </pre>
                  </div>

                  <div className="p-3 border border-cyan-500/30 rounded">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"
                        aria-hidden="true"
                      />
                      <span className="text-cyan-500">
                        State: {response.state.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-zinc-400 mt-1">
                      Confidence: {(response.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-zinc-500 text-xs mt-1">
                      Evidence: {response.evidence}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-zinc-600">
                  <p>&gt; Awaiting telemetry data...</p>
                  <p className="mt-2">
                    &gt; Click below to simulate AI response
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
