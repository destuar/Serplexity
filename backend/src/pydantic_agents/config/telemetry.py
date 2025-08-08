"""
Lightweight telemetry no-ops to keep call sites intact without vendor lock-in.
"""
from typing import Any, Optional, Dict


def track_agent_execution(
    agent_name: str,
    operation: str,
    duration_ms: Optional[float] = None,
    success: bool = True,
    input_data: Optional[Dict[str, Any]] = None,
    output_data: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    return None


def track_model_usage(
    provider: str,
    model_id: str,
    operation: str,
    tokens_used: int,
    cost_estimate: Optional[float] = None,
    duration_ms: Optional[float] = None,
    success: bool = True,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    return None


def track_error(
    error: Exception,
    context: str,
    agent_name: Optional[str] = None,
    operation: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    return None
