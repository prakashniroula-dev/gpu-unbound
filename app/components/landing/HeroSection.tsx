export default function HeroSection() {
  return (
    <section className="w-full max-w-6xl mx-auto mb-12">
      {/* Banner Header */}
      <div className="border-2 border-green-500 bg-black p-4 mb-6">
        <h1 className="font-mono text-2xl md:text-3xl font-bold text-green-400 tracking-wider">
          GPU_UNBOUND // TERMINAL_V1
        </h1>
      </div>

      {/* Value Proposition */}
      <div className="mb-8">
        <h2 className="font-mono text-lg md:text-xl text-green-300 mb-4 leading-relaxed">
          <span className="text-green-600 mr-2">{'>'}</span>
          The first AI agent that hears your GPU cluster failing – and fixes it before you look at a screen.
        </h2>
        
        {/* Technical Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="border border-green-800 bg-black/50 p-4">
            <h3 className="font-mono text-sm text-green-500 mb-2">[ DEEP INSIGHT ]</h3>
            <p className="font-mono text-xs text-gray-400">
              rocprof kernel-trace collection at 200ms intervals • Real-time memory bandwidth saturation • 
              Power draw telemetry • Kernel launch interval analysis
            </p>
          </div>
          
          <div className="border border-gray-700 bg-black/50 p-4 opacity-60">
            <h3 className="font-mono text-sm text-gray-500 mb-2">[ SURFACE METRICS ]</h3>
            <p className="font-mono text-xs text-gray-500">
              Generic GPU utilization • Temperature snapshots • Basic power readings • 
              No kernel-level visibility
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}