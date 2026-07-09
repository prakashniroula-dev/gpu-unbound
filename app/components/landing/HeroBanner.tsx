'use client';

import { useEffect, useRef } from 'react';

export default function HeroBanner() {
  return (
    <div className="w-full py-8 border-b border-green-500/30">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-3xl font-mono text-green-500 tracking-wider">
          GPU_UNBOUND // TERMINAL_V1
        </h1>
      </div>
    </div>
  );
}