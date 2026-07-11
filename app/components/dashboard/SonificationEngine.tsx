'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../../hooks/useSound';

interface SonificationEngineProps {
  telemetry?: {
    mem_bandwidth_sat?: number;
    gpu_util?: number;
    state?: 'applying_solution' | 'verifying' | 'healthy' | 'memory_bound' | 'comms_bound' | 'recovery';
  };
}

export default function SonificationEngine({ telemetry = {} }: SonificationEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentState, setCurrentState] = useState<string>('healthy');
  const [volume, setVolume] = useState(50);
  const { playSound } = useSound();

  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Update state based on telemetry
    if (telemetry.state) {
      setCurrentState(telemetry.state);
      startSonification();
    }
  }, [telemetry.state]);

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
    timeRef.current += 0.05; // Increment time for scrolling effect
    
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteTimeDomainData(dataArray);
      drawWaveform(dataArray);
    } else {
      drawWaveform();
    }

    animationRef.current = requestAnimationFrame(animate);
  };

  const startSonification = async () => {
    // Stop existing audio
    stopSonification();

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create multiple oscillators for richer sound
      const oscillators: OscillatorNode[] = [];
      const gainNodes: GainNode[] = [];
      
      // Primary oscillator (triangle wave for smooth sound)
      const osc1 = audioContextRef.current.createOscillator();
      osc1.type = 'sine';
      oscillators.push(osc1);
      
      // Secondary oscillator (harmonic)
      const osc2 = audioContextRef.current.createOscillator();
      osc2.type = 'sine';
      oscillators.push(osc2);
      
      // Create gain nodes for volume control
      const gain1 = audioContextRef.current.createGain();
      const gain2 = audioContextRef.current.createGain();
      gainNodes.push(gain1, gain2);
      
      // Set harmonic relationship
      osc2.frequency.setValueAtTime(2, audioContextRef.current.currentTime); // Will be scaled
      
      // Set volumes
      gain1.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
      gain2.gain.setValueAtTime(0.15, audioContextRef.current.currentTime);
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      
      // Create master gain for volume control
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.gain.setValueAtTime(volume / 100, audioContextRef.current.currentTime);
      
      // Connect nodes
      osc1.connect(gain1);
      gain1.connect(analyserRef.current);
      osc2.connect(gain2);
      gain2.connect(analyserRef.current);
      analyserRef.current.connect(masterGainRef.current);
      masterGainRef.current.connect(audioContextRef.current.destination);
      
      // Store references
      oscillatorRef.current = osc1;
      
      // Start animation
      animate();
      
      // Start oscillators
      oscillators.forEach(osc => osc.start());
      
      setIsPlaying(true);

    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  };

  const stopSonification = () => {
    // Stop all oscillators
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (e) {
        // Already stopped
      }
      oscillatorRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Already closed
      }
      audioContextRef.current = null;
    }
    
    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setIsPlaying(false);
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
              onChange={(e) => {
                const newVolume = parseInt(e.target.value);
                setVolume(newVolume);
                if (masterGainRef.current && audioContextRef.current) {
                  masterGainRef.current.gain.setValueAtTime(
                    newVolume / 100,
                    audioContextRef.current.currentTime
                  );
                }
              }}
              className="w-24 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <span className="font-mono text-xs text-zinc-400 w-8">{volume}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}