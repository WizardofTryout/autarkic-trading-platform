/**
 * Fair Value Gap (FVG) Detection Utility
 * 
 * A Fair Value Gap occurs when there's a gap between candles that hasn't been filled.
 * - Bullish FVG: Gap between candle 1's high and candle 3's low (candle 2 creates the gap)
 * - Bearish FVG: Gap between candle 1's low and candle 3's high (candle 2 creates the gap)
 */

export interface FVGZone {
    id: string;
    type: 'bullish' | 'bearish';
    startTime: number | string;
    endTime: number | string;
    topPrice: number;
    bottomPrice: number;
    filled: boolean;
    filledAt?: number | string;
}

export interface CandleData {
    time: number | string;
    open: number;
    high: number;
    low: number;
    close: number;
}

/**
 * Detect Fair Value Gaps in OHLC data
 * @param candles Array of candle data
 * @param minGapSize Minimum gap size in price units (optional filter)
 * @returns Array of FVG zones
 */
export function detectFairValueGaps(
    candles: CandleData[],
    minGapSize: number = 0
): FVGZone[] {
    const fvgZones: FVGZone[] = [];

    // Need at least 3 candles to detect an FVG
    if (candles.length < 3) return fvgZones;

    for (let i = 0; i < candles.length - 2; i++) {
        const candle1 = candles[i];
        const candle2 = candles[i + 1];
        const candle3 = candles[i + 2];

        // Bullish FVG: candle1.high < candle3.low
        // The gap is between candle1's high and candle3's low
        if (candle1.high < candle3.low) {
            const gapSize = candle3.low - candle1.high;

            if (gapSize >= minGapSize) {
                // Check if this FVG has been filled by subsequent candles
                let filled = false;
                let filledAt: number | string | undefined;

                for (let j = i + 3; j < candles.length; j++) {
                    const futureCandle = candles[j];
                    // FVG is filled if price goes back into the gap
                    if (futureCandle.low <= candle1.high) {
                        filled = true;
                        filledAt = futureCandle.time;
                        break;
                    }
                }

                fvgZones.push({
                    id: `fvg-bull-${i}-${candle1.time}`,
                    type: 'bullish',
                    startTime: candle1.time,
                    endTime: filled && filledAt ? filledAt : candles[candles.length - 1].time,
                    topPrice: candle3.low,
                    bottomPrice: candle1.high,
                    filled,
                    filledAt
                });
            }
        }

        // Bearish FVG: candle1.low > candle3.high
        // The gap is between candle3's high and candle1's low
        if (candle1.low > candle3.high) {
            const gapSize = candle1.low - candle3.high;

            if (gapSize >= minGapSize) {
                // Check if this FVG has been filled by subsequent candles
                let filled = false;
                let filledAt: number | string | undefined;

                for (let j = i + 3; j < candles.length; j++) {
                    const futureCandle = candles[j];
                    // FVG is filled if price goes back into the gap
                    if (futureCandle.high >= candle1.low) {
                        filled = true;
                        filledAt = futureCandle.time;
                        break;
                    }
                }

                fvgZones.push({
                    id: `fvg-bear-${i}-${candle1.time}`,
                    type: 'bearish',
                    startTime: candle1.time,
                    endTime: filled && filledAt ? filledAt : candles[candles.length - 1].time,
                    topPrice: candle1.low,
                    bottomPrice: candle3.high,
                    filled,
                    filledAt
                });
            }
        }
    }

    return fvgZones;
}

/**
 * Filter FVG zones to show only recent/unfilled ones
 * @param fvgZones All detected FVG zones
 * @param showFilled Whether to show filled FVGs
 * @param maxCount Maximum number of FVGs to show
 * @returns Filtered FVG zones
 */
export function filterFVGZones(
    fvgZones: FVGZone[],
    showFilled: boolean = false,
    maxCount: number = 10
): FVGZone[] {
    let filtered = fvgZones;

    // Filter out filled FVGs if requested
    if (!showFilled) {
        filtered = filtered.filter(fvg => !fvg.filled);
    }

    // Return most recent FVGs
    return filtered.slice(-maxCount);
}
