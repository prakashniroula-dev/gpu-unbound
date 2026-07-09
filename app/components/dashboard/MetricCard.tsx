'use client';

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  color?: string;
  anomaly?: boolean;
}

export default function MetricCard({
  label,
  value,
  unit,
  color = 'text-green-500',
  anomaly = false,
}: MetricCardProps) {
  return (
    <div
      className={`p-3 border rounded transition-all ${
        anomaly
          ? 'border-red-500 bg-red-500/10 animate-pulse'
          : 'border-current/30 bg-current/5'
      }`}
      style={{ '--tw-border-opacity': anomaly ? '1' : '0.3', '--tw-bg-opacity': '0.05' } as React.CSSProperties}
    >
      <div className="text-xs font-mono text-zinc-400 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${anomaly ? 'text-red-500' : color}`}>
        {unit === '%' ? value.toFixed(0) : value.toFixed(1)} <span className="text-xs">{unit}</span>
      </div>
    </div>
  );
}