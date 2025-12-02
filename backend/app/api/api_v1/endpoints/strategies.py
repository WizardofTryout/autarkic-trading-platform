from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.services.pine_transpiler.parser import parse_pine_script

router = APIRouter()

class PineScriptRequest(BaseModel):
    script: str

class CompilationResult(BaseModel):
    success: bool
    parsed_script: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@router.post("/compile", response_model=CompilationResult)
async def compile_strategy(request: PineScriptRequest):
    """
    Compiles a Pine Script strategy.
    Currently, this parses the script to verify syntax and structure.
    """
    try:
        parsed = parse_pine_script(request.script)
        return CompilationResult(success=True, parsed_script=parsed)
    except Exception as e:
        return CompilationResult(success=False, error=str(e))

@router.post("/save")
async def save_strategy(request: PineScriptRequest):
    """
    Saves a strategy.
    TODO: Implement database storage.
    """
    return {"status": "success", "message": "Strategy saved (mock)"}
