'use client';

import { useState, useCallback } from 'react';
import { useLandingSounds } from '../../hooks/useSound';

const PROVIDERS = [
  { name: 'AMD Cloud', logo: 'AMD', color: 'from-red-600 to-orange-500' },
  { name: 'AWS', logo: 'AWS', color: 'from-orange-500 to-yellow-400' },
  { name: 'GCP', logo: 'GCP', color: 'from-blue-500 to-cyan-400' },
];

export default function OAuthButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  const { playTransitionSound } = useLandingSounds();

  const handleSignIn = async (provider: string) => {
    playTransitionSound();
    setLoading(provider);

    console.log(`Attempting sign-in with ${provider}`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    setLoading(null);
  };

  const handlePrototypeMode = () => {
    playTransitionSound();
    const event = new CustomEvent('showClusterForm', {
      detail: { prototypeMode: true }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-4">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.name}
            onClick={() => handleSignIn(provider.name)}
            disabled={loading === provider.name}
            className={`
              w-full py-4 px-6 rounded-lg font-mono text-lg tracking-wider border-2
              transition-all duration-300 btn-click-effect
              ${loading === provider.name
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-[1.02] hover:shadow-lg hover:shadow-green-500/20'
              }
              bg-gradient-to-r ${provider.color}
              border-transparent
              text-white
              shadow-md
            `}
          >
            <span className="flex items-center justify-center gap-4">
              <span className="w-8 h-8 bg-white/20 rounded flex items-center justify-center font-bold">
                {provider.logo}
              </span>
              <span>Sign in with {provider.name}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-zinc-400 text-sm font-mono">
          OR USE PROTOTYPE MODE
        </p>
        <button
          onClick={handlePrototypeMode}
          className="mt-4 px-8 py-3 border-2 border-zinc-600 rounded-lg font-mono text-zinc-400 hover:border-green-500 hover:text-green-500 transition-all btn-click-effect btn-bracket"
        >
          [ ENTER CLUSTER KEY ]
        </button>
      </div>
    </div>
  );
}