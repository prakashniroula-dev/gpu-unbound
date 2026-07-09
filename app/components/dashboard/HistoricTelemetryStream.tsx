"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TelemetryPoint {
  gpu_util: number;
  mem_bandwidth_sat: number;
  power_draw: number;
  kernel_gap: number;
  core_temp: number;
}

interface HistoricTelemetryStreamProps {
  windowMs?: number;
  data?: TelemetryPoint[];
  currentState?: string;
  currentTelemetry?: TelemetryPoint;
}

// Normalize a value to deviation from baseline (centered at 50, scaled for visibility)
const toDeviation = (value: number, baseline: number, scale: number = 25) => {
  return Math.max(0, Math.min(100, 50 + ((value - baseline) / scale) * 50));
};

// Default baseline values for normalization (healthy state reference)
const DEFAULT_BASELINES = {
  gpu_util: 95,
  mem_bandwidth: 70,
  core_temp: 71,
};

// ±10 acceptability range for baseline adjustment
const BASELINE_ADJUST_RANGE = 30;
const CLIP_THRESHOLD = 2; // How close to edge before adjusting (in chart units)

// Vertical offsets to separate each metric on the chart
const METRIC_OFFSETS = {
  GPU_Util: 0,
  Memory_Bandwidth: 5,
  Core_Temp: -5,
};

const NUM_POINTS = 100;

export default function HistoricTelemetryStream({
  windowMs = 60000,
  data,
  currentState = "healthy",
  currentTelemetry,
}: HistoricTelemetryStreamProps) {
  // Separate buffer for values
  const [gpuBuffer, setGpuBuffer] = useState<number[]>([]);
  const [memBuffer, setMemBuffer] = useState<number[]>([]);
  const [tempBuffer, setTempBuffer] = useState<number[]>([]);
  const [baselines, setBaselines] = useState(DEFAULT_BASELINES);
  const hasData = data && data.length > 0;
  const [initialized, setInitialized] = useState(false);
  const baselinesRef = useRef(baselines);

  // Auto-adjusted baselines for display (within ±10 of defaults)
  const [displayBaselines, setDisplayBaselines] = useState(DEFAULT_BASELINES);
  const displayBaselinesRef = useRef(displayBaselines);

  // Update baselines ref when baselines change
  baselinesRef.current = baselines;

  // Stable ref for telemetry - never reset to undefined once set
  const currentTelemetryRef = useRef<TelemetryPoint | null>(currentTelemetry || null);
  if (currentTelemetry) {
    currentTelemetryRef.current = currentTelemetry;
  }

  // Update baselines when currentTelemetry changes (for Y-axis labels)
  useEffect(() => {
    if (currentTelemetry) {
      setBaselines({
        gpu_util: currentTelemetry.gpu_util,
        mem_bandwidth: currentTelemetry.mem_bandwidth_sat * 100,
        core_temp: currentTelemetry.core_temp,
      });
    }
  }, [currentTelemetry]);

  // Auto-adjust baselines if values are clipping at edges
  useEffect(() => {
    if (!currentTelemetry) return;

    const { gpu_util, mem_bandwidth_sat, core_temp } = currentTelemetry;
    const newDisplay = { ...displayBaselinesRef.current };
    let adjusted = false;

    // Check GPU: if deviation would clip at top (>95 threshold = chart value 100)
    const gpuDev = (gpu_util - DEFAULT_BASELINES.gpu_util) / 15;
    if (50 + gpuDev * 50 > 98) {
      const newBase = gpu_util - 10;
      if (Math.abs(newBase - DEFAULT_BASELINES.gpu_util) <= BASELINE_ADJUST_RANGE) {
        newDisplay.gpu_util = newBase;
        adjusted = true;
      }
    } else if (50 + gpuDev * 50 < 2) {
      const newBase = gpu_util + 10;
      if (Math.abs(newBase - DEFAULT_BASELINES.gpu_util) <= BASELINE_ADJUST_RANGE) {
        newDisplay.gpu_util = newBase;
        adjusted = true;
      }
    }

    // Check MEM
    const memDev = (mem_bandwidth_sat * 100 - DEFAULT_BASELINES.mem_bandwidth) / 20;
    if (50 + memDev * 50 + METRIC_OFFSETS.Memory_Bandwidth > 98) {
      const newBase = mem_bandwidth_sat * 100 - 10;
      if (Math.abs(newBase - DEFAULT_BASELINES.mem_bandwidth) <= BASELINE_ADJUST_RANGE) {
        newDisplay.mem_bandwidth = newBase;
        adjusted = true;
      }
    } else if (50 + memDev * 50 + METRIC_OFFSETS.Memory_Bandwidth < 2) {
      const newBase = mem_bandwidth_sat * 100 + 10;
      if (Math.abs(newBase - DEFAULT_BASELINES.mem_bandwidth) <= BASELINE_ADJUST_RANGE) {
        newDisplay.mem_bandwidth = newBase;
        adjusted = true;
      }
    }

    // Check TEMP
    const tempDev = (core_temp - DEFAULT_BASELINES.core_temp) / 10;
    if (50 + tempDev * 50 + METRIC_OFFSETS.Core_Temp > 98) {
      const newBase = core_temp - 10;
      if (Math.abs(newBase - DEFAULT_BASELINES.core_temp) <= BASELINE_ADJUST_RANGE) {
        newDisplay.core_temp = newBase;
        adjusted = true;
      }
    } else if (50 + tempDev * 50 + METRIC_OFFSETS.Core_Temp < 2) {
      const newBase = core_temp + 10;
      if (Math.abs(newBase - DEFAULT_BASELINES.core_temp) <= BASELINE_ADJUST_RANGE) {
        newDisplay.core_temp = newBase;
        adjusted = true;
      }
    }

    if (adjusted) {
      setDisplayBaselines(newDisplay);
      displayBaselinesRef.current = newDisplay;
    } else if (displayBaselinesRef.current.gpu_util !== DEFAULT_BASELINES.gpu_util) {
      // Revert to defaults if no clipping
      setDisplayBaselines(DEFAULT_BASELINES);
      displayBaselinesRef.current = DEFAULT_BASELINES;
    }
  }, [currentTelemetry]);

  // Transform functions use auto-adjusted baselines for chart values
  // This ensures we see deviation but with clipping prevention
  const transformGPU = useCallback((value: number) => {
    return toDeviation(value, displayBaselinesRef.current.gpu_util, 15) + METRIC_OFFSETS.GPU_Util;
  }, []);

  const transformMem = useCallback((value: number) => {
    return toDeviation(value, displayBaselinesRef.current.mem_bandwidth, 20) + METRIC_OFFSETS.Memory_Bandwidth;
  }, []);

  const transformTemp = useCallback((value: number) => {
    return toDeviation(value, displayBaselinesRef.current.core_temp, 10) + METRIC_OFFSETS.Core_Temp;
  }, []);

  // Initialize buffers
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    if (hasData && data && data.length > 0) {
      const gpus = data.slice(-NUM_POINTS).map((p) => transformGPU(p.gpu_util));
      const mems = data.slice(-NUM_POINTS).map((p) => transformMem(p.mem_bandwidth_sat * 100));
      const temps = data.slice(-NUM_POINTS).map((p) => transformTemp(p.core_temp));
      setGpuBuffer(gpus);
      setMemBuffer(mems);
      setTempBuffer(temps);
    } else {
      // Start with baseline values
      setGpuBuffer(Array(NUM_POINTS).fill(50));
      setMemBuffer(Array(NUM_POINTS).fill(55));
      setTempBuffer(Array(NUM_POINTS).fill(45));
    }
  }, [initialized, hasData, data, transformGPU, transformMem, transformTemp]);

  // Update buffers at interval
  useEffect(() => {
    if (!initialized) return;

    const intervalId = setInterval(() => {
      // Only use telemetry if ref is set (meaning parent provided it at some point)
      const sourceData = currentTelemetryRef.current || {
        gpu_util: DEFAULT_BASELINES.gpu_util + (Math.random() - 0.5) * 2,
        mem_bandwidth_sat: (DEFAULT_BASELINES.mem_bandwidth / 100) + (Math.random() - 0.5) * 0.02,
        core_temp: DEFAULT_BASELINES.core_temp + (Math.random() - 0.5) * 0.5,
      };

      setGpuBuffer((prev) => {
        const next = [...prev.slice(1), transformGPU(sourceData.gpu_util)];
        return next;
      });
      setMemBuffer((prev) => {
        const next = [...prev.slice(1), transformMem(sourceData.mem_bandwidth_sat * 100)];
        return next;
      });
      setTempBuffer((prev) => {
        const next = [...prev.slice(1), transformTemp(sourceData.core_temp)];
        return next;
      });
    }, 200);

    return () => clearInterval(intervalId);
  }, [initialized, transformGPU, transformMem, transformTemp]);

  // Build chart data from buffers
  const chartData = gpuBuffer.map((gpu, i) => ({
    index: i,
    GPU_Util: gpu,
    Memory_Bandwidth: memBuffer[i] ?? 55,
    Core_Temp: tempBuffer[i] ?? 45,
  }));

  // Visibility state for each metric
  const [visibleMetrics, setVisibleMetrics] = useState({
    GPU_Util: true,
    Memory_Bandwidth: false,
    Core_Temp: false,
  });

  const toggleMetric = (metric: keyof typeof visibleMetrics) => {
    setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  const metricButtons = [
    { key: 'GPU_Util', label: 'GPU', color: '#00ff41', baseKey: 'gpu_util' },
    { key: 'Memory_Bandwidth', label: 'MEM', color: '#ff4444', baseKey: 'mem_bandwidth' },
    { key: 'Core_Temp', label: 'TEMP', color: '#ffb300', baseKey: 'core_temp' },
  ];

  return (
    <div className="w-full border-2 border-orange-500/50 rounded-lg overflow-hidden bg-black/20 p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] monospace text-green-400">
            [07] HISTORIC TELEMETRY STREAM
          </div>
          <div className="text-[10px] monospace text-green-400/70">
            Continuous {windowMs / 1000}s tracking - DEVIATION FROM BASELINE
          </div>
        </div>
        <div className="flex gap-1">
          {metricButtons.map(({ key, label, color }) => {
            const isActive = visibleMetrics[key as keyof typeof visibleMetrics];
            return (
              <button
                key={key}
                onClick={() => toggleMetric(key as keyof typeof visibleMetrics)}
                className={`
                  px-2 py-0.5 text-[9px] font-bold rounded border transition-all
                  ${isActive
                    ? 'opacity-100'
                    : 'opacity-40'
                  }
                `}
                style={{
                  color: color,
                  borderColor: color,
                  backgroundColor: isActive ? `${color}15`: 'transparent',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ width: "100%", height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0, 255, 65, 0.1)"
            />
            <XAxis
              dataKey="index"
              hide={true}
              domain={[0, 99]}
              type="number"
              scale="linear"
            />
            <YAxis hide={true} domain={[0, 100]} />
            <Tooltip
              cursor={{ stroke: 'rgba(0, 255, 65, 0.3)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const p = payload[0]?.payload;
                if (!p) return null;
                // Reverse the transformation using DEFAULT_BASELINES
                const gpuVal = DEFAULT_BASELINES.gpu_util + ((p.GPU_Util - 50 - METRIC_OFFSETS.GPU_Util) / 50) * 15;
                const memVal = DEFAULT_BASELINES.mem_bandwidth + ((p.Memory_Bandwidth - 50 - METRIC_OFFSETS.Memory_Bandwidth) / 50) * 20;
                const tempVal = DEFAULT_BASELINES.core_temp + ((p.Core_Temp - 50 - METRIC_OFFSETS.Core_Temp) / 50) * 10;
                return (
                  <div className="bg-black/90 border border-green-500 rounded px-2 py-1 text-sm monospace">
                    {visibleMetrics.GPU_Util && <div className="text-green-400">GPU: {gpuVal.toFixed(1)}% (base: {displayBaselines.gpu_util}%)</div>}
                    {visibleMetrics.Memory_Bandwidth && <div className="text-red-400">MEM: {memVal.toFixed(1)}% (base: {displayBaselines.mem_bandwidth}%)</div>}
                    {visibleMetrics.Core_Temp && <div className="text-yellow-400">TEMP: {tempVal.toFixed(1)}°C (base: {displayBaselines.core_temp}°C)</div>}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="GPU_Util"
              name="GPU_UTIL"
              stroke="#00ff41"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={visibleMetrics.GPU_Util && { r: 3, fill: "#00ff41" }}
              opacity={visibleMetrics.GPU_Util ? 1 : 0.15}
            />
            <Line
              type="monotone"
              dataKey="Memory_Bandwidth"
              name="MEM_BANDWIDTH"
              stroke="#ff4444"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={visibleMetrics.Memory_Bandwidth && { r: 3, fill: "#ff4444" }}
              opacity={visibleMetrics.Memory_Bandwidth ? 1 : 0.15}
            />
            <Line
              type="monotone"
              dataKey="Core_Temp"
              name="CORE_TEMP"
              stroke="#ffb300"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={visibleMetrics.Core_Temp && { r: 3, fill: "#ffb300" }}
              opacity={visibleMetrics.Core_Temp ? 1 : 0.15}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
