'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

interface TimelineEvent {
  type: 'DETECTED' | 'ANALYSIS' | 'VERIFICATION' | 'SOLUTION' | 'RECOVERED';
  timestamp: number;
  message: string;
}

const eventColors = {
  DETECTED: 'text-red-500 border-red-500',
  ANALYSIS: 'text-yellow-500 border-yellow-500',
  VERIFICATION: 'text-blue-500 border-blue-500',
  SOLUTION: 'text-purple-500 border-purple-500',
  RECOVERED: 'text-green-500 border-green-500',
};

const eventSymbols = {
  DETECTED: '●',
  ANALYSIS: '◆',
  VERIFICATION: '◈',
  SOLUTION: '▲',
  RECOVERED: '✓',
};

interface RootCauseTimelineProps {
  events?: TimelineEvent[];
}

export default function RootCauseTimeline({ events = [] }: RootCauseTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const allEvents = useMemo(() => {
    return [...events].sort((a, b) => a.timestamp - b.timestamp)
  }, [events]);

  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allEvents, isCollapsed]);

  return (
    <div className="w-full border border-purple-500/50 rounded-lg overflow-hidden">
      <div 
        className="p-3 border-b border-purple-500/30 flex items-center justify-between cursor-pointer hover:bg-purple-500/5"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div>
          <h3 className="text-sm font-mono text-purple-500">
            EVENT TIMELINE
          </h3>
          <p className="text-xs text-zinc-500">
            Detect → Diagnose → Act → Verify
          </p>
        </div>
        <span className="text-purple-500 text-xs">{isCollapsed ? '[ + ]' : '[ - ]'}</span>
      </div>
      
      {!isCollapsed && (
        <div className="p-3 h-80 bg-black/20 overflow-y-auto" ref={scrollRef}>
          {allEvents.length === 0 ? (
            <div className="text-center text-zinc-600 py-8">
              <p className="font-mono text-xs"> {'>'} No events recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allEvents.map((event, index) => {
                const colorClass = eventColors[event.type];
                const symbol = eventSymbols[event.type];
                const time = new Date(event.timestamp).toLocaleTimeString();
                
                return (
                  <div
                    key={index}
                    className={`p-2 border-l-2 ${colorClass} bg-current/5 timeline-entry`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-2">
                      <span className={colorClass}>{symbol}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs ${colorClass}`}>
                            {event.type}
                          </span>
                          <span className="font-mono text-xs text-zinc-500">
                            {time}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-zinc-400 mt-0.5">
                          {event.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}