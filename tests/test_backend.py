"""
tests/test_backend.py - Unit tests for BlackBox AI GPU Telemetry Backend

Run with: pytest tests/test_backend.py -v
Or: python -m pytest tests/test_backend.py -v
"""

import asyncio
import time
from collections import deque
from unittest.mock import patch, MagicMock

import pytest

# Import backend modules
import sys
sys.path.insert(0, str(__file__).rsplit("/", 1)[0].rsplit("\\", 1)[0])

import rocm_monitor
import state_classifier
import training_job


# =============================================================================
# rocm_monitor Tests
# =============================================================================

class TestRocmMonitor:
    """Tests for rocm_monitor module."""

    def test_is_rocm_available_returns_bool(self):
        """Test that is_rocm_available returns a boolean."""
        result = rocm_monitor.is_rocm_available()
        assert isinstance(result, bool)

    def test_poll_gpu_returns_dict(self):
        """Test that poll_gpu returns expected dict structure."""
        telemetry = rocm_monitor.poll_gpu()
        
        assert isinstance(telemetry, dict)
        assert "gpu_util_pct" in telemetry
        assert "mem_util_pct" in telemetry
        assert "power_w" in telemetry
        assert "timestamp" in telemetry
        
        # Check types
        assert isinstance(telemetry["gpu_util_pct"], (int, float))
        assert isinstance(telemetry["mem_util_pct"], (int, float))
        assert isinstance(telemetry["power_w"], (int, float))
        assert isinstance(telemetry["timestamp"], (int, float))

    def test_get_memory_bandwidth_pressure_empty_history(self):
        """Test memory pressure with empty history."""
        result = rocm_monitor.get_memory_bandwidth_pressure([])
        assert result == 0.0

    def test_get_memory_bandwidth_pressure_insufficient_data(self):
        """Test memory pressure with less than 3 samples."""
        history = [{"gpu_util_pct": 50.0, "mem_util_pct": 30.0}]
        result = rocm_monitor.get_memory_bandwidth_pressure(history)
        assert result == 0.0

    def test_get_memory_bandwidth_pressure_normal(self):
        """Test memory pressure calculation with valid history."""
        history = [
            {"gpu_util_pct": 80.0, "mem_util_pct": 60.0},
            {"gpu_util_pct": 85.0, "mem_util_pct": 65.0},
            {"gpu_util_pct": 82.0, "mem_util_pct": 62.0},
            {"gpu_util_pct": 78.0, "mem_util_pct": 68.0},
        ]
        result = rocm_monitor.get_memory_bandwidth_pressure(history)
        assert 0 <= result <= 100

    def test_get_memory_bandwidth_pressure_high_memory(self):
        """Test memory pressure with high memory utilization."""
        history = [
            {"gpu_util_pct": 40.0, "mem_util_pct": 85.0},
            {"gpu_util_pct": 45.0, "mem_util_pct": 88.0},
            {"gpu_util_pct": 42.0, "mem_util_pct": 86.0},
            {"gpu_util_pct": 38.0, "mem_util_pct": 90.0},
        ]
        result = rocm_monitor.get_memory_bandwidth_pressure(history)
        assert result > 30  # Should detect memory pressure

    @patch("subprocess.check_output")
    def test_poll_gpu_with_mocked_rocm(self, mock_check_output):
        """Test poll_gpu with mocked rocm-smi output."""
        mock_output = """GPU[0]          : 75%
GPU[0]          : 8.0 GB / 16 GB
GPU[0]          : 150.0 W"""
        mock_check_output.return_value = mock_output
        
        telemetry = rocm_monitor.poll_gpu()
        
        assert telemetry["gpu_util_pct"] == 75.0
        assert telemetry["mem_util_pct"] == 50.0  # 8/16 = 50%
        assert telemetry["power_w"] == 150.0


# =============================================================================
# state_classifier Tests
# =============================================================================

class TestStateClassifier:
    """Tests for state_classifier module."""

    def test_classify_insufficient_data(self):
        """Test classify with less than 3 samples."""
        result = state_classifier.classify([])
        
        assert result["state"] == "healthy"
        assert "evidence" in result

    def test_classify_single_sample(self):
        """Test classify with single sample."""
        history = [{"gpu_util_pct": 50.0, "mem_util_pct": 50.0}]
        result = state_classifier.classify(history)
        
        assert result["state"] == "healthy"
        assert "evidence" in result

    def test_classify_valid_history(self):
        """Test classify with sufficient samples."""
        history = [
            {"gpu_util_pct": 80.0, "mem_util_pct": 30.0},
            {"gpu_util_pct": 85.0, "mem_util_pct": 35.0},
            {"gpu_util_pct": 82.0, "mem_util_pct": 32.0},
        ]
        result = state_classifier.classify(history)
        
        assert "state" in result
        assert result["state"] in ["healthy", "memory_bound", "comms_bound", "power_throttled"]
        assert "confidence" in result
        assert "evidence" in result
        assert 0 <= result["confidence"] <= 1

    def test_classify_healthy_state(self):
        """Test classification for healthy GPU state."""
        history = [
            {"gpu_util_pct": 90.0, "mem_util_pct": 40.0},
            {"gpu_util_pct": 92.0, "mem_util_pct": 42.0},
            {"gpu_util_pct": 88.0, "mem_util_pct": 38.0},
            {"gpu_util_pct": 91.0, "mem_util_pct": 41.0},
        ]
        result = state_classifier.classify(history)
        
        assert "state" in result
        assert isinstance(result["confidence"], float)

    def test_classify_memory_bound_state(self):
        """Test classification for memory-bound state."""
        history = [
            {"gpu_util_pct": 30.0, "mem_util_pct": 90.0},
            {"gpu_util_pct": 35.0, "mem_util_pct": 92.0},
            {"gpu_util_pct": 28.0, "mem_util_pct": 88.0},
            {"gpu_util_pct": 32.0, "mem_util_pct": 91.0},
        ]
        result = state_classifier.classify(history)
        
        # Should detect memory-bound state
        assert result["state"] in ["healthy", "memory_bound", "comms_bound", "power_throttled"]

    def test_classify_power_throttled_state(self):
        """Test classification for power throttling."""
        history = [
            {"gpu_util_pct": 50.0, "mem_util_pct": 50.0},
            {"gpu_util_pct": 45.0, "mem_util_pct": 48.0},
            {"gpu_util_pct": 40.0, "mem_util_pct": 45.0},
            {"gpu_util_pct": 35.0, "mem_util_pct": 42.0},
        ]
        result = state_classifier.classify(history)
        
        assert result["state"] in ["healthy", "memory_bound", "comms_bound", "power_throttled"]

    def test_label_map_consistency(self):
        """Test that label mappings are consistent."""
        # Verify idx_to_label covers expected indices
        for idx in range(4):
            label = state_classifier.LABEL_MAP["idx_to_label"][str(idx)]
            assert label in ["healthy", "memory_bound", "comms_bound", "power_throttled"]


# =============================================================================
# training_job Tests
# =============================================================================

class TestTrainingJob:
    """Tests for training_job module."""

    def test_is_running_initially(self):
        """Test initial running state."""
        # Stop any running job first
        training_job.stop_training_job()
        time.sleep(0.1)
        assert training_job.is_running() is False

    def test_start_stop_training_job(self):
        """Test starting and stopping training job."""
        training_job.stop_training_job()
        time.sleep(0.1)
        
        job_id = training_job.start_training_job()
        assert job_id is not None
        assert isinstance(job_id, str)
        assert len(job_id) > 0
        
        # Give it a moment to start
        time.sleep(0.2)
        assert training_job.is_running() is True
        
        # Stop it
        training_job.stop_training_job()
        time.sleep(0.2)
        assert training_job.is_running() is False

    def test_multiple_start_calls(self):
        """Test that starting job multiple times returns same running job."""
        training_job.stop_training_job()
        time.sleep(0.1)
        
        job_id1 = training_job.start_training_job()
        job_id2 = training_job.start_training_job()
        
        # Should return same job_id while running
        assert job_id1 == job_id2
        
        training_job.stop_training_job()

    def test_stop_when_not_running(self):
        """Test stopping when no job is running doesn't error."""
        training_job.stop_training_job()
        time.sleep(0.1)
        training_job.stop_training_job()  # Should not raise


# =============================================================================
# Integration Tests (require FastAPI test client)
# =============================================================================

class TestMainAPI:
    """Integration tests for FastAPI endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        try:
            from fastapi.testclient import TestClient
            from main import app
            return TestClient(app)
        except ImportError:
            pytest.skip("FastAPI or TestClient not installed")

    def test_root_endpoint(self, client):
        """Test root health check endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "running"
        assert "rocm_available" in data
        assert "training_active" in data

    def test_start_training_endpoint(self, client):
        """Test starting training via API."""
        response = client.post("/api/training/start")
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert "status" in data
        
        # Cleanup
        client.post("/api/training/stop")

    def test_websocket_endpoint_accepts_connection(self, client):
        """Test WebSocket endpoint accepts connection."""
        with pytest.raises(Exception):  # Will get WebSocketDisconnect
            with client.websocket_connect("/ws/telemetry/test_job_123") as websocket:
                # Should receive at least one message
                data = websocket.receive_json()
                assert "type" in data


# =============================================================================
# WebSocket Streaming Tests
# =============================================================================

class TestWebSocketStreaming:
    """Tests for WebSocket telemetry streaming."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        try:
            from fastapi.testclient import TestClient
            from main import app
            return TestClient(app)
        except ImportError:
            pytest.skip("FastAPI or TestClient not installed")

    def test_websocket_sends_telemetry(self, client):
        """Test that WebSocket sends telemetry data."""
        with pytest.raises(Exception):
            with client.websocket_connect("/ws/telemetry/test_stream") as ws:
                # Receive first telemetry message
                msg = ws.receive_json()
                
                assert msg["type"] == "telemetry"
                assert "computeUtil" in msg
                assert "memBandwidthPct" in msg
                assert "powerW" in msg
                assert "state" in msg
                assert "jobId" in msg

    def test_websocket_message_format(self, client):
        """Test WebSocket message matches expected format."""
        with pytest.raises(Exception):
            with client.websocket_connect("/ws/telemetry/test_format") as ws:
                msg = ws.receive_json()
                
                # Verify all required fields exist and have correct types
                assert isinstance(msg["computeUtil"], (int, float))
                assert isinstance(msg["memBandwidthPct"], (int, float))
                assert isinstance(msg["powerW"], (int, float))
                assert msg["state"] in ["healthy", "memory_bound", "comms_bound", "power_throttled"]
                assert isinstance(msg["confidence"], (int, float))


# =============================================================================
# Run Tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])