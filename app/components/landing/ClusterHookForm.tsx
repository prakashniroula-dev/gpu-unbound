'use client';

import { useState, useEffect } from 'react';
import { useSound } from '../../hooks/useSound';

const CLUSTER_PROFILES = [
  { id: 'amd_cloud_sandbox', name: 'AMD Cloud Sandbox' },
  { id: 'on_premise_rack', name: 'On-Premise Server Rack' },
  { id: 'aws_gpu_cluster', name: 'AWS GPU Cluster' },
  { id: 'gcp_ai_platform', name: 'GCP AI Platform' },
];

export default function ClusterHookForm() {
  const [jobId, setJobId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [profile, setProfile] = useState<string>(CLUSTER_PROFILES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { playSound } = useSound();

  useEffect(() => {
    const handleShow = () => {
      // Scroll to form when triggered
      const form = document.getElementById('cluster-hook-form');
      form?.scrollIntoView({ behavior: 'smooth' });
    };
    
    window.addEventListener('showClusterForm', handleShow as EventListener);
    return () => window.removeEventListener('showClusterForm', handleShow as EventListener);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!jobId || !apiKey) {
      setError('JOB_ID and API_KEY are required');
      return;
    }

    try {
      // For prototype mode, we validate against BLACKBOX_API_KEY env var
      // In production: validate via actual auth API
      const response = await fetch('/api/auth/prototype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, apiKey, profile }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      
      if (data.valid) {
        setSuccess(true);
        // Store in localStorage for prototype mode
        localStorage.setItem('blackbox_jobId', jobId);
        localStorage.setItem('blackbox_profile', profile);
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      // Fallback: In pure prototype mode, accept any non-empty values
      const PROTOTYPE_API_KEY = process.env.NEXT_PUBLIC_BLACKBOX_API_KEY || 'PROTOTYPE_KEY';
      
      if (apiKey === PROTOTYPE_API_KEY || apiKey === 'PROTOTYPE_KEY' || apiKey === 'test') {
        setSuccess(true);
        localStorage.setItem('blackbox_jobId', jobId);
        localStorage.setItem('blackbox_profile', profile);
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } else {
        setError(`Authentication failed. Use '${PROTOTYPE_API_KEY}' for prototype mode.`);
      }
    }
  };

  if (success) {
    return (
      <div id="cluster-hook-form" className="w-full max-w-2xl mx-auto p-8 border-2 border-green-500 rounded-lg bg-green-500/5">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-green-500 rounded-full animate-spin"></div>
          <h3 className="text-2xl font-mono text-green-500 mb-2">CONNECTION ESTABLISHED</h3>
          <p className="text-green-500/80">
            Redirecting to dashboard...
          </p>
          <p className="text-sm text-green-500/60 mt-4">
            JOB_ID: {jobId} | PROFILE: {CLUSTER_PROFILES.find(p => p.id === profile)?.name}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="cluster-hook-form" className="w-full max-w-2xl mx-auto p-8 border-2 border-zinc-700 rounded-lg bg-zinc-900/50">
      <h3 className="text-xl font-mono text-green-500 mb-6 text-center">
        CLUSTER HOOK FORMULATION
      </h3>

      {error && (
        <div className="mb-6 p-3 border border-red-500/50 rounded bg-red-500/10">
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-2">
            CLUSTER IDENTIFIER (JOB_ID)
          </label>
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="e.g., job-20260706-001"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded font-mono text-white focus:border-green-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-2">
            BACKEND AUTHORIZATION TOKEN
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter API key or use PROTOTYPE_KEY"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded font-mono text-white focus:border-green-500 focus:outline-none"
          />
          <p className="text-xs text-zinc-500 mt-1">
            For prototype mode: use &apos;PROTOTYPE_KEY&apos; or &apos;test&apos;
          </p>
        </div>

        <div>
          <label className="block text-sm font-mono text-zinc-400 mb-2">
            CLUSTER SELECTION PROFILE
          </label>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded font-mono text-white focus:border-green-500 focus:outline-none"
          >
            {CLUSTER_PROFILES.map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-800">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          onClick={() => playSound('click')}
          className="w-full py-4 px-6 border-2 border-green-500 rounded-lg font-mono text-green-500 hover:bg-green-500/10 transition-all text-lg tracking-wider btn-click-effect btn-primary border-sweep"
        >
          [ ESTABLISH CONNECTION ]
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-zinc-700/50">
        <p className="text-xs text-zinc-500 text-center font-mono">
          PROTOTYPE FALLBACK LAYER ACTIVE
        </p>
        <p className="text-xs text-zinc-600 text-center mt-1">
          Backend calls route to BLACKBOX_API_KEY environment variable
        </p>
      </div>
    </div>
  );
}