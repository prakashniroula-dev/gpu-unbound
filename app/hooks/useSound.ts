/**
 * Sound Effect Utility Hook
 * GPU_UNBOUND ROCm Telemetry Monitor - Audio System
 *
 * TRIGGER MAPPING:
 * - change.mp3      : Phase/index change (switching fault injection targets/bound)
 * - click.mp3      : Generic button clicks (Sign In, Establish Connection, Stop, Auto Mode, etc.)
 * - failed.mp3     : Fault injection reaches "failed" state (state !== "healthy" && status is error)
 * - processing.mp3 : Loops during active fault injection (non-healthy, non-failed states)
 * - success.mp3    : System transitions from non-healthy back to "healthy"
 * - ui_element_button_click.mp3 : Landing/sign-in page buttons + page transition cue
 *
 * All sounds respect global volume. processing.mp3 uses a single persistent Audio element
 * to prevent overlapping loops and memory leaks.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export type SoundType = 'change' | 'click' | 'failed' | 'processing' | 'success' | 'ui_click';

interface SoundConfig {
  change: string;
  click: string;
  failed: string;
  processing: string;
  success: string;
  ui_click: string;
}

const SOUND_FILES: SoundConfig = {
  change: '/sounds/change.mp3',
  click: '/sounds/click.mp3',
  failed: '/sounds/failed.mp3',
  processing: '/sounds/processing.mp3',
  success: '/sounds/success.mp3',
  ui_click: '/sounds/ui_element_button_click.mp3',
};

interface UseSoundReturn {
  playSound: (type: SoundType) => void;
  startProcessingLoop: () => void;
  stopProcessingLoop: () => void;
  volume: number;
  setVolume: (v: number) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isProcessingPlaying: boolean;
}

export function useSound(): UseSoundReturn {
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    change: null,
    click: null,
    failed: null,
    processing: null,
    success: null,
    ui_click: null,
  });

  const processingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolumeState] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isProcessingPlaying, setIsProcessingPlaying] = useState(false);

  // Preload all sounds on mount
  useEffect(() => {
    const loadSounds = () => {
      (Object.keys(SOUND_FILES) as SoundType[]).forEach((key) => {
        const audio = new Audio();
        audio.src = SOUND_FILES[key];
        audio.preload = 'auto';
        audioRefs.current[key] = audio;
      });

      // Create persistent processing audio (separate to control loop independently)
      const processingAudio = new Audio();
      processingAudio.src = SOUND_FILES.processing;
      processingAudio.loop = true;
      processingAudio.preload = 'auto';
      processingAudioRef.current = processingAudio;
    };

    loadSounds();

    return () => {
      // Cleanup on unmount
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      if (processingAudioRef.current) {
        processingAudioRef.current.pause();
        processingAudioRef.current.src = '';
      }
    };
  }, []);

  // Apply volume changes
  useEffect(() => {
    const applyVolume = () => {
      const vol = isMuted ? 0 : volume;
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) audio.volume = vol;
      });
      if (processingAudioRef.current) {
        processingAudioRef.current.volume = vol;
      }
    };
    applyVolume();
  }, [volume, isMuted]);

  const playSound = useCallback((type: SoundType) => {
    const audio = audioRefs.current[type];
    if (!audio) return;

    // Reset and play for non-looping sounds
    audio.currentTime = 0;
    audio.play().catch((err) => {
      // Ignore autoplay errors - sounds are triggered by user interaction
      if (err.name !== 'AbortError') {
        console.warn(`Sound ${type} play failed:`, err.message);
      }
    });
  }, []);

  const startProcessingLoop = useCallback(() => {
    if (processingAudioRef.current && !isProcessingPlaying) {
      processingAudioRef.current.currentTime = 0;
      processingAudioRef.current.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Processing loop play failed:', err.message);
        }
      });
      setIsProcessingPlaying(true);
    }
  }, [isProcessingPlaying]);

  const stopProcessingLoop = useCallback(() => {
    if (processingAudioRef.current && isProcessingPlaying) {
      processingAudioRef.current.pause();
      processingAudioRef.current.currentTime = 0;
      setIsProcessingPlaying(false);
    }
  }, [isProcessingPlaying]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return {
    playSound,
    startProcessingLoop,
    stopProcessingLoop,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isProcessingPlaying,
  };
}

// Separate hook to track state transitions and fire appropriate sounds
export function useFaultInjectionSounds(
  currentState: string,
  previousStateRef: React.MutableRefObject<string>
) {
  const { playSound, startProcessingLoop, stopProcessingLoop, isProcessingPlaying } = useSound();

  useEffect(() => {
    const prevState = previousStateRef.current;
    const newState = currentState;

    // Skip if state hasn't changed
    if (prevState === newState) return;

    // Handle state transitions
    if (newState === 'healthy') {
      // Transition to healthy - play success and stop processing
      if (prevState !== 'healthy' && prevState !== '') {
        playSound('success');
      }
      if (isProcessingPlaying) {
        stopProcessingLoop();
      }
    } else if (newState === 'memory_bound' || newState === 'comms_bound') {
      // Fault just injected - start processing loop
      if (prevState === 'healthy') {
        startProcessingLoop();
      }
    } else if (newState === 'recovery' || newState === 'verifying' || newState === 'applying_solution') {
      // During recovery process - keep processing loop running
      if (!isProcessingPlaying && prevState !== 'healthy') {
        startProcessingLoop();
      }
    }

    // Update previous state ref
    previousStateRef.current = newState;
  }, [currentState, previousStateRef, playSound, startProcessingLoop, stopProcessingLoop, isProcessingPlaying]);

  return { playSound };
}

// Hook for dashboard button click sounds
export function useDashboardSounds() {
  const { playSound } = useSound();
  const debounceRef = useRef<Record<string, number>>({});

  const playClickSound = useCallback(() => {
    playSound('click');
  }, [playSound]);

  const playChangeSound = useCallback(() => {
    playSound('change');
  }, [playSound]);

  const debouncedClick = useCallback((key: string) => {
    const now = Date.now();
    if (!debounceRef.current[key] || now - debounceRef.current[key] > 200) {
      debounceRef.current[key] = now;
      playSound('click');
    }
  }, [playSound]);

  return { playClickSound, playChangeSound, debouncedClick };
}

// Hook for landing page sounds
export function useLandingSounds() {
  const { playSound } = useSound();

  const playTransitionSound = useCallback(() => {
    playSound('ui_click');
  }, [playSound]);

  return { playTransitionSound };
}