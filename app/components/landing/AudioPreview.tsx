'use client';

import { useState, useRef, useEffect } from 'react';

export default function AudioPreview() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioMode, setAudioMode] = useState<'healthy' | 'anomaly'>('healthy');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Draw static waveform on canvas
    drawWaveform(new Uint8Array());
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const drawWaveform = (data: Uint8Array) => {
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
    
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (data.length === 0) {
      // Draw static sine waveform (healthy baseline)
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        // Sine wave with 130Hz frequency representation
        const y = height / 2 + Math.sin(x * 0.05) * 30;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = '#00ff41';
      ctx.font = '14px monospace';
      ctx.fillText('> PREVIEW: 130Hz HEALTHY_STATE (TRIANGLE)', 20, height - 20);
    } else {
      // Draw live waveform
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const sliceWidth = width / data.length;
      let x = 0;
      
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }
  };

  const animate = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);
    drawWaveform(dataArray);

    animationRef.current = requestAnimationFrame(animate);
  };

  const testAudio = async () => {
    if (isPlaying) return;

    setIsPlaying(true);
    
    try {
      // Create AudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create oscillators - triangle waves for softer sonification
      oscillatorRef.current = audioContextRef.current.createOscillator();
      oscillatorRef.current.type = 'triangle';
      oscillatorRef.current.frequency.setValueAtTime(130, audioContextRef.current.currentTime);
      
      // Create analyser for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      
      // Connect nodes
      oscillatorRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      
      // Start animation
      animate();
      
      // Start oscillator
      oscillatorRef.current.start();
      
      // Stop after 2 seconds
      setTimeout(() => {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        setIsPlaying(false);
        drawWaveform(new Uint8Array()); // Return to static waveform
      }, 2000);
      
    } catch (error) {
      console.error('Audio test failed:', error);
      setIsPlaying(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full border border-green-500/50 rounded"
      />
      
      <button
        onClick={testAudio}
        disabled={isPlaying}
        className={`
          mt-6 px-8 py-4 font-mono text-lg tracking-wider border-2 transition-all
          ${isPlaying 
            ? 'border-green-500/30 text-green-500/30 cursor-not-allowed' 
            : 'border-green-500 text-green-500 hover:bg-green-500/10 hover:scale-105'
          }
        `}
      >
        {isPlaying ? '[ PLAYING... ]' : '[ TEST AUDIO CAPABILITY ]'}
      </button>
      
      <div className="mt-4 text-center">
        <p className="text-green-500/60 font-mono text-sm">
          {isPlaying ? '>> EMITTING: 130Hz_TRIANGLE_BASELINE' : '>> STATUS: STANDBY'}
        </p>
      </div>
    </div>
  );
}