'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  frequency: number;
}

export default function AudioVisualizer({ isPlaying, frequency }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Draw waveform
      if (isPlaying) {
        ctx.strokeStyle = frequency > 200 ? '#ff4444' : '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const amplitude = height * 0.35;
        const centerY = height / 2;
        const cycles = 3;

        for (let x = 0; x < width; x++) {
          const normalizedX = x / width;
          const y = centerY + Math.sin(normalizedX * Math.PI * 2 * cycles + phaseRef.current) * amplitude;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Update phase
        phaseRef.current += 0.15;
      } else {
        // Draw flat line when not playing
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, frequency]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={200}
      className="border border-green-800 rounded bg-black"
    />
  );
}