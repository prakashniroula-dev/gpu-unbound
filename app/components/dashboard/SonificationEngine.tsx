'use client';

import { useEffect, useRef, useState } from 'react';
import { useSound } from '../../hooks/useSound';

interface SonificationEngineProps {
  telemetry?: {
    mem_bandwidth_sat?: number;
    gpu_util?: number;
    state?: 'applying_solution' | 'verifying' | 'healthy' | 'memory_bound' | 'comms_bound' | 'recovery';
  };
}

const STATE_FREQUENCIES: Record<string, number> = {
  healthy: 131.1,
  applying_solution: 165.0,
  verifying: 147.0,
  memory_bound: 220.0,
  comms_bound: 98.0,
  recovery: 140.0,
};

function getTargetFrequency(state: string, memSat: number): number {
  const baseFreq = STATE_FREQUENCIES[state] || 131.1;
  return baseFreq + memSat * 1.5;
}

function volumeToGain(volume: number): number {
  const normalized = volume / 100;
  return Math.pow(normalized, 2.5) * 0.5;
}

export default function SonificationEngine({ telemetry = {} }: SonificationEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentState, setCurrentState] = useState<string>('healthy');
  const [volume, setVolume] = useState(50);
  const { playSound } = useSound();

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const drawWaveform = (data: Uint8Array | null = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.1)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw waveform based on state
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const state = telemetry.state || currentState;
    const memSat = telemetry.mem_bandwidth_sat || 0;
    
    
    // Calculate target frequency: f = 130Hz + (mem_bandwidth_sat × 1.5)
    const targetFreq = 130 + (memSat * 1.5);
    
    for (let x = 0; x < width; x++) {
      let frequency = targetFreq;
      let amplitude = 40;
      
      // Modify based on state
      if (state === 'memory_bound') {
        frequency = targetFreq + (Math.random() - 0.5) * 10; // Jitter
        amplitude = 60;
        ctx.strokeStyle = '#ff4444'; // Red for anomaly
      } else if (state === 'comms_bound') {
        frequency = 50 + (Math.random() - 0.5) * 10; // Lower frequency
        amplitude = 30;
        ctx.strokeStyle = '#ffb300'; // Orange for comms issues
      } else if (state === 'recovery') {
        // Smooth transition back
        frequency = 130 + (memSat * 1.5 * 0.5) ;
        amplitude = 40;
        ctx.strokeStyle = '#00ff41';
      }
      
      const y = height / 2 + Math.sin((x * 0.05 * (frequency / 130)) + timeRef.current) * amplitude;
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw state label with transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, height - 32, 240, 40);
    
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = '14px monospace';
    ctx.fillText(`> STATE: ${state.toUpperCase()}`, 8, height - 8);
    ctx.fillText(`> FREQ: ${targetFreq.toFixed(1)}Hz`, 8, height - 20);
  };

  const animate = () => {
    timeRef.current += 0.05;
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteTimeDomainData(dataArray);
      drawWaveform(dataArray);
    } else {
      drawWaveform();
    }
    animationRef.current = requestAnimationFrame(animate);
  };

  const smoothFrequencyTransition = (targetFreq: number) => {
    if (!audioContextRef.current || oscillatorsRef.current.length === 0) return;
    const now = audioContextRef.current.currentTime;
    const rampDuration = 0.25;
    oscillatorsRef.current.forEach((osc) => {
      osc.frequency.linearRampToValueAtTime(targetFreq, now + rampDuration);
    });
    if (filterRef.current) {
      filterRef.current.frequency.linearRampToValueAtTime(
        Math.min(targetFreq * 3, 800),
        now + rampDuration
      );
    }
  };

  useEffect(() => {
    if (telemetry.state) {
      setCurrentState(telemetry.state);
      if (!isPlaying) {
        startSonification();
      }
    }
  }, [telemetry.state]);

  useEffect(() => {
    if (telemetry.state && isPlaying) {
      const newFreq = getTargetFrequency(telemetry.state, telemetry.mem_bandwidth_sat || 0);
      smoothFrequencyTransition(newFreq);
    }
  }, [telemetry.state, telemetry.mem_bandwidth_sat, isPlaying]);

  const startSonification = async () => {
    if (isPlaying) return;

    try {
      const ctx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;

      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 2048;

      filterRef.current = ctx.createBiquadFilter();
      filterRef.current.type = 'lowpass';
      filterRef.current.frequency.setValueAtTime(500, ctx.currentTime);
      filterRef.current.Q.setValueAtTime(1.0, ctx.currentTime);

      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.setValueAtTime(0, ctx.currentTime);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(volumeToGain(volume) * 0.03, ctx.currentTime);
      lfoGainRef.current = lfoGain;

      const baseFreq = getTargetFrequency(currentState, telemetry.mem_bandwidth_sat || 0);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.005, ctx.currentTime);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(baseFreq * 0.995, ctx.currentTime);

      oscillatorsRef.current = [osc1, osc2, osc3];

      osc1.connect(filterRef.current);
      osc2.connect(filterRef.current);
      osc3.connect(filterRef.current);

      filterRef.current.connect(lfoGain);
      lfoGain.connect(masterGainRef.current);

      masterGainRef.current.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.2, ctx.currentTime);

      const lfoModGain = ctx.createGain();
      lfoModGain.gain.setValueAtTime(volumeToGain(volume) * 0.04, ctx.currentTime);

      lfo.connect(lfoModGain);
      lfoModGain.connect(masterGainRef.current.gain);

      oscillatorsRef.current.forEach((osc) => osc.start());
      lfo.start();

      animate();

      const rampDuration = 0.25;
      masterGainRef.current.gain.linearRampToValueAtTime(
        volumeToGain(volume),
        ctx.currentTime + rampDuration
      );

      setIsPlaying(true);
    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  };

  const stopSonification = () => {
    if (!isPlaying && !audioContextRef.current) return;

    if (masterGainRef.current && audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      masterGainRef.current.gain.linearRampToValueAtTime(0, now + 0.25);
    }

    setTimeout(() => {
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (_e) {}
      });
      oscillatorsRef.current = [];

      if (lfoGainRef.current) {
        try {
          lfoGainRef.current.disconnect();
        } catch (_e) {}
        lfoGainRef.current = null;
      }

      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (_e) {}
        audioContextRef.current = null;
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      setIsPlaying(false);
    }, 300);
  };

const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (masterGainRef.current && audioContextRef.current) {
      const targetGain = volumeToGain(newVolume);
      const now = audioContextRef.current.currentTime;
      masterGainRef.current.gain.linearRampToValueAtTime(targetGain, now + 0.1);
      if (lfoGainRef.current) {
        lfoGainRef.current.gain.linearRampToValueAtTime(
          targetGain * 0.03,
          now + 0.1
        );
      }
    }
  };

  const stateClass = telemetry.state ? `state-${telemetry.state}` : `state-${currentState}`;

  return (
    <div className={`w-full h-full border-2 border-green-500/50 rounded-lg overflow-hidden waveform-panel ${stateClass}`}>
      <div className="p-4 border-b border-green-500/30">
        <h3 className="text-lg font-mono text-green-500">
          [01] SONIFICATION_ENGINE
        </h3>
        <p className="text-sm text-zinc-400">
          Real-time waveform monitor
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={1200}
        height={120}
        className="w-full bg-black/20"
      />

      <div className="p-3 border-t border-green-500/30">
        <div className="flex gap-2">
          <button
            onClick={() => {
              playSound('click');
              isPlaying ? stopSonification() : startSonification();
            }}
            className={`px-4 py-2 font-mono text-sm border-2 rounded btn-click-effect ${
              isPlaying
                ? 'border-red-500 text-red-500 btn-stop'
                : 'border-green-500 text-green-500 hover:bg-green-500/10'
            }`}
          >
            {isPlaying ? '[ STOP ]' : '[ START ]'}
          </button>

          <span className="px-4 py-2 font-mono text-sm text-zinc-400">
            {currentState.toUpperCase()}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <span className="font-mono text-xs text-zinc-500">VOL</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="w-24 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <span className="font-mono text-xs text-zinc-400 w-8">{volume}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}