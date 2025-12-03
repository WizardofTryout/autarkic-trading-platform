import pandas as pd

def rsi(data: pd.Series, period: int = 14) -> pd.Series:
    """
    Calculates the Relative Strength Index (RSI).
    """
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/period, adjust=False).mean()

    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def macd(data: pd.Series, fast_period: int = 12, slow_period: int = 26, signal_period: int = 9):
    """
    Calculates the Moving Average Convergence Divergence (MACD).
    """
    fast_ema = data.ewm(span=fast_period, adjust=False).mean()
    slow_ema = data.ewm(span=slow_period, adjust=False).mean()
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def sma(data: pd.Series, length: int) -> pd.Series:
    """
    Calculates the Simple Moving Average (SMA).
    """
    return data.rolling(window=length).mean()

def ema(data: pd.Series, length: int) -> pd.Series:
    """
    Calculates the Exponential Moving Average (EMA).
    """
    return data.ewm(span=length, adjust=False).mean()

def wma(data: pd.Series, length: int) -> pd.Series:
    """
    Calculates the Weighted Moving Average (WMA).
    """
    weights = pd.Series(range(1, length + 1))
    return data.rolling(window=length).apply(lambda x: (x * weights).sum() / weights.sum(), raw=True)

def atr(high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14) -> pd.Series:
    """
    Calculates the Average True Range (ATR).
    """
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=length).mean() # Simple ATR, can be RMA

def bb(data: pd.Series, length: int = 20, mult: float = 2.0):
    """
    Calculates Bollinger Bands.
    Returns: middle, upper, lower (Matches Pine Script ta.bb)
    """
    basis = sma(data, length)
    dev = mult * data.rolling(window=length).std()
    upper = basis + dev
    lower = basis - dev
    return basis, upper, lower

def crossover(series1: pd.Series, series2: pd.Series) -> pd.Series:
    """
    Returns True where series1 crosses over series2.
    Logic: (series1 > series2) AND (prev_series1 <= prev_series2)
    """
    # Ensure inputs are Series
    if not isinstance(series1, pd.Series):
        series1 = pd.Series(series1, index=series2.index)
    if not isinstance(series2, pd.Series):
        series2 = pd.Series(series2, index=series1.index)
        
    cond1 = series1 > series2
    cond2 = series1.shift(1) <= series2.shift(1)
    return cond1 & cond2

def crossunder(series1: pd.Series, series2: pd.Series) -> pd.Series:
    """
    Returns True where series1 crosses under series2.
    Logic: (series1 < series2) AND (prev_series1 >= prev_series2)
    """
    # Ensure inputs are Series
    if not isinstance(series1, pd.Series):
        series1 = pd.Series(series1, index=series2.index)
    if not isinstance(series2, pd.Series):
        series2 = pd.Series(series2, index=series1.index)

    cond1 = series1 < series2
    cond2 = series1.shift(1) >= series2.shift(1)
    return cond1 & cond2
