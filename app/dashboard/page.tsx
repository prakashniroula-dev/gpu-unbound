'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import StatusIndicators from '../components/dashboard/StatusIndicators';
import IndexCounters from '../components/dashboard/IndexCounters';
import MetricCard from '../components/dashboard/MetricCard';
import SonificationEngine from '../components/dashboard/SonificationEngine';
import CognitiveAgentReasoner, { AIResponse } from '../components/dashboard/CognitiveAgentReasoner';
import RootCauseTimeline from '../components/dashboard/RootCauseTimeline';
import HistoricTelemetryStream from '../components/dashboard/HistoricTelemetryStream';
import { useFaultInjectionSounds, useDashboardSounds } from '../hooks/useSound';

// Type for system state
type SystemState = 'healthy' | 'memory_bound' | 'comms_bound' | 'recovery' | 'verifying' | 'applying_solution';

// Type for timeline events
type TimelineEventType = 'DETECTED' | 'ANALYSIS' | 'VERIFICATION' | 'SOLUTION' | 'RECOVERED';

interface TimelineEvent {
  type: TimelineEventType;
  timestamp: number;
  message: string;
}

export default function DashboardPage() {
  const [autoMode, setAutoMode] = useState(true);
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [injectionActive, setInjectionActive] = useState(false);
  const [injectionType, setInjectionType] = useState<'memory_bound' | 'comms_bound' | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([{
    type: 'RECOVERED' as const,
    timestamp: Date.now(),
    message: 'System initialized - All metrics nominal',
  }]);
  const [aiResponse, setAiResponse] = useState<{
    state: SystemState;
    confidence: number;
    evidence: string;
    action?: string;
  } | null>(null);

  // Sound system - preloading handled by child hooks
  const previousStateRef = useRef<string>('healthy');
  const { playClickSound, debouncedClick } = useDashboardSounds();

  // Base healthy telemetry values
  const baseTelemetry = {
    gpu_util: 98,
    mem_bandwidth_sat: 0.71,
    power_draw: 280,
    kernel_gap: 12,
    core_temp: 71,
  };

  // Calculate current telemetry based on state
  const getCurrentTelemetry = useCallback((state: SystemState) => {
    switch (state) {
      case 'healthy':
        return { ...baseTelemetry, state };
      case 'memory_bound':
        return {
          ...baseTelemetry,
          gpu_util: 45,
          mem_bandwidth_sat: 0.95,
          power_draw: 180,
          kernel_gap: 120,
          core_temp: 85,
          state,
        };
      case 'comms_bound':
        return {
          ...baseTelemetry,
          gpu_util: 30,
          mem_bandwidth_sat: 0.4,
          power_draw: 150,
          kernel_gap: 200,
          core_temp: 75,
          state,
        };
      case 'recovery':
        return {
          ...baseTelemetry,
          gpu_util: 70,
          mem_bandwidth_sat: 0.5,
          power_draw: 200,
          kernel_gap: 50,
          core_temp: 75,
          state,
        };
      case 'verifying':
        return {
          ...baseTelemetry,
          gpu_util: 80,
          mem_bandwidth_sat: 0.55,
          power_draw: 220,
          kernel_gap: 30,
          core_temp: 72,
          state,
        };
      case 'applying_solution':
        return {
          ...baseTelemetry,
          gpu_util: 85,
          mem_bandwidth_sat: 0.6,
          power_draw: 240,
          kernel_gap: 25,
          core_temp: 70,
          state,
        };
      default:
        return { ...baseTelemetry, state };
    }
  }, []);

  const [telemetry, setTelemetry] = useState(() => getCurrentTelemetry('healthy'));
  const telemetrySonification = useMemo(() => {
    return {mem_bandwidth_sat: telemetry.mem_bandwidth_sat, gpu_util: telemetry.gpu_util, state: telemetry.state}
  }, [telemetry.state])

  // Handle fault injection state transitions (must be after telemetry declaration)
  useFaultInjectionSounds(telemetry.state, previousStateRef);

  // Add timeline event
  const addEvent = useCallback((type: TimelineEventType, message: string) => {
    const newEvent: TimelineEvent = {
      type,
      timestamp: Date.now(),
      message,
    };
    setEvents(prev => [...prev, newEvent]);
    return newEvent;
  }, []);

  // Inject fault - starts 10 second cycle
  const injectFault = useCallback((type: 'memory_bound' | 'comms_bound') => {
    if (injectionActive) return; // Prevent multiple injections

    playClickSound(); // Play click sound for button press
    setInjectionActive(true);
    setInjectionType(type);
    
    // Add detection event
    const detectionEvent = addEvent(
      'DETECTED',
      `Saturation limit exceeded - ${type === 'memory_bound' ? 'Memory bandwidth > 80%' : 'Kernel gap > 100ms'}`
    );
    
    // Set fault state
    setTelemetry(getCurrentTelemetry(type));
    setAiResponse({
      state: type,
      confidence: 0.95,
      evidence: type === 'memory_bound' 
        ? 'Memory bandwidth saturation > 80%, kernel launch delays detected'
        : 'Communication latency > 100ms, kernel gap anomalies',
      action: type === 'memory_bound' ? 'decrease_batch_size' : 'adjust_nccl_flags',
    });
    
    // Start verification after 2 seconds
    setTimeout(() => {
      addEvent('VERIFICATION', 'Validating anomaly via cloud endpoint pipelines');
      setTelemetry(getCurrentTelemetry('verifying'));
    }, 2000);
    
    // Add AI analysis after 4 seconds
    setTimeout(() => {
      addEvent('ANALYSIS', `Confirmed: ${type.toUpperCase()} state detected with 95% confidence`);
    }, 4000);
    
    // Apply solution after 6 seconds
    setTimeout(() => {
      const solutionEvent = addEvent('SOLUTION', 
        type === 'memory_bound' 
          ? 'Applying: decrease_batch_size to reduce memory pressure'
          : 'Applying: adjust_nccl_flags to optimize communication'
      );
      setTelemetry(getCurrentTelemetry('applying_solution'));
      setAiResponse(prev => prev ? {
        ...prev,
        evidence: `${prev.evidence} - Solution: ${prev.action}`,
      } : null);
    }, 6000);
    
    // Start recovery after 8 seconds
    setTimeout(() => {
      addEvent('RECOVERED', 'System parameters returning to normal');
      setTelemetry(getCurrentTelemetry('recovery'));
    }, 8000);
    
    // Complete recovery after 10 seconds
    setTimeout(() => {
      addEvent('RECOVERED', 'System restored to healthy state');
      setTelemetry(getCurrentTelemetry('healthy'));
      setInjectionActive(false);
      setInjectionType(null);
      setAiResponse({
        state: 'healthy',
        confidence: 0.99,
        evidence: 'All metrics within normal ranges - Recovery successful',
      });
    }, 10000);
  }, [injectionActive, addEvent, getCurrentTelemetry, playClickSound]);

  const deployAIRecommendation = useCallback(() => {
    if (!aiResponse || !injectionActive) return;

    playClickSound();
    addEvent('SOLUTION', `Manually deploying: ${aiResponse.action}`);
    setTelemetry(getCurrentTelemetry('applying_solution'));
    
    setTimeout(() => {
      addEvent('RECOVERED', 'Manual solution applied - System restored');
      setTelemetry(getCurrentTelemetry('healthy'));
      setInjectionActive(false);
      setInjectionType(null);
      setAiResponse({
        state: 'healthy',
        confidence: 0.99,
        evidence: 'Manual intervention successful - Recovery complete',
      });
    }, 3000);
  }, [aiResponse, injectionActive, addEvent, getCurrentTelemetry]);

  // Smooth telemetry updates using sine wave for natural fluctuations
  useEffect(() => {
    let lastTime = Date.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      if (!injectionActive) {
        // Use sine wave for smooth fluctuations with more dramatic peaks
        const timeFactor = currentTime * 0.001;
        const fluctuation = Math.sin(timeFactor) * 0.15;
        const fluctuation2 = Math.sin(timeFactor * 1.3) * 0.1;
        const totalFluctuation = fluctuation + fluctuation2;
        
        setTelemetry(prev => {
          if (prev.state !== 'healthy') return prev;
          return {
            ...prev,
            gpu_util: Math.max(85, Math.min(99, 95 + totalFluctuation * 15)),
            mem_bandwidth_sat: Math.max(0.6, Math.min(0.75, 0.7 + totalFluctuation * 0.08)),
            power_draw: Math.max(250, Math.min(300, 280 + totalFluctuation * 30)),
            kernel_gap: Math.max(5, Math.min(20, 12 + totalFluctuation * 8)),
            core_temp: Math.max(65, Math.min(75, 71 + totalFluctuation * 3)),
          };
        });
      }
      
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    return () => {
      // Cleanup handled by animation frame
    };
  }, [injectionActive, getCurrentTelemetry]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="w-full py-3 px-6 border-b border-green-500/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono text-green-500">
              GPU_UNBOUND // ROCM
            </h1>
            <span className="text-sm text-green-500/60 ml-4">
              ROCm Telemetry Monitor v1.0.0
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                debouncedClick('autoMode');
                setAutoMode(!autoMode);
              }}
              className={`px-4 py-2 font-mono text-sm border-2 rounded transition-all btn-click-effect btn-bracket ${
                autoMode
                  ? 'border-green-500 text-green-500 hover:bg-green-500/10 hover:border-green-400'
                  : 'border-orange-500 text-orange-500 hover:bg-orange-500/10'
              }`}
            >
              [ {autoMode ? 'AUTO MODE' : 'MANUAL MODE'} ]
            </button>

            <button
              onClick={() => injectFault('memory_bound')}
              disabled={injectionActive}
              className={`px-4 py-2 font-mono text-sm border-2 rounded transition-all btn-danger btn-bracket ${
                injectionActive
                  ? 'border-red-500/30 text-red-500/30 cursor-not-allowed'
                  : 'border-red-500 text-red-500 hover:bg-red-500/10'
              }`}
            >
              {injectionActive && injectionType === 'memory_bound' ? '[ ACTIVE... ]' : '[ INJECT MEM FAULT ]'}
            </button>

            <button
              onClick={() => injectFault('comms_bound')}
              disabled={injectionActive}
              className={`px-4 py-2 font-mono text-sm border-2 rounded transition-all btn-warning btn-bracket ${
                injectionActive
                  ? 'border-orange-500/30 text-orange-500/30 cursor-not-allowed'
                  : 'border-orange-500 text-orange-500 hover:bg-orange-500/10'
              }`}
            >
              {injectionActive && injectionType === 'comms_bound' ? '[ ACTIVE... ]' : '[ INJECT COMMS FAULT ]'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full py-4 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="max-w-7xl">
            <SonificationEngine telemetry={telemetrySonification} />
          </div>
          {/* Top Row: Analysis + Timeline - Unified Collapsible */}
          <div className="w-full border border-cyan-500/50 rounded-lg overflow-hidden mb-4">
            <button
              type="button"
              className="w-full p-3 border-b border-cyan-500/30 flex items-center justify-between cursor-pointer hover:bg-cyan-500/5 btn-click-effect"
              onClick={() => {
                debouncedClick('analysisToggle');
                setAnalysisCollapsed(!analysisCollapsed);
              }}
              aria-expanded={!analysisCollapsed}
              aria-controls="analysis-timeline-panel"
            >
              <div className="text-left">
                <h2 className="text-sm font-mono text-cyan-500">SYSTEM ANALYSIS & TIMELINE</h2>
                <p className="text-xs text-zinc-500">AI Reasoning + Event Log</p>
              </div>
              <span className="text-cyan-500 text-xs">
                {analysisCollapsed ? '[ + ]' : '[ - ]'}
              </span>
            </button>

            {!analysisCollapsed && (
              <div id="analysis-timeline-panel" className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-black/20">
                <CognitiveAgentReasoner 
                  jsonStream={aiResponse as AIResponse}
                />
                <RootCauseTimeline events={events} />
              </div>
            )}
          </div>
          
          {/* Middle Row: Telemetry Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MetricCard
              label="GPU UTIL"
              value={telemetry.gpu_util}
              unit="%"
              anomaly={telemetry.gpu_util > 95}
            />
            <MetricCard
              label="MEM BW"
              value={telemetry.mem_bandwidth_sat * 100}
              unit="%"
              anomaly={telemetry.mem_bandwidth_sat > 0.8}
            />
            <MetricCard
              label="KERNEL GAP"
              value={telemetry.kernel_gap}
              unit="ms"
              anomaly={telemetry.kernel_gap > 50}
            />
            <MetricCard
              label="CORE TEMP"
              value={telemetry.core_temp}
              unit="°C"
              anomaly={telemetry.core_temp > 85}
            />
          </div>
          
          {/* Bottom Row: Sonification + Telemetry Stream */}
          {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              
            </div>
            <div className="md:col-span-3">
            </div>
          </div> */}
              <HistoricTelemetryStream 
                windowMs={60000} 
                currentState={telemetry.state}
                currentTelemetry={telemetry}
              />
          
          {/* Manual Mode Overlay */}
          {!autoMode && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-zinc-900 border-2 border-orange-500 rounded-lg p-8 max-w-2xl">
                <h3 className="text-xl font-mono text-orange-500 mb-4">
                  MANUAL MODE
                </h3>
                <p className="text-zinc-400 mb-6 font-mono">
                  An issue has been detected. Review the recommended action below.
                </p>
                <button
                  onClick={deployAIRecommendation}
                  className="w-full px-8 py-4 bg-green-500/10 border-2 border-green-500 text-green-500 hover:bg-green-500/20 font-mono rounded transition-all btn-click-effect btn-primary"
                >
                  [ CONFIRM AND APPLY ]
                </button>
                <button
                  onClick={() => {
                    debouncedClick('cancel');
                    setAutoMode(true);
                  }}
                  className="mt-4 w-full px-8 py-4 border-2 border-zinc-600 text-zinc-400 hover:bg-zinc-600/10 font-mono rounded transition-all btn-click-effect btn-bracket"
                >
                  [ CANCEL ]
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 border-t border-green-500/30">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="font-mono text-green-500/60 text-sm">
            GPU_UNBOUND // REALTIME_TELEMETRY &bull; 200ms_SAMPLING &bull; v.4.2.1-ROCM
          </p>
        </div>
      </footer>
    </div>
  );
}