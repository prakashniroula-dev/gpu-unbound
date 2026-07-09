export default function ArchitecturePitch() {
  return (
    <div className="w-full max-w-6xl mx-auto mt-12 px-6">
      <h2 className="text-2xl font-mono text-green-500 mb-8 text-center">
        {'>>'} ARCHITECTURAL_SUPERIORITY // UNBOUND_CORE
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Deep Architecture */}
        <div className="border-2 border-green-500 rounded-lg p-6 bg-green-500/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-green-500 animate-pulse"></div>
            <h3 className="text-xl font-mono text-green-500">
              FULL STACK PROFILING
            </h3>
          </div>
          
          <div className="space-y-4 font-mono text-sm">
            <div className="p-4 border border-green-500/30 rounded">
              <div className="text-green-500/80 mb-2">rocprof KERNEL-TRACE</div>
              <div className="text-green-500/60 text-xs">
                {'>'} Micro-level execution events<br/>
                {'>'} Kernel launch interval counts<br/>
                {'>'} Memory pipeline latency metrics<br/>
                {'>'} GPU compute unit utilization
              </div>
            </div>
            
            <div className="p-4 border border-green-500/30 rounded">
              <div className="text-green-500/80 mb-2">System Telemetry</div>
              <div className="text-green-500/60 text-xs">
                {'>'} rocm-smi power metrics<br/>
                {'>'} Temperature monitoring<br/>
                {'>'} Memory bandwidth saturation<br/>
                {'>'} Real-time 200ms sampling
              </div>
            </div>
            
            <div className="p-4 border border-green-500/30 rounded">
              <div className="text-green-500/80 mb-2">Constraint Detection</div>
              <div className="text-green-500/60 text-xs">
                {'>'} Memory-bound detection<br/>
                {'>'} Communication-bound detection<br/>
                {'>'} Kernel gap analysis<br/>
                {'>'} Bandwidth saturation tracking
              </div>
            </div>
          </div>
        </div>
        
        {/* Surface Metrics */}
        <div className="border-2 border-zinc-700 rounded-lg p-6 bg-zinc-900/50 opacity-60">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-zinc-600"></div>
            <h3 className="text-xl font-mono text-zinc-500">
              SURFACE METRICS (Typical)
            </h3>
          </div>
          
          <div className="space-y-4 font-mono text-sm">
            <div className="p-4 border border-zinc-700/50 rounded">
              <div className="text-zinc-500/80 mb-2">GPU Utilization %</div>
              <div className="text-zinc-600 text-xs">
                {'>'} Single percentage metric<br/>
                {'>'} No kernel-level insight<br/>
                {'>'} Reactive monitoring
              </div>
            </div>
            
            <div className="p-4 border border-zinc-700/50 rounded">
              <div className="text-zinc-500/80 mb-2">Memory Usage</div>
              <div className="text-zinc-600 text-xs">
                {'>'} Total memory allocated<br/>
                {'>'} No bandwidth saturation data<br/>
                {'>'} No starvation detection
              </div>
            </div>
            
            <div className="p-4 border border-zinc-700/50 rounded">
              <div className="text-zinc-500/80 mb-2">Temperature</div>
              <div className="text-zinc-600 text-xs">
                {'>'} Passive alert system<br/>
                {'>'} No predictive cooling<br/>
                {'>'} Too late for intervention
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 border border-red-500/30 rounded bg-red-500/5">
            <div className="text-red-500 text-sm font-mono">
              {'!!'} INSUFFICIENT for bound-state detection
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}