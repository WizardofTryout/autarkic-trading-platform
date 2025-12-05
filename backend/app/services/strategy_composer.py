"""
AI Strategy Composer Service

Combines multiple indicators into a complete trading strategy using Gemini AI.
"""

from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import google.generativeai as genai

from app.models.base import Strategy, UserSettings
from app.core.security import decrypt_api_key


async def compose_strategy(
    user_id: UUID,
    indicator_ids: List[str],
    composition_prompt: str,
    db: AsyncSession
) -> str:
    """
    Compose multiple indicators into a single trading strategy using AI.
    
    Args:
        user_id: User's UUID
        indicator_ids: List of indicator strategy IDs to combine
        composition_prompt: User's instructions for how to combine them
        db: Database session
        
    Returns:
        Generated Python code for the composed strategy
        
    Raises:
        ValueError: If indicators not found or API key missing
        Exception: For API errors
    """
    
    # 1. Retrieve user's Gemini API key
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    user_settings = result.scalar_one_or_none()
    
    if not user_settings or not user_settings.gemini_api_key_encrypted:
        raise ValueError(
            "Gemini API key not configured. Please add your API key in settings."
        )
    
    api_key = decrypt_api_key(user_settings.gemini_api_key_encrypted)
    
    # 2. Load all indicator Python codes from database
    indicator_codes = []
    indicator_names = []
    
    for indicator_id in indicator_ids:
        result = await db.execute(
            select(Strategy).where(
                Strategy.id == indicator_id,
                Strategy.user_id == user_id,
                Strategy.type == 'indicator'
            )
        )
        indicator = result.scalar_one_or_none()
        
        if not indicator:
            raise ValueError(f"Indicator {indicator_id} not found or not an indicator type")
        
        if not indicator.python_code:
            raise ValueError(
                f"Indicator '{indicator.name}' has no Python code. "
                f"Please generate Python code first using the transpiler."
            )
        
        indicator_codes.append({
            'name': indicator.name,
            'code': indicator.python_code
        })
        indicator_names.append(indicator.name)
    
    # 3. Build AI composition prompt
    indicators_section = "\n\n".join([
        f"### Indicator {i+1}: {ind['name']}\n```python\n{ind['code']}\n```"
        for i, ind in enumerate(indicator_codes)
    ])
    
    system_prompt = f"""You are an expert Python trading strategy developer specializing in combining technical indicators.

Your task is to combine the following {len(indicator_codes)} indicators into a single, cohesive trading strategy.

{indicators_section}

**User's Composition Instructions:**
{composition_prompt}

**Requirements:**
1. Create a single Python function called `calculate(df: pd.DataFrame) -> pd.DataFrame`
2. The function should:
   - Accept a pandas DataFrame with columns: timestamp, open, high, low, close, volume
   - Call each indicator's calculate function
   - Combine their signals according to the user's instructions
   - Add a 'signal' column: 1 for BUY, -1 for SELL, 0 for HOLD
   - Return the DataFrame with all indicator columns plus the 'signal' column
3. Use proper pandas operations (vectorized when possible)
4. Handle edge cases (NaN values, insufficient data)
5. Add comments explaining the combination logic
6. Import only: pandas as pd, numpy as np

**Example Structure:**
```python
import pandas as pd
import numpy as np

def calculate(df: pd.DataFrame) -> pd.DataFrame:
    # Calculate indicator 1
    # ... (call first indicator's logic)
    
    # Calculate indicator 2
    # ... (call second indicator's logic)
    
    # Combine signals based on user's instructions
    df['signal'] = 0  # Initialize
    
    # Your combination logic here
    # Example: df.loc[(condition1) & (condition2), 'signal'] = 1
    
    return df
```

Return ONLY the Python code, no explanations. The code must be production-ready and executable."""

    # 4. Call Gemini API
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        response = model.generate_content(
            system_prompt,
            generation_config={
                'temperature': 0.3,  # Lower temperature for more consistent code
                'top_p': 0.95,
                'top_k': 40,
                'max_output_tokens': 4096,
            }
        )
        
        if not response or not response.text:
            raise Exception("Empty response from Gemini API")
        
        python_code = response.text.strip()
        
        # 5. Clean up markdown code blocks if present
        if python_code.startswith('```python'):
            python_code = python_code.split('```python')[1]
            python_code = python_code.split('```')[0]
        elif python_code.startswith('```'):
            python_code = python_code.split('```')[1]
            python_code = python_code.split('```')[0]
        
        python_code = python_code.strip()
        
        return python_code
        
    except Exception as e:
        error_msg = str(e)
        if 'API_KEY_INVALID' in error_msg or 'invalid api key' in error_msg.lower():
            raise ValueError("Invalid Gemini API key. Please check your settings.")
        elif 'quota' in error_msg.lower() or 'rate limit' in error_msg.lower():
            raise Exception("Gemini API rate limit exceeded. Please try again later.")
        else:
            raise Exception(f"Gemini API error: {error_msg}")
