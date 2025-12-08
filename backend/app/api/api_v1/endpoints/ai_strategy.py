from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.base import User, UserSecret
from app.core.encryption import decrypt_value
import google.generativeai as genai

router = APIRouter()

class StrategyGenRequest(BaseModel):
    prompt: str
    current_code: Optional[str] = None
    mode: Literal["pinescript", "python"] = "pinescript"  # New: Language mode

class StrategyGenResponse(BaseModel):
    code: str
    explanation: str


# ============= PINE SCRIPT SYSTEM PROMPT =============
PINESCRIPT_SYSTEM_PROMPT = """You are an expert Pine Script v5 and v6 Developer.
Your task is to generate valid, compilable Pine Script code based on the user's description.

Rules:
1. Output ONLY the code inside a ```pinescript block.
2. Followed by a brief explanation.
3. Use `strategy()` for strategies, `indicator()` for indicators.
4. Include `overlay=true` if it should be on the main chart.
5. Use strict v5 syntax.
"""

# ============= PYTHON STRATEGY SYSTEM PROMPT =============
PYTHON_SYSTEM_PROMPT = """You are an expert Python Trading Strategy Developer.
Your task is to generate valid, executable Python code for algorithmic trading strategies.

The code will run in a sandboxed environment with pandas and numpy available.
The code receives a pandas DataFrame `df` with columns: timestamp, open, high, low, close, volume

REQUIRED STRUCTURE:
```python
import pandas as pd
import numpy as np

def calculate(df: pd.DataFrame) -> pd.DataFrame:
    '''
    Calculate trading signals based on the strategy logic.
    
    Args:
        df: DataFrame with columns [timestamp, open, high, low, close, volume]
    
    Returns:
        DataFrame with an additional 'signal' column:
        - signal = 1 for BUY/LONG entry
        - signal = -1 for SELL/EXIT
        - signal = 0 for no action (hold)
    '''
    # Initialize signal column
    df['signal'] = 0
    
    # YOUR STRATEGY LOGIC HERE
    # Example: Simple Moving Average Crossover
    # df['sma_fast'] = df['close'].rolling(window=10).mean()
    # df['sma_slow'] = df['close'].rolling(window=30).mean()
    # df.loc[(df['sma_fast'] > df['sma_slow']) & (df['sma_fast'].shift(1) <= df['sma_slow'].shift(1)), 'signal'] = 1
    # df.loc[(df['sma_fast'] < df['sma_slow']) & (df['sma_fast'].shift(1) >= df['sma_slow'].shift(1)), 'signal'] = -1
    
    return df
```

Rules:
1. Output the code inside a ```python block.
2. Followed by a brief explanation.
3. ALWAYS include the `calculate(df)` function that returns a DataFrame with a 'signal' column.
4. Use only pandas and numpy operations (no external APIs, no file I/O).
5. Handle NaN values properly (use fillna or dropna where appropriate).
6. Ensure the strategy is vectorized for performance.
7. Add helpful comments explaining the logic.
8. Signal values: 1 = BUY, -1 = SELL, 0 = HOLD
"""


@router.post("/generate_strategy", response_model=StrategyGenResponse)
async def generate_strategy(
    request: StrategyGenRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # 1. Fetch AI API Key (Gemini)
    result = await db.execute(select(UserSecret).where(
        UserSecret.user_id == current_user.id,
        UserSecret.provider == "gemini",
        UserSecret.is_valid == True
    ))
    secret = result.scalars().first()
    
    if not secret:
        # Fallback
        result = await db.execute(select(UserSecret).where(
            UserSecret.user_id == current_user.id,
            UserSecret.provider == "gemini"
        ))
        secret = result.scalars().first()

    if not secret:
        raise HTTPException(status_code=400, detail="AI API Key not found. Please add a Google Gemini key in Settings.")
        
    try:
        api_key = decrypt_value(secret.encrypted_value)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt API Key.")

    # 2. Configure Gemini
    try:
        genai.configure(api_key=api_key)
        model_name = secret.model or 'gemini-2.5-flash'
        model = genai.GenerativeModel(model_name)
        
        # 3. Select System Prompt based on mode
        if request.mode == "python":
            system_prompt = PYTHON_SYSTEM_PROMPT
            code_block_marker = "```python"
        else:
            system_prompt = PINESCRIPT_SYSTEM_PROMPT
            code_block_marker = "```pinescript"
        
        user_prompt = f"User Request: {request.prompt}"
        if request.current_code:
            user_prompt += f"\n\nExisting Code:\n{request.current_code}\n\n(Modify or improve this code based on the request)"

        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        
        # 4. Generate Content
        response = model.generate_content(full_prompt)
        text = response.text
        
        # 5. Parse Response (Extract Code and Explanation)
        code = ""
        explanation = text
        
        # Try the specific code block marker first
        if code_block_marker in text:
            parts = text.split(code_block_marker)
            if len(parts) > 1:
                code_part = parts[1].split("```")[0]
                code = code_part.strip()
                explanation = parts[1].split("```")[1].strip() if len(parts[1].split("```")) > 1 else ""
        elif "```" in text:  # Fallback if language tag is missing
            parts = text.split("```")
            if len(parts) > 1:
                code = parts[1].strip()
                # Remove language identifier if present
                if code.startswith("python\n"):
                    code = code[7:]
                elif code.startswith("pinescript\n"):
                    code = code[11:]
                explanation = parts[2].strip() if len(parts) > 2 else ""
                
        if not code:
            # If no code block found, check if model outputted raw code
            if request.mode == "python":
                if "def calculate" in text or "import pandas" in text:
                    code = text
                    explanation = "Generated Python strategy based on your request."
                else:
                    code = "# Could not generate valid code block."
                    explanation = text
            else:
                if "//" in text or "strategy(" in text or "indicator(" in text:
                    code = text
                    explanation = "Generated based on your request."
                else:
                    code = "// Could not generate valid code block."
                    explanation = text

        return StrategyGenResponse(code=code, explanation=explanation)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Provider Error: {str(e)}")
