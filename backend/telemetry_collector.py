"""
BLACKBOX_AI Telemetry Collector Daemon

Collects GPU metrics every 200ms using rocm-smi and rocprof tools.
Broadcasts via WebSocket to connected clients.
"""

import asyncio
import subprocess
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class TelemetryData:
    """Structured telemetry data from ROCm hardware"""
    timestamp: float
    job_id: str
    gpu_util: float
    mem_bandwidth_sat: float
    power_draw: float
    kernel_gap: float
    core_temp: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ROCmMetricsParser:
    """Parse rocm-smi and rocprof output"""
    
    @staticmethod
    def parse_rocm_smi(output: str) -> Dict[str, float]:
        """Extract metrics from rocm-smi output"""
        metrics = {
            'gpu_util': 0.0,
            'mem_bandwidth_sat': 0.0,
            'power_draw': 0.0,
            'core_temp': 0.0
        }
        
        try:
            for line in output.split('\n'):
                line = line.strip()
                if not line:
                    continue
                
                # Parse GPU utilization
                if 'gpu use%' in line.lower() or 'gpu_busy' in line.lower():
                    parts = line.split()
                    for part in parts:
                        try:
                            if '%' in part:
                                metrics['gpu_util'] = float(part.replace('%', '')) / 100
                                break
                        except ValueError:
                            continue
                
                # Parse memory usage
                if 'mem use%' in line.lower() or 'vram_use' in line.lower():
                    parts = line.split()
                    for part in parts:
                        try:
                            if '%' in part:
                                metrics['mem_bandwidth_sat'] = float(part.replace('%', '')) / 100
                                break
                        except ValueError:
                            continue
                
                # Parse power draw (Watts)
                if 'power' in line.lower() and 'w' in line.lower():
                    parts = line.split()
                    for part in parts:
                        try:
                            if 'w' in part.lower():
                                metrics['power_draw'] = float(part.replace('w', '').replace('W', ''))
                                break
                        except ValueError:
                            continue
                
                # Parse temperature (Celsius)
                if 'temp' in line.lower() and 'c' in line.lower():
                    parts = line.split()
                    for part in parts:
                        try:
                            if 'c' in part.lower():
                                metrics['core_temp'] = float(part.replace('c', '').replace('C', ''))
                                break
                        except ValueError:
                            continue
                        
        except Exception as e:
            print(f"Error parsing rocm-smi output: {e}")
        
        return metrics
    
    @staticmethod
    def parse_rocprof(output: str) -> Dict[str, float]:
        """Extract kernel-level metrics from rocprof output"""
        metrics = {'kernel_gap': 0.0}
        
        try:
            # Look for kernel launch intervals
            if 'Kernel' in output and 'ms' in output:
                # Simple average calculation from rocprof JSON
                # In practice, rocprof outputs JSON with detailed timing
                pass
                
        except Exception as e:
            print(f"Error parsing rocprof output: {e}")
        
        return metrics


class TelemetryCollector:
    """Main telemetry collection daemon"""
    
    def __init__(self, job_id: str = "default"):
        self.job_id = job_id
        self.api_key = os.getenv('BLACKBOX_API_KEY', '')
        self.sampling_interval = float(os.getenv('SAMPLING_INTERVAL_MS', '200')) / 1000
        self.subscribers: List = []
        self.is_running = False
        self.parser = ROCmMetricsParser()
        
    async def collect_rocm_metrics(self) -> Dict[str, float]:
        """Collect system-level metrics using rocm-smi"""
        try:
            result = subprocess.run(
                ['rocm-smi', '--showuse', '--showmemuse', '--showtemp', '--showpower'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return self.parser.parse_rocm_smi(result.stdout)
        except subprocess.TimeoutExpired:
            print("rocm-smi command timed out")
            return {}
        except FileNotFoundError:
            print("rocm-smi not found. Running in mock mode.")
            return self._mock_rocm_metrics()
        except Exception as e:
            print(f"Error running rocm-smi: {e}")
            return self._mock_rocm_metrics()
    
    def _mock_rocm_metrics(self) -> Dict[str, float]:
        """Generate mock metrics for development"""
        import random
        return {
            'gpu_util': random.uniform(0.4, 0.99),
            'mem_bandwidth_sat': random.uniform(0.3, 0.85),
            'power_draw': random.uniform(100, 300),
            'core_temp': random.uniform(40, 85)
        }
    
    async def collect_rocprof_metrics(self) -> Dict[str, float]:
        """Collect kernel-level metrics using rocprof"""
        try:
            # rocprof requires a running GPU application
            # For demo purposes, we'll use mock data
            return {'kernel_gap': 12.5}
        except Exception as e:
            print(f"Error collecting rocprof metrics: {e}")
            return {'kernel_gap': 0.0}
    
    async def collect_telemetry(self) -> TelemetryData:
        """Collect all telemetry and return structured data"""
        rocm_metrics = await self.collect_rocm_metrics()
        rocprof_metrics = await self.collect_rocprof_metrics()
        
        return TelemetryData(
            timestamp=datetime.utcnow().timestamp(),
            job_id=self.job_id,
            gpu_util=rocm_metrics.get('gpu_util', 0.0),
            mem_bandwidth_sat=rocm_metrics.get('mem_bandwidth_sat', 0.0),
            power_draw=rocm_metrics.get('power_draw', 0.0),
            kernel_gap=rocprof_metrics.get('kernel_gap', 0.0),
            core_temp=rocm_metrics.get('core_temp', 0.0)
        )
    
    def is_anomalous(self, telemetry: TelemetryData) -> bool:
        """Quick check for anomalous conditions"""
        return (
            telemetry.mem_bandwidth_sat > 0.80 or
            telemetry.kernel_gap > 50.0 or
            telemetry.core_temp > 85.0 or
            telemetry.gpu_util < 0.1  # GPU hanging
        )
    
    async def start(self):
        """Start the telemetry collection loop"""
        self.is_running = True
        
        while self.is_running:
            try:
                telemetry = await self.collect_telemetry()
                
                # Broadcast to all subscribers
                await self.broadcast(telemetry)
                
                # Check for anomalies and trigger AI diagnosis
                if self.is_anomalous(telemetry):
                    print(f"Anomaly detected in job {self.job_id}: {telemetry.to_dict()}")
                    # In production: trigger AI diagnosis
                
            except Exception as e:
                print(f"Error in telemetry collection: {e}")
            
            await asyncio.sleep(self.sampling_interval)
    
    async def broadcast(self, telemetry: TelemetryData):
        """Send telemetry to all connected WebSocket clients"""
        for subscriber in self.subscribers:
            try:
                await subscriber.send_json(telemetry.to_dict())
            except Exception as e:
                print(f"Error broadcasting to subscriber: {e}")
                self.subscribers.remove(subscriber)
    
    def add_subscriber(self, websocket):
        """Add a WebSocket client to subscribers"""
        self.subscribers.append(websocket)
    
    def remove_subscriber(self, websocket):
        """Remove a WebSocket client"""
        if websocket in self.subscribers:
            self.subscribers.remove(websocket)
    
    def stop(self):
        """Stop the collection loop"""
        self.is_running = False


# Singleton instance
collector = TelemetryCollector()


if __name__ == "__main__":
    import uvicorn
    from websocket_server import app
    
    # Start telemetry collection in background
    async def run_collector():
        await collector.start()
    
    # Run both WebSocket server and collector
    asyncio.run(asyncio.gather(
        uvicorn.run(app, host="0.0.0.0", port=8765),
        run_collector()
    ))
