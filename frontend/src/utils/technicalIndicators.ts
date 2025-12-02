/**
 * Technical Indicators Utility Functions
 * Phase 1 Implementation: RSI, Bollinger Bands, MACD
 */

export interface CandlestickData {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface IndicatorData extends CandlestickData {
    date: Date;
    rsi?: number;
    bollingerBands?: {
        upper: number;
        middle: number; // SMA
        lower: number;
    };
    macd?: {
        macd: number;
        signal: number;
        histogram: number;
    };
    sma20?: number;
    ema12?: number;
    ema26?: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
            result.push(sum / period);
        }
    }
    
    return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            result.push(data[i]);
        } else if (result[i - 1] !== null) {
            const ema = (data[i] - (result[i - 1] as number)) * multiplier + (result[i - 1] as number);
            result.push(ema);
        } else {
            result.push(data[i]);
        }
    }
    
    return result;
}

/**
 * Calculate Relative Strength Index (RSI)
 * Standard period: 14
 */
export function calculateRSI(prices: number[], period: number = 14): (number | null)[] {
    if (prices.length < period + 1) {
        return new Array(prices.length).fill(null);
    }
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const result: (number | null)[] = [null]; // First value is always null
    
    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    
    // Calculate first RSI
    const rs1 = avgGain / (avgLoss || 0.0001); // Avoid division by zero
    result.push(100 - (100 / (1 + rs1)));
    
    // Calculate subsequent RSI values using smoothed averages
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        
        const rs = avgGain / (avgLoss || 0.0001);
        result.push(100 - (100 / (1 + rs)));
    }
    
    return result;
}

/**
 * Calculate Bollinger Bands
 * Standard: 20-period SMA with 2 standard deviations
 */
export function calculateBollingerBands(
    prices: number[], 
    period: number = 20, 
    standardDeviations: number = 2
): Array<{ upper: number | null; middle: number | null; lower: number | null }> {
    
    const sma = calculateSMA(prices, period);
    const result: Array<{ upper: number | null; middle: number | null; lower: number | null }> = [];
    
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            // For the initial period, still calculate with available data
            const availablePrices = prices.slice(0, i + 1);
            if (availablePrices.length >= 2) {
                const mean = availablePrices.reduce((sum, price) => sum + price, 0) / availablePrices.length;
                const squaredDiffs = availablePrices.map(price => Math.pow(price - mean, 2));
                const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / availablePrices.length;
                const stdDev = Math.sqrt(variance);
                
                result.push({
                    upper: mean + (standardDeviations * stdDev),
                    middle: mean,
                    lower: mean - (standardDeviations * stdDev)
                });
            } else {
                result.push({ upper: null, middle: null, lower: null });
            }
        } else {
            // Calculate standard deviation for the full period
            const periodPrices = prices.slice(i - period + 1, i + 1);
            const mean = sma[i] as number;
            const squaredDiffs = periodPrices.map(price => Math.pow(price - mean, 2));
            const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
            const stdDev = Math.sqrt(variance);
            
            result.push({
                upper: mean + (standardDeviations * stdDev),
                middle: mean,
                lower: mean - (standardDeviations * stdDev)
            });
        }
    }
    
    return result;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * Standard: 12-period EMA, 26-period EMA, 9-period Signal EMA
 */
export function calculateMACD(
    prices: number[], 
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    signalPeriod: number = 9
): Array<{ macd: number | null; signal: number | null; histogram: number | null }> {
    
    const ema12 = calculateEMA(prices, fastPeriod);
    const ema26 = calculateEMA(prices, slowPeriod);
    
    // Calculate MACD line (EMA12 - EMA26)
    const macdLine: (number | null)[] = [];
    for (let i = 0; i < prices.length; i++) {
        if (ema12[i] !== null && ema26[i] !== null) {
            macdLine.push((ema12[i] as number) - (ema26[i] as number));
        } else {
            macdLine.push(null);
        }
    }
    
    // Calculate Signal line (9-period EMA of MACD)
    const validMacdValues = macdLine.filter(val => val !== null) as number[];
    const signalEMA = calculateEMA(validMacdValues, signalPeriod);
    
    // Align signal values with original data length
    const signal: (number | null)[] = new Array(prices.length).fill(null);
    let signalIndex = 0;
    for (let i = 0; i < macdLine.length; i++) {
        if (macdLine[i] !== null) {
            signal[i] = signalEMA[signalIndex] || null;
            signalIndex++;
        }
    }
    
    // Calculate Histogram (MACD - Signal)
    const result: Array<{ macd: number | null; signal: number | null; histogram: number | null }> = [];
    for (let i = 0; i < prices.length; i++) {
        const macd = macdLine[i];
        const sig = signal[i];
        const histogram = (macd !== null && sig !== null) ? macd - sig : null;
        
        result.push({
            macd,
            signal: sig,
            histogram
        });
    }
    
    return result;
}

/**
 * Process candlestick data and add all technical indicators
 */
export function addTechnicalIndicators(data: CandlestickData[]): IndicatorData[] {
    if (data.length === 0) return [];
    
    // Convert time to Date objects and extract close prices
    const closePrices = data.map(item => item.close);
    
    // Calculate all indicators
    const rsi = calculateRSI(closePrices, 14);
    const bollingerBands = calculateBollingerBands(closePrices, 20, 2);
    const macd = calculateMACD(closePrices, 12, 26, 9);
    const sma20 = calculateSMA(closePrices, 20);
    
    // Combine data with indicators
    return data.map((item, index) => {
        // Parse date
        let date: Date;
        if (typeof item.time === 'string') {
            date = new Date(item.time);
        } else {
            date = new Date(item.time * 1000);
        }
        
        return {
            ...item,
            date,
            rsi: rsi[index],
            bollingerBands: {
                upper: bollingerBands[index].upper,
                middle: bollingerBands[index].middle,
                lower: bollingerBands[index].lower
            },
            macd: {
                macd: macd[index].macd,
                signal: macd[index].signal,
                histogram: macd[index].histogram
            },
            sma20: sma20[index]
        } as IndicatorData;
    });
}

/**
 * Get trading signals based on indicators
 */
export interface TradingSignal {
    type: 'buy' | 'sell' | 'neutral';
    strength: number; // 0-100
    reasons: string[];
}

export function getTradingSignals(data: IndicatorData[]): TradingSignal {
    if (data.length < 2) {
        return { type: 'neutral', strength: 0, reasons: ['Insufficient data'] };
    }
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    const signals: Array<{ type: 'buy' | 'sell'; strength: number; reason: string }> = [];
    
    // RSI Signals
    if (current.rsi !== null && current.rsi !== undefined) {
        if (current.rsi < 30) {
            signals.push({ type: 'buy', strength: 70, reason: 'RSI oversold (<30)' });
        } else if (current.rsi > 70) {
            signals.push({ type: 'sell', strength: 70, reason: 'RSI overbought (>70)' });
        }
    }
    
    // Bollinger Bands Signals
    if (current.bollingerBands && current.bollingerBands.lower && current.bollingerBands.upper) {
        if (current.close < current.bollingerBands.lower) {
            signals.push({ type: 'buy', strength: 60, reason: 'Price below lower Bollinger Band' });
        } else if (current.close > current.bollingerBands.upper) {
            signals.push({ type: 'sell', strength: 60, reason: 'Price above upper Bollinger Band' });
        }
    }
    
    // MACD Signals
    if (current.macd && previous.macd && 
        current.macd.macd !== null && current.macd.signal !== null &&
        previous.macd.macd !== null && previous.macd.signal !== null) {
        
        // MACD crossover
        if (previous.macd.macd <= previous.macd.signal && current.macd.macd > current.macd.signal) {
            signals.push({ type: 'buy', strength: 75, reason: 'MACD bullish crossover' });
        } else if (previous.macd.macd >= previous.macd.signal && current.macd.macd < current.macd.signal) {
            signals.push({ type: 'sell', strength: 75, reason: 'MACD bearish crossover' });
        }
    }
    
    // Aggregate signals
    if (signals.length === 0) {
        return { type: 'neutral', strength: 0, reasons: ['No clear signals'] };
    }
    
    const buySignals = signals.filter(s => s.type === 'buy');
    const sellSignals = signals.filter(s => s.type === 'sell');
    
    const buyStrength = buySignals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
    const sellStrength = sellSignals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
    
    if (buyStrength > sellStrength && buySignals.length > 0) {
        return {
            type: 'buy',
            strength: Math.min(buyStrength, 100),
            reasons: buySignals.map(s => s.reason)
        };
    } else if (sellStrength > buyStrength && sellSignals.length > 0) {
        return {
            type: 'sell',
            strength: Math.min(sellStrength, 100),
            reasons: sellSignals.map(s => s.reason)
        };
    } else {
        return {
            type: 'neutral',
            strength: 50,
            reasons: ['Mixed signals']
        };
    }
}
