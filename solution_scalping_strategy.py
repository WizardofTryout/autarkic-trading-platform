
import pandas as pd
import numpy as np

def calculate(df: pd.DataFrame) -> pd.DataFrame:
    """
    Test Strategy for System Verification
    Logic:
    1. SMA 20 Trend Following.
    2. Enter Long (Signal 1): Close > SMA 20 (and candle is green).
    3. Exit Long (Signal -1): Close < SMA 20 (and candle is red).
    
    This strategy is designed to generate frequent signals to verify the bot's execution cycles.
    """
    # Parameters
    sma_length = 20
    
    if len(df) < sma_length:
        df['signal'] = 0
        return df

    # Indicator
    df['SMA'] = df['close'].rolling(window=sma_length).mean()
    
    # Logic
    df['signal'] = 0
    
    # Entry Condition (Long)
    # Candle is Green AND Close is above SMA
    cond_entry = (df['close'] > df['open']) & (df['close'] > df['SMA'])
    
    # Exit Condition (Close Long)
    # Candle is Red AND Close is below SMA
    cond_exit = (df['close'] < df['open']) & (df['close'] < df['SMA'])
    
    # Apply Signals
    df.loc[cond_entry, 'signal'] = 1
    df.loc[cond_exit, 'signal'] = -1
    
    return df
