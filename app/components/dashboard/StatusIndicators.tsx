'use client';

interface StatusTag {
  label: string;
  color?: string;
}

interface StatusIndicatorsProps {
  tags?: StatusTag[];
}

export default function StatusIndicators({ tags = [] }: StatusIndicatorsProps) {
  const defaultTags = [
    { label: 'ROCm API ONLINE', color: 'text-green-500' },
    { label: 'COMPUTE ACTIVE', color: 'text-cyan-500' },
    { label: 'ROCm v4.2.1', color: 'text-zinc-400' },
  ];

  const allTags = [...defaultTags, ...tags];

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {allTags.map((tag, index) => (
        <span
          key={index}
          className={`px-3 py-1.5 border border-current/30 rounded font-mono text-xs ${tag.color || 'text-green-500'}`}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}