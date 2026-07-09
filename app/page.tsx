'use client';

import { useState, useEffect, useRef } from 'react';
import HeroBanner from './components/landing/HeroBanner';
import AudioPreview from './components/landing/AudioPreview';
import ArchitecturePitch from './components/landing/ArchitecturePitch';
import AudioVisualizer from './components/landing/AudioVisualizer';
import SonificationEngine from './components/dashboard/SonificationEngine';

// Feature card data
const CORE_FEATURES = [
  {
    title: 'KERNEL_TRACE',
    description: 'rocprof-based microsecond-level kernel execution tracing with launch interval analysis',
    icon: '[>>]',
    status: 'active',
  },
  {
    title: 'MEMORY_UNBOUND',
    description: 'Real-time memory bandwidth saturation detection and starvation prevention',
    icon: '[##]',
    status: 'active',
  },
  {
    title: 'COMMS_PROFILER',
    description: 'Cross-GPU communication latency mapping and NCCL topology analysis',
    icon: '[@@]',
    status: 'active',
  },
  {
    title: 'POWER_SONIFICATION',
    description: 'Audio-haptic telemetry mapping for hands-free monitoring during long runs',
    icon: '[~~]',
    status: 'active',
  },
];

const STATS = [
  { value: '200ms', label: 'SAMPLE_RATE', sublabel: 'Real-time telemetry' },
  { value: '1000x', label: 'VISIBILITY', sublabel: 'Beyond surface metrics' },
  { value: '<50ms', label: 'DETECTION', sublabel: 'Anomaly identification' },
  { value: '24/7', label: 'MONITORING', sublabel: 'Autonomous operation' },
];

const USE_CASES = [
  {
    title: 'LLM TRAINING CLUSTERS',
    description: 'Detect memory-bound states before gradient synchronization stalls',
    tags: ['ROCm', 'NCCL', 'Transformer Engine'],
  },
  {
    title: 'VLLM INFERENCE SERVERS',
    description: 'Monitor KV cache hit rates and GPU memory pressure in real-time',
    tags: ['vLLM', 'PagedAttention', 'Continuous Batching'],
  },
  {
    title: 'HPC SIMULATION',
    description: 'Track kernel gap analysis across multi-node MPI workloads',
    tags: ['MPI', 'ROCm', 'UCC'],
  },
  {
    title: 'RAG PIPELINES',
    description: 'Identify embedding batch size constraints via memory bandwidth analysis',
    tags: ['FAISS', 'Embeddings', 'Vector DB'],
  },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    setMounted(true);
    
    return () => {
      // Cleanup audio on unmount
      if (oscillatorRef.current) {
        try { oscillatorRef.current.stop(); oscillatorRef.current.disconnect(); } catch (e) { /* ignore */ }
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  const toggleAudio = () => {
    if (!mounted) return;
    
    if (isPlaying) {
      // Stop audio
      if (oscillatorRef.current) {
        try { oscillatorRef.current.stop(); oscillatorRef.current.disconnect(); } catch (e) { /* ignore */ }
        oscillatorRef.current = null;
      }
      if (gainNodeRef.current) { gainNodeRef.current.disconnect(); gainNodeRef.current = null; }
      if (analyserRef.current) { analyserRef.current.disconnect(); analyserRef.current = null; }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
        audioContextRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // EXACT copy from SonificationEngine startSonification()
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = audioContextRef.current;
        
        if (ctx.state === 'suspended') { ctx.resume(); }
        
        // Create multiple oscillators for richer sound
        const oscillators: OscillatorNode[] = [];
        
        // Primary oscillator (sine wave for smooth sound)
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(130, ctx.currentTime);
        oscillators.push(osc1);
        
        // Secondary oscillator (harmonic)
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2, ctx.currentTime);
        oscillators.push(osc2);
        
        // Create gain nodes for volume control
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        
        // Set volumes - EXACT same as SonificationEngine
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.setValueAtTime(0.15, ctx.currentTime);
        
        // Create analyser - EXACT same as SonificationEngine
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 2048;
        
        // Connect nodes - EXACT same chain as SonificationEngine
        osc1.connect(gain1);
        gain1.connect(analyserRef.current);
        osc2.connect(gain2);
        gain2.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
        
        // Store reference
        oscillatorRef.current = osc1;
        gainNodeRef.current = gain1;
        
        // Start oscillators
        oscillators.forEach(osc => osc.start());
        
        setIsPlaying(true);
      } catch (err) {
        console.error('Audio initialization failed:', err);
      }
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] text-white">
      <HeroBanner />
      
      <main className="flex-1 w-full overflow-hidden">
        {/* Hero Section */}
        <section className="relative py-10 px-6 border-b border-green-500/20">
          <div className="max-w-7xl mx-auto">
            {/* Terminal header */}
            <div className="inline-block mb-6 px-4 py-2 border border-green-500/50 bg-green-500/5">
              <span className="font-mono text-green-500/80 text-sm">
                {'//'} SYSTEM_READY v1.0.0 // ROCM_COMPATIBLE // MEMORY_CONSTRAINTS_RELEASED
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-mono font-bold mb-6">
              <span className="text-green-500">GPU_UNBOUND</span>
            </h1>
            
            <p className="text-xl md:text-2xl font-mono text-gray-300 max-w-3xl mb-8 leading-relaxed">
              The first AI agent that {' '}
              <span className="text-green-500">hears</span> your GPU cluster failing —
              and fixes it before you look at a screen.
            </p>
            
            <div className="flex flex-wrap gap-4 mb-12">
              <a
                href="/sign-in"
                className="group px-8 py-4 bg-green-500 text-black font-mono font-bold rounded hover:bg-green-400 transition-all"
              >
                <span className="mr-2">{'>'}</span>
                ENTER_DASHBOARD
                <span className="ml-2 opacity-60 group-hover:opacity-100">{']'}</span>
              </a>
              <a
                href="#features"
                className="px-8 py-4 border-2 border-green-500/50 font-mono text-green-500 rounded hover:bg-green-500/10 transition-all"
              >
                EXPLORE_FEATURES
              </a>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map((stat, i) => (
                <div key={i} className="border border-green-500/30 bg-black/50 p-6 text-center">
                  <div className="text-3xl md:text-4xl font-mono font-bold text-green-500 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm font-mono text-green-500/80">{stat.label}</div>
                  <div className="text-xs font-mono text-gray-500 mt-1">{stat.sublabel}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Background glow effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
        </section>

        {/* Core Features */}
        <section id="features" className="py-10 px-6 border-b border-green-500/20">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-2 h-8 bg-green-500"></div>
              <h2 className="text-3xl md:text-4xl font-mono font-bold text-green-500">
                CORE_CAPABILITIES
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CORE_FEATURES.map((feature, i) => (
                <div 
                  key={i} 
                  className="group border border-green-500/30 bg-black/50 p-6 rounded-lg hover:border-green-500/60 hover:bg-green-500/5 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-mono text-green-500">{feature.icon}</span>
                    <span className="px-2 py-1 text-xs font-mono bg-green-500/20 text-green-500 rounded">
                      {feature.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-mono font-bold text-green-500/90 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm font-mono text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audio Sonification Demo */}
        <section className="py-16 px-6 border-b border-green-500/20 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-2 h-8 bg-green-500"></div>
              <h2 className="text-2xl md:text-3xl font-mono font-bold text-green-500">
                SONIFICATION_ENGINE
              </h2>
            </div>
            
            <div className="flex flex-wrap gap-8">
              {/* Left: Info & Controls */}
              <div className="space-y-4">
                <p className="text-sm font-mono text-gray-400 leading-relaxed">
                  Transform GPU telemetry into audio. Hear memory pressure as waveforms,
                  detect anomalies through frequency shifts.
                </p>
                
                {/* Frequency Legend */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">{'>'}</span>
                    <span className="text-gray-300">130Hz: healthy cluster</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">{'>'}</span>
                    <span className="text-gray-300">220Hz+: memory saturation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">{'>'}</span>
                    <span className="text-gray-300">Spikes: kernel gaps</span>
                  </div>
                </div>
                
              </div>
              
              {/* Right: Visualizer */}
              <SonificationEngine />
            </div>
          </div>
        </section>

        {/* Architecture Comparison */}
        <section className="py-5 px-6 border-b border-green-500/20">
          <div className="max-w-7xl mx-auto">
            <ArchitecturePitch />
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-10 px-6 border-b border-green-500/20">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-2 h-8 bg-green-500"></div>
              <h2 className="text-3xl md:text-4xl font-mono font-bold text-green-500">
                SUPPORTED_WORKLOADS
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {USE_CASES.map((useCase, i) => (
                <div 
                  key={i} 
                  className="border border-green-500/30 bg-black/50 p-6 rounded-lg hover:bg-green-500/5 transition-all"
                >
                  <h3 className="text-xl font-mono font-bold text-green-500 mb-3">
                    {useCase.title}
                  </h3>
                  <p className="text-gray-400 mb-4 leading-relaxed">
                    {useCase.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {useCase.tags.map((tag, j) => (
                      <span 
                        key={j} 
                        className="px-3 py-1 text-xs font-mono bg-green-500/10 text-green-500/80 border border-green-500/30 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audio Preview & CTA */}
        <section className="py-10 px-6">
          <div className="max-w-7xl mx-auto">
            {/* CTA */}
            <div className="text-center p-12 border-2 border-green-500/50 bg-green-500/5 rounded-lg">
              <h2 className="text-3xl font-mono font-bold text-green-500 mb-4">
                READY_TO_UNBOUND?
              </h2>
              <p className="text-gray-400 font-mono mb-8 max-w-2xl mx-auto">
                Connect your ROCm cluster and experience GPU monitoring that actually understands
                what your hardware is doing.
              </p>
              <a
                href="/sign-in"
                className="inline-block px-12 py-4 border-2 border-green-500 rounded-lg font-mono text-green-500 hover:bg-green-500/10 transition-all text-lg tracking-wider"
              >
                [ ENTER DASHBOARD ]
              </a>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="w-full py-8 border-t border-green-500/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="font-mono text-green-500/60 text-sm">
              GPU_UNBOUND // ROCM_ENABLED // MEMORY_BOUND_RELEASED // COMMS_BOUND_RELEASED
            </div>
            <div className="font-mono text-green-500/40 text-xs">
              v1.0.0 // TERMINAL_BUILD
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}