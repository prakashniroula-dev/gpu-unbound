'use client';

interface Counter {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}

interface IndexCountersProps {
  counters?: Counter[];
}

export default function IndexCounters({ counters = [] }: IndexCountersProps) {
  const defaultCounters = [
    { label: 'CORE INDEX', value: '98', unit: '%', color: 'text-green-500' },
    { label: 'LATENCY', value: '0.042', unit: 'ms', color: 'text-cyan-500' },
    { label: 'THERMAL', value: '71', unit: '°C', color: 'text-orange-500' },
  ];

  const allCounters = [...defaultCounters, ...counters];

  return (
    <div className="grid grid-cols-3 gap-4">
      {allCounters.map((counter, index) => (
        <div
          key={index}
          className="p-4 border border-current/30 rounded-lg bg-current/5"
          style={{ '--tw-border-opacity': '0.3', '--tw-bg-opacity': '0.05' } as React.CSSProperties}
        >
          <div className="text-xs font-mono text-zinc-400 mb-1">{counter.label}</div>
          <div className={`text-2xl font-bold font-mono ${counter.color || 'text-green-500'}`}>
            {counter.value}{counter.unit && <span className="text-sm">{counter.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}