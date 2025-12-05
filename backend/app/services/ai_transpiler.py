"""
AI Transpiler Service

Converts Pine Script DSL to executable Python code using Google Gemini AI.
"""

from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException
import google.generativeai as genai
import re

from app.models.base import UserSecret
from app.core.encryption import decrypt_value


async def transpile_pine_to_python(
    user_id: UUID,
    pine_script: str,
    db: AsyncSession
) -> str:
    """
    Transpile Pine Script to Python using Gemini AI.
    
    Args:
        user_id: UUID of the user making the request
        pine_script: Pine Script source code to transpile
        db: Database session
        
    Returns:
        Clean Python code string
        
    Raises:
        HTTPException: 400 if API key missing, 502 if AI fails, 500 for other errors
    """
    
    # 1. Retrieve User's Gemini API Key
    result = await db.execute(select(UserSecret).where(
        UserSecret.user_id == user_id,
        UserSecret.provider == "gemini",
        UserSecret.is_valid == True
    ))
    secret = result.scalars().first()
    
    # Fallback to any Gemini key if no validated key found
    if not secret:
        result = await db.execute(select(UserSecret).where(
            UserSecret.user_id == user_id,
            UserSecret.provider == "gemini"
        ))
        secret = result.scalars().first()
    
    if not secret:
        raise HTTPException(
            status_code=400,
            detail="Missing API Key: Please add a Google Gemini API key in Settings."
        )
    
    # 2. Decrypt API Key
    try:
        api_key = decrypt_value(secret.encrypted_value)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to decrypt API Key: {str(e)}"
        )
    
    # 3. Configure Gemini
    try:
        genai.configure(api_key=api_key)
        model_name = secret.model or 'gemini-2.5-flash'
        model = genai.GenerativeModel(model_name)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to configure AI model: {str(e)}"
        )
    
    # 4. Construct Specialized Prompt
    system_prompt = """You are an expert code transpiler specializing in converting Pine Script (TradingView's DSL) to executable Python code.

Your task is to convert the provided Pine Script code into a Python function that can be used in a backtesting engine.

CRITICAL REQUIREMENTS:
1. Output ONLY the Python code, wrapped in a ```python code block
2. The function MUST have this exact signature: def calculate(df: pd.DataFrame) -> pd.DataFrame
3. Input DataFrame 'df' will have columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume']
4. Return the same DataFrame with additional columns for indicators/signals
5. Use pandas and numpy for calculations (these are already imported)
6. For indicators like RSI, MACD, Bollinger Bands, implement them using pandas operations
7. For strategy signals, add a 'signal' column with values: 1 (BUY), -1 (SELL), 0 (NEUTRAL)
8. Do NOT include any explanatory text before or after the code block
9. Ensure the code is syntactically correct and executable

EXAMPLE INPUT (Pine Script):
//@version=5
indicator("My RSI")
rsi_val = ta.rsi(close, 14)
plot(rsi_val)

EXAMPLE OUTPUT (Python):
```python
def calculate(df: pd.DataFrame) -> pd.DataFrame:
    # Calculate RSI (14-period)
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    return df
```

Now convert the following Pine Script:
"""
    
    full_prompt = f"{system_prompt}\n\n{pine_script}"
    
    # 5. Generate Python Code
    try:
        response = model.generate_content(full_prompt)
        raw_text = response.text
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI Provider Error: {str(e)}"
        )
    
    # 6. Filter Markdown Code Blocks
    python_code = _extract_python_code(raw_text)
    
    if not python_code:
        raise HTTPException(
            status_code=500,
            detail="AI failed to generate valid Python code. Please try again or modify your Pine Script."
        )
    
    return python_code


def _extract_python_code(text: str) -> Optional[str]:
    """
    Extract Python code from markdown code blocks.
    
    Handles formats:
    - ```python ... ```
    - ``` ... ```
    - Plain code (if no markdown blocks found)
    """
    
    # Try to extract from ```python block
    python_block_pattern = r'```python\s*(.*?)\s*```'
    matches = re.findall(python_block_pattern, text, re.DOTALL)
    if matches:
        return matches[0].strip()
    
    # Try to extract from generic ``` block
    generic_block_pattern = r'```\s*(.*?)\s*```'
    matches = re.findall(generic_block_pattern, text, re.DOTALL)
    if matches:
        return matches[0].strip()
    
    # If no code blocks found, check if the text looks like Python code
    if 'def calculate' in text:
        return text.strip()
    
    return None
