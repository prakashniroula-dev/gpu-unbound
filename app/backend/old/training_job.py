"""
training_job.py - Minimal MNIST training script that loads AMD GPU

Runs as a background asyncio task, not blocking the WebSocket server.
Supports AMD GPUs via ROCm (torch.cuda.is_available() works same as NVIDIA).
"""

import asyncio
from pathlib import Path
import torch
import torch.nn as nn
import torch.optim as optim 
from torchvision import datasets, transforms
from typing import Optional
import uuid

print("random print")
# Global state
_training_task: Optional[asyncio.Task] = None
_job_id: Optional[str] = None
_bottleneck_tensor: Optional[torch.Tensor] = None
_is_running = False
DATA_DIR = Path(__file__).resolve().parent / "data"

# print("")


class SimpleCNN(nn.Module):
    """Minimal CNN for MNIST classification."""
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 7 * 7, 128)
        self.fc2 = nn.Linear(128, 10)
        self.relu = nn.ReLU()
        
    def forward(self, x):
        x = self.relu(self.conv1(x))
        x = self.pool(x)
        x = self.relu(self.conv2(x))
        x = self.pool(x)
        x = x.view(-1, 64 * 7 * 7)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        return x


async def _training_loop(job_id: str):
    """
    Background training loop that runs MNIST training.
    Uses GPU if available (including AMD ROCm), falls back to CPU.
    """
    global _is_running
    _is_running = True
    
    print(f"[training_job] Starting MNIST training job: {job_id}")
    
    # Device selection: CUDA works for both NVIDIA and AMD ROCm
    # ROCm PyTorch builds use the same torch.cuda API surface
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[training_job] Using device: {device}")
    
    # Data loading
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,))
    ])
    
    train_dataset = datasets.MNIST(root=str(DATA_DIR), train=True, download=True, transform=transform)
    train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=64, shuffle=True)
    
    # Model, loss, optimizer
    model = SimpleCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    model.train()
    epoch = 0
    
    try:
        while _is_running:
            for batch_idx, (data, target) in enumerate(train_loader):
                data, target = data.to(device), target.to(device)
                
                optimizer.zero_grad()
                output = model(data)
                loss = criterion(output, target)
                loss.backward()
                optimizer.step()
                
                if batch_idx % 100 == 0:
                    print(f"[training_job] Job {job_id} - Epoch {epoch}, Batch {batch_idx}, Loss: {loss.item():.4f}")
                
                # Small delay to allow other async tasks
                await asyncio.sleep(0.01)
            
            epoch += 1
            print(f"[training_job] Job {job_id} completed epoch {epoch}")
            
    except asyncio.CancelledError:
        print(f"[training_job] Training job {job_id} cancelled")
    finally:
        _is_running = False
        print(f"[training_job] Training job {job_id} stopped")


def start_training_job() -> str:
    """
    Start the MNIST training job as a background asyncio task.
    
    Returns:
        job_id: unique identifier for this training job
    """
    global _training_task, _job_id
    
    if _training_task is not None and not _training_task.done():
        print("[training_job] Training job already running, stopping first...")
        stop_training_job()
    
    _job_id = str(uuid.uuid4())[:8]
    _training_task = asyncio.create_task(_training_loop(_job_id))
    print(f"[training_job] Launched training job: {_job_id}")
    
    return _job_id


def stop_training_job():
    """Stop the currently running training job."""
    global _is_running, _training_task
    
    _is_running = False
    
    if _training_task is not None:
        _training_task.cancel()
        _training_task = None
        print("[training_job] Training job stopped")


def inject_bottleneck():
    """
    Inject a memory bottleneck by allocating a large dummy tensor.
    
    Per the knowledge booklet, this creates reliable memory pressure
    for demo purposes instead of waiting for natural bottlenecks.
    """
    global _bottleneck_tensor
    
    print("[training_job] Injecting memory bottleneck...")
    
    # Allocate ~2GB dummy tensor to spike memory usage
    # This is released when the tensor is reassigned or goes out of scope
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        _bottleneck_tensor = torch.zeros((512, 1024, 1024), device=device)  # ~2GB on GPU
        print(f"[training_job] Allocated bottleneck tensor on {device}")
        
        # Hold for 5 seconds then release
        asyncio.get_event_loop().call_later(5, _release_bottleneck)
        
    except RuntimeError as e:
        print(f"[training_job] Could not allocate bottleneck tensor (may be CPU mode): {e}")


def _release_bottleneck():
    """Release the bottleneck tensor after timeout."""
    global _bottleneck_tensor
    if _bottleneck_tensor is not None:
        print("[training_job] Releasing bottleneck tensor...")
        del _bottleneck_tensor
        _bottleneck_tensor = None


def is_running() -> bool:
    """Check if training job is currently running."""
    return _is_running


def get_job_id() -> Optional[str]:
    """Get the current job ID."""
    return _job_id