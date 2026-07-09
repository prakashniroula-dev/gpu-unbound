'use client';

import { useState, useRef, useEffect } from 'react';
import AudioVisualizer from './AudioVisualizer';

export default function AudioTestButton() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(130);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const playTone = async () => {
    if (isPlaying) {
      stopTone();
      return;
    }

    // Create AudioContext on user gesture
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator
    oscillatorRef.current = audioContextRef.current.createOscillator();
    gainNodeRef.current = audioContextRef.current.createGain();

    // Configure oscillator
    oscillatorRef.current.type = 'triangle';
    oscillatorRef.current.frequency.setValueAtTime(130, audioContextRef.current.currentTime);
    setFrequency(130);

    // Configure gain (volume)
    gainNodeRef.current.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);

    // Connect nodes
    oscillatorRef.current.connect(gainNodeRef.current);
    gainNodeRef.current.connect(audioContextRef.current.destination);

    // Start oscillator
    oscillatorRef.current.start();
    setIsPlaying(true);

    // Auto-stop after 2 seconds for demo
    setTimeout(() => {
      stopTone();
    }, 2000);
  };

  const stopTone = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
    setFrequency(130);
  };

  const simulateDistress = () => {
    if (!isPlaying && audioContextRef.current) {
      // Switch to distress frequency
      if (oscillatorRef.current) {
        oscillatorRef.current.frequency.setValueAtTime(520, audioContextRef.current.currentTime);
        setFrequency(520);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <AudioVisualizer isPlaying={isPlaying} frequency={frequency} />
      
      <div className="flex gap-3">
        <button
          onClick={playTone}
          className={`px-6 py-3 font-mono text-sm font-bold tracking-wider border-2 transition-all duration-200 ${
            isPlaying
              ? 'bg-red-500 border-red-500 text-black animate-pulse'
              : 'bg-green-900 border-green-500 text-green-400 hover:bg-green-800 hover:border-green-400'
          }`}
        >
          [ {isPlaying ? 'STOP AUDIO' : 'TEST AUDIO CAPABILITY'} ]
        </button>
        
        <button
          onClick={simulateDistress}
          disabled={isPlaying}
          className="px-6 py-3 font-mono text-sm font-bold tracking-wider border-2 border-yellow-600 text-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-900 hover:border-yellow-500 transition-all duration-200"
        >
          [ SIMULATE DISTRESS ]
        </button>
      </div>

      <div className="font-mono text-xs text-green-600 mt-2">
        {isPlaying ? (
          <span>
            STATUS: ACTIVE // FREQUENCY: {frequency}Hz // WAVEFORM: TRIANGLE
          </span>
        ) : (
          <span>
            STATUS: STANDBY // FREQUENCY: {frequency}Hz // AWAITING INPUT
          </span>
        )}
      </div>
    </div>
  );
}