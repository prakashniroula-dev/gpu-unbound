'use client';

import { useState } from 'react';
import HeroBanner from '../components/landing/HeroBanner';
import OAuthButtons from '../components/landing/OAuthButtons';
import ClusterHookForm from '../components/landing/ClusterHookForm';

export default function SignInPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] text-white">
      <HeroBanner />
      
      <main className="flex-1 w-full py-16 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-green-500 leading-tight">
              ENTER THE BLACKBOX
            </h2>
            <p className="text-xl text-zinc-400 mt-4">
              Connect your GPU cluster to begin monitoring
            </p>
          </div>

          {/* OAuth Buttons or Cluster Form */}
          <div className="max-w-2xl mx-auto">
            {showForm ? (
              <ClusterHookForm />
            ) : (
              <OAuthButtons />
            )}
          </div>

          {/* Toggle */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-2 border border-zinc-700 rounded-lg font-mono text-zinc-400 hover:border-green-500 hover:text-green-500 transition-all"
            >
              {showForm ? '[ BACK TO OAUTH ]' : '[ USE PROTOTYPE MODE ]'}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 border-t border-green-500/30">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="font-mono text-green-500/60 text-sm">
            BLACKBOX_AI // ROCM.V6 &bull; SECURE CONNECTION &bull; v.4.2.1
          </p>
        </div>
      </footer>
    </div>
  );
}