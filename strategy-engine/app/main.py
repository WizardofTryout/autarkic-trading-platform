from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import pandas as pd

from app.sandbox import execute_python_code

app = FastAPI(title="Strategy Engine Service")


class ExecuteRequest(BaseModel):
    python_code: str
    data: Dict[str, List[Any]]  # OHLCV data as dict
    timeout: Optional[int] = 3


class ExecuteResponse(BaseModel):
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    columns: Optional[List[str]] = None
    message: Optional[str] = None
    error: Optional[str] = None


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "strategy-engine"}


@app.get("/")
async def root():
    return {"message": "Welcome to Strategy Engine"}


@app.post("/execute", response_model=ExecuteResponse)
async def execute_strategy(request: ExecuteRequest):
    """
    Execute Python code in a secure sandbox environment
    
    Security features:
    - Timeout protection (default: 3 seconds)
    - Import restrictions (only pandas, numpy allowed)
    - No access to os, sys, subprocess, etc.
    """
    try:
        # Convert input data to DataFrame
        df = pd.DataFrame(request.data)
        
        # Execute code in sandbox
        result = execute_python_code(
            code=request.python_code,
            data={'df': df},
            timeout_seconds=request.timeout
        )
        
        return ExecuteResponse(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Execution failed: {str(e)}"
        )
