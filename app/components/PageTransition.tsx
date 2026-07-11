'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
    }
  }, [pathname]);

  return (
    <>
      <div className={`transition-container ${isTransitioning ? 'transitioning' : ''}`}>
        {children}
      </div>

      <TransitionOverlay
        isActive={isTransitioning}
        onComplete={() => setIsTransitioning(false)}
      />
    </>
  );
}

interface TransitionOverlayProps {
  isActive: boolean;
  onComplete: () => void;
}

function TransitionOverlay({ isActive, onComplete }: TransitionOverlayProps) {
  const [phase, setPhase] = useState<'idle' | 'scan' | 'pixelate' | 'reveal'>('idle');

  useEffect(() => {
    if (isActive) {
      setPhase('scan');
      const scanTimer = setTimeout(() => setPhase('pixelate'), 150);
      const pixelateTimer = setTimeout(() => setPhase('reveal'), 300);
      const completeTimer = setTimeout(() => {
        setPhase('idle');
        onComplete();
      }, 500);

      return () => {
        clearTimeout(scanTimer);
        clearTimeout(pixelateTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [isActive, onComplete]);

  if (phase === 'idle') return null;

  return (
    <div className={`transition-overlay transition-${phase}`}>
      <div className="scanline" />
      <div className="glitch-bars">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glitch-bar" style={{ animationDelay: `${i * 20}ms` }} />
        ))}
      </div>
      <div className="pixel-grid">
        {Array.from({ length: 64 }).map((_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const delay = (row * 30 + col * 20) % 200;
          return (
            <div
              key={i}
              className="pixel-cell"
              style={{
                animationDelay: `${delay}ms`,
                opacity: phase === 'pixelate' ? 1 : 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// Hook to trigger transitions externally
export function usePageTransition() {
  const [trigger, setTrigger] = useState(0);

  const startTransition = (callback: () => void) => {
    setTrigger((t) => t + 1);
    setTimeout(callback, 300);
  };

  return { trigger, startTransition };
}

// CSS styles - inject via globals.css or styled-jsx
const transitionStyles = `
.transition-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  background: #0a0a0a;
}

.transition-overlay.transition-scan {
  animation: terminal-scan 200ms ease-out forwards;
}

.transition-overlay.transition-pixelate {
  animation: pixelate-in 200ms ease-in forwards;
}

.transition-overlay.transition-reveal {
  animation: reveal-out 200ms ease-out forwards;
}

.scanline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(0, 255, 65, 0.8),
    transparent
  );
  animation: scanline-move 150ms linear;
  box-shadow: 0 0 20px rgba(0, 255, 65, 0.5);
}

@keyframes scanline-move {
  0% { top: 0; }
  100% { top: 100%; }
}

.glitch-bars {
  position: absolute;
  inset: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.glitch-bar {
  width: 12.5%;
  height: 100%;
  background: rgba(0, 255, 65, 0.1);
  animation: glitch-flash 100ms steps(2) infinite;
}

@keyframes glitch-flash {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; background: rgba(0, 255, 65, 0.3); }
}

.pixel-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  gap: 1px;
}

.pixel-cell {
  background: #00ff41;
  transition: opacity 100ms steps(4);
}

.pixel-cell:nth-child(odd) {
  background: #0a0a0a;
}

@keyframes terminal-scan {
  0% { clip-path: inset(0 0 100% 0); }
  50% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(100% 0 0 0); }
}

@keyframes pixelate-in {
  0% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    filter: pixelate(0);
  }
  100% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    filter: pixelate(1);
  }
}

@keyframes reveal-out {
  0% {
    opacity: 1;
    clip-path: inset(45% 45% 45% 45%);
  }
  50% {
    clip-path: inset(0 0 0 0);
    opacity: 1;
  }
  100% {
    clip-path: inset(0 0 0 0);
    opacity: 0;
  }
}

.transition-container.transitioning {
  animation: content-glitch 300ms steps(3);
}

@keyframes content-glitch {
  0%, 100% { transform: translateX(0); filter: none; }
  20% { transform: translateX(-2px); filter: hue-rotate(90deg); }
  40% { transform: translateX(2px); filter: hue-rotate(-90deg); }
  60% { transform: translateX(-1px); filter: saturate(2); }
  80% { transform: translateX(1px); filter: saturate(0.5); }
}
`;

// Inject styles on mount
if (typeof document !== 'undefined') {
  const styleId = 'page-transition-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = transitionStyles;
    document.head.appendChild(styleEl);
  }
}

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathname.current !== null && previousPathname.current !== pathname) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 600);
      previousPathname.current = pathname;
      return () => clearTimeout(timer);
    }
    previousPathname.current = pathname;
  }, [pathname]);

  return (
    <>
      {children}
      {isTransitioning && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div className="absolute inset-0 bg-[#0a0a0a] animate-scan-reveal">
            <div className="scan-line" />
          </div>
          <div className="absolute inset-0 animate-pixelate-reveal">
            {Array.from({ length: 64 }).map((_, i) => (
              <div
                key={i}
                className="absolute bg-[#00ff41]"
                style={{
                  left: `${(i % 8) * 12.5}%`,
                  top: `${Math.floor(i / 8) * 12.5}%`,
                  width: '12.5%',
                  height: '12.5%',
                  animationDelay: `${(i % 8) * 30 + Math.floor(i / 8) * 20}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}