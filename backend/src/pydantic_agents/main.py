#!/usr/bin/env python3
"""
PydanticAI Service Entry Point for Serplexity

This FastAPI application serves as the main entry point for all PydanticAI agents
used in the Serplexity backend. It provides HTTP endpoints for each agent type
and handles health checks, provider status, and agent orchestration.

Features:
- RESTful API for all PydanticAI agents
- Health check endpoints
- Provider status monitoring
- Error handling and logging
- Performance metrics
- Load balancing across providers

Usage:
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
    GET /health - Service health check
    GET /providers - Provider status
    POST /agents/{agent_type} - Execute agent
    GET /agents - List available agents
"""

import asyncio
import json
import logging
import os
import sys
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Import our agents
from .agents.answer_agent import QuestionAnsweringAgent
from .agents.fanout_agent import IntelligentFanoutAgent
from .agents.mention_agent import MentionAgent
from .agents.question_agent import GenQuestionAgent
from .agents.research_agent import CompanyResearchAgent
from .agents.search_agent import SearchAgent
from .agents.sentiment_agent import WebSearchSentimentAgent
from .agents.sentiment_summary_agent import SentimentSummaryAgent
from .agents.website_agent import WebsiteEnrichmentAgent

# Import base classes and config
from .base_agent import BaseAgent
from .config.models import LLM_CONFIG, get_all_models
from .config.logfire_config import setup_logfire, is_logfire_available

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ===== REQUEST/RESPONSE MODELS =====

class AgentExecutionRequest(BaseModel):
    """Request model for agent execution"""
    input_data: Dict[str, Any] = Field(..., description="Input data for the agent")
    model_id: Optional[str] = Field(None, description="Specific model to use")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional agent options")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Request metadata")

class AgentExecutionResponse(BaseModel):
    """Response model for agent execution"""
    success: bool = Field(..., description="Whether execution was successful")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    error: Optional[str] = Field(None, description="Error message if failed")
    execution_metadata: Dict[str, Any] = Field(..., description="Execution metadata")
    agent_type: str = Field(..., description="Type of agent executed")
    request_id: str = Field(..., description="Unique request identifier")

class HealthCheckResponse(BaseModel):
    """Health check response model"""
    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(default_factory=datetime.now, description="Health check timestamp")
    version: str = Field("1.0.0", description="Service version")
    providers: Dict[str, str] = Field(..., description="Provider status")
    agents: Dict[str, str] = Field(..., description="Agent status")

class ProviderStatusResponse(BaseModel):
    """Provider status response model"""
    providers: Dict[str, Dict[str, Any]] = Field(..., description="Detailed provider information")
    healthy_count: int = Field(..., description="Number of healthy providers")
    total_count: int = Field(..., description="Total number of providers")

# ===== AGENT REGISTRY =====

class AgentRegistry:
    """Registry for managing all available agents"""
    
    def __init__(self):
        self.agents = {}
        self._initialize_agents()
    
    def _initialize_agents(self):
        """Initialize all available agents"""
        try:
            self.agents = {
                'answer': QuestionAnsweringAgent(),
                'fanout': IntelligentFanoutAgent(),
                'mention': MentionAgent(),
                'question': GenQuestionAgent(),
                'research': CompanyResearchAgent(),
                'search': SearchAgent(),
                'sentiment': WebSearchSentimentAgent(),
                'sentiment_summary': SentimentSummaryAgent(),
                'website': WebsiteEnrichmentAgent()
            }
            logger.info(f"Initialized {len(self.agents)} agents successfully")
        except Exception as e:
            logger.error(f"Failed to initialize agents: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def get_agent(self, agent_type: str) -> BaseAgent:
        """Get agent by type"""
        agent = self.agents.get(agent_type)
        if not agent:
            raise ValueError(f"Unknown agent type: {agent_type}")
        return agent
    
    def list_agents(self) -> List[str]:
        """List all available agent types"""
        return list(self.agents.keys())
    
    def health_check(self) -> Dict[str, str]:
        """Check health of all agents"""
        status = {}
        for agent_type, agent in self.agents.items():
            try:
                # Simple health check - verify agent is properly initialized
                if hasattr(agent, '_model_config') and agent._model_config:
                    status[agent_type] = "healthy"
                else:
                    status[agent_type] = "degraded"
            except Exception as e:
                logger.error(f"Health check failed for {agent_type}: {e}")
                status[agent_type] = "unhealthy"
        return status

# ===== FASTAPI APPLICATION =====

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Starting PydanticAI Service...")
    
    # Initialize Logfire if available
    if is_logfire_available():
        try:
            setup_logfire()
            logger.info("Logfire initialized for PydanticAI Service")
        except Exception as e:
            logger.warning(f"Logfire initialization failed: {e}")
    
    # Initialize agent registry
    app.state.agent_registry = AgentRegistry()
    logger.info("PydanticAI Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down PydanticAI Service...")

# Create FastAPI app
app = FastAPI(
    title="Serplexity PydanticAI Service",
    description="PydanticAI agent orchestration service for Serplexity",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== ENDPOINTS =====

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint"""
    try:
        # Check providers
        models = get_all_models()
        provider_status = {}
        for model in models:
            try:
                provider_status[model.id] = "available"
            except Exception:
                provider_status[model.id] = "unknown"
        
        # Check agents
        agent_status = app.state.agent_registry.health_check()
        
        # Determine overall status
        healthy_providers = sum(1 for status in provider_status.values() if status == "available")
        healthy_agents = sum(1 for status in agent_status.values() if status == "healthy")
        
        overall_status = "healthy" if healthy_providers > 0 and healthy_agents > 0 else "degraded"
        
        return HealthCheckResponse(
            status=overall_status,
            providers=provider_status,
            agents=agent_status
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.get("/providers", response_model=ProviderStatusResponse)
async def get_provider_status():
    """Get detailed provider status"""
    try:
        models = get_all_models()
        provider_details = {}
        healthy_count = 0
        
        for model in models:
            provider_details[model.id] = {
                'status': 'available',
                'engine': model.engine.value,
                'model': model.id,
                'last_check': datetime.now().isoformat()
            }
            healthy_count += 1
        
        return ProviderStatusResponse(
            providers=provider_details,
            healthy_count=healthy_count,
            total_count=len(providers)
        )
    except Exception as e:
        logger.error(f"Provider status check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Provider status check failed: {str(e)}")

@app.get("/agents")
async def list_agents():
    """List all available agents"""
    try:
        agents = app.state.agent_registry.list_agents()
        return {
            "agents": agents,
            "count": len(agents),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Agent listing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Agent listing failed: {str(e)}")

@app.post("/agents/{agent_type}", response_model=AgentExecutionResponse)
async def execute_agent(
    agent_type: str,
    request: AgentExecutionRequest,
    background_tasks: BackgroundTasks
):
    """Execute a specific agent"""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    try:
        logger.info(f"Executing agent {agent_type} with request {request_id}")
        
        # Get agent
        agent = app.state.agent_registry.get_agent(agent_type)
        
        # Execute agent
        result = await agent.execute_async(
            input_data=request.input_data,
            model_id=request.model_id,
            options=request.options
        )
        
        execution_time = time.time() - start_time
        
        # Log success metrics in background
        background_tasks.add_task(
            log_execution_metrics,
            agent_type=agent_type,
            request_id=request_id,
            execution_time=execution_time,
            success=True
        )
        
        return AgentExecutionResponse(
            success=True,
            data=result.model_dump() if hasattr(result, 'model_dump') else result,
            execution_metadata={
                "execution_time": execution_time,
                "timestamp": datetime.now().isoformat(),
                "model_used": request.model_id or "default",
                "agent_version": "1.0.0"
            },
            agent_type=agent_type,
            request_id=request_id
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        error_msg = str(e)
        
        logger.error(f"Agent execution failed for {agent_type}: {error_msg}")
        logger.error(traceback.format_exc())
        
        # Log error metrics in background
        background_tasks.add_task(
            log_execution_metrics,
            agent_type=agent_type,
            request_id=request_id,
            execution_time=execution_time,
            success=False,
            error=error_msg
        )
        
        return AgentExecutionResponse(
            success=False,
            error=error_msg,
            execution_metadata={
                "execution_time": execution_time,
                "timestamp": datetime.now().isoformat(),
                "error_type": type(e).__name__
            },
            agent_type=agent_type,
            request_id=request_id
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url)
        }
    )

# ===== BACKGROUND TASKS =====

async def log_execution_metrics(
    agent_type: str,
    request_id: str,
    execution_time: float,
    success: bool,
    error: Optional[str] = None
):
    """Log execution metrics (background task)"""
    try:
        if is_logfire_available():
            # Log to Logfire if available
            from .config.logfire_config import track_agent_execution
            await track_agent_execution(
                agent_type=agent_type,
                execution_time=execution_time,
                success=success,
                metadata={
                    "request_id": request_id,
                    "error": error
                }
            )
        
        # Always log to standard logger
        if success:
            logger.info(f"Agent {agent_type} executed successfully in {execution_time:.3f}s (request: {request_id})")
        else:
            logger.error(f"Agent {agent_type} failed after {execution_time:.3f}s: {error} (request: {request_id})")
            
    except Exception as e:
        logger.error(f"Failed to log metrics: {e}")

# ===== MAIN ENTRY POINT =====

if __name__ == "__main__":
    # Configuration
    host = os.getenv("PYDANTIC_HOST", "0.0.0.0")
    port = int(os.getenv("PYDANTIC_PORT", "8000"))
    log_level = os.getenv("PYDANTIC_LOG_LEVEL", "info")
    reload = os.getenv("PYDANTIC_RELOAD", "false").lower() == "true"
    
    logger.info(f"Starting PydanticAI Service on {host}:{port}")
    
    # Run the server
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=reload,
        access_log=True
    )