import HeroBanner from './components/landing/HeroBanner';
import AudioPreview from './components/landing/AudioPreview';
import ArchitecturePitch from './components/landing/ArchitecturePitch';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] text-white">
      <HeroBanner />
      
      <main className="flex-1 w-full py-16 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Value Proposition */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-green-500 leading-tight">
              GPU Unbound: Break free from memory-bound and comms-bound constraints –
            </h2>
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mt-4">
              fully unleashing your GPU cluster's potential.
            </h2>
          </div>
          
          {/* Audio Preview */}
          <AudioPreview />
          
          {/* Architecture Comparison */}
          <ArchitecturePitch />
          
          {/* CTA Button */}
          <div className="mt-12 text-center">
            <a
              href="/sign-in"
              className="inline-block px-12 py-4 border-2 border-green-500 rounded-lg font-mono text-green-500 hover:bg-green-500/10 transition-all text-lg tracking-wider"
            >
              [ ENTER DASHBOARD ]
            </a>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="w-full py-6 border-t border-green-500/30">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="font-mono text-green-500/60 text-sm">
            GPU_UNBOUND // ROCM &bull; MEMORY_BOUND_RELEASED &bull; COMMS_BOUND_RELEASED &bull; v1.0.0
          </p>
        </div>
      </footer>
    </div>
  );
}