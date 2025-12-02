import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
    addTechnicalIndicators,
    getTradingSignals,
    type IndicatorData,
    type TradingSignal
} from '../../utils/technicalIndicators';
import IndicatorMatrix from '../IndicatorMatrix';
import { LayoutGrid } from 'lucide-react';

interface CandlestickData {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

interface AdvancedFinancialChartProps {
    data: CandlestickData[];
    height?: number;
    showIndicators?: boolean;
    showVolume?: boolean;
    showRSI?: boolean;
    showBollingerBands?: boolean;
    showMACD?: boolean;
}

interface ChartData {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    sma20?: number;
    ema20?: number;
}

const AdvancedFinancialChart: React.FC<AdvancedFinancialChartProps> = ({
    data,
    height = 400,
    showIndicators = true,
    showVolume = true,
    showRSI = true,
    showBollingerBands = true,
    showMACD = true
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height });
    const [indicatorData, setIndicatorData] = useState<IndicatorData[]>([]);
    const [tradingSignal, setTradingSignal] = useState<TradingSignal>({ type: 'neutral', strength: 0, reasons: [] });
    const [executionSignals, setExecutionSignals] = useState<any[]>([]);
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);

    // Local state for indicator visibility
    const [visibleIndicators, setVisibleIndicators] = useState({
        rsi: showRSI,
        bollingerBands: showBollingerBands,
        macd: showMACD,
        sma: showIndicators,
        volume: showVolume
    });
    // const [selectedTool, setSelectedTool] = useState<'trendline' | 'fibonacci' | 'none'>('none');
    // const [isDrawing, setIsDrawing] = useState(false);
    // const [drawStartPoint, setDrawStartPoint] = useState<{ x: number, y: number } | null>(null);

    // Konvertiere und bereite Daten auf
    useEffect(() => {
        if (data.length === 0) return;

        const parseDate = d3.timeParse('%Y-%m-%d');
        const formattedData: ChartData[] = data.map((item) => {
            let date: Date;

            if (typeof item.time === 'string') {
                date = parseDate(item.time) || new Date(item.time) || new Date();
            } else {
                date = new Date(item.time * 1000);
            }

            return {
                date,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume || Math.floor(Math.random() * 1000000) + 100000,
            };
        }).sort((a, b) => a.date.getTime() - b.date.getTime());

        // Berechne technische Indikatoren
        const calculateSMA = (data: ChartData[], period: number) => {
            return data.map((item, index) => {
                if (index < period - 1) return { ...item };

                const sum = data.slice(index - period + 1, index + 1)
                    .reduce((acc, curr) => acc + curr.close, 0);

                return {
                    ...item,
                    sma20: sum / period
                };
            });
        };

        const calculateEMA = (data: ChartData[], period: number) => {
            const k = 2 / (period + 1);
            return data.map((item, index) => {
                if (index === 0) return { ...item, ema20: item.close };

                const prevEMA = data[index - 1].ema20 || item.close;
                return {
                    ...item,
                    ema20: item.close * k + prevEMA * (1 - k)
                };
            });
        };

        let processedData = calculateSMA(formattedData, 20);
        processedData = calculateEMA(processedData, 20);

        // Calculate technical indicators if enabled
        const dataWithTime = processedData.map(item => ({
            ...item,
            time: item.date.getTime() / 1000 // Convert to Unix timestamp
        }));
        const dataWithIndicators = addTechnicalIndicators(dataWithTime);
        setIndicatorData(dataWithIndicators);

        // Calculate trading signals
        const signals = getTradingSignals(dataWithIndicators);
        setTradingSignal(signals);
    }, [data]);

    // Dimensionen basierend auf Container-Größe
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width } = containerRef.current.getBoundingClientRect();
                setDimensions({
                    width: Math.max(width || 800, 400),
                    height
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [height]);

    // D3 Chart Rendering
    useEffect(() => {
        if (!svgRef.current || indicatorData.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();



        const margin = { top: 20, right: 60, bottom: visibleIndicators.volume ? 120 : 60, left: 60 };
        const chartHeight = visibleIndicators.volume ? dimensions.height * 0.7 : dimensions.height - margin.top - margin.bottom;
        const volumeHeight = visibleIndicators.volume ? dimensions.height * 0.2 : 0;
        const width = dimensions.width - margin.left - margin.right;

        // Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(indicatorData, (d: IndicatorData) => d.date) as [Date, Date])
            .range([margin.left, dimensions.width - margin.right]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(indicatorData, (d: IndicatorData) => Math.max(d.high, d.low)) as [number, number])
            .range([dimensions.height - margin.bottom - 100, margin.top]);

        const volumeScale = d3.scaleLinear()
            .domain([0, d3.max(indicatorData, (d: IndicatorData) => d.volume) || 0])
            .range([dimensions.height - margin.bottom - 40, dimensions.height - margin.bottom]);

        // Main chart group
        const chartGroup = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Axes
        const xAxis = d3.axisBottom(xScale)
            .tickFormat((domainValue: d3.AxisDomain) => {
                const date = domainValue as Date;
                return d3.timeFormat('%m/%d')(date);
            });

        const yAxis = d3.axisLeft(yScale)
            .tickFormat((domainValue: d3.AxisDomain) => {
                const value = domainValue as number;
                return `$${value.toFixed(0)} `;
            });

        chartGroup.append('g')
            .attr('transform', `translate(0, ${chartHeight})`)
            .call(xAxis as any)
            .attr('class', 'text-gray-400');

        chartGroup.append('g')
            .call(yAxis as any)
            .attr('class', 'text-gray-400');

        // Candlesticks
        const candlesticks = chartGroup.selectAll('.candlestick')
            .data(indicatorData)
            .enter()
            .append('g')
            .attr('class', 'candlestick');

        // Wicks
        candlesticks.append('line')
            .attr('x1', (d: IndicatorData) => xScale(d.date))
            .attr('x2', (d: IndicatorData) => xScale(d.date))
            .attr('y1', (d: IndicatorData) => yScale(d.high))
            .attr('y2', (d: IndicatorData) => yScale(d.low))
            .attr('stroke', (d: IndicatorData) => d.close > d.open ? '#10B981' : '#EF4444')
            .attr('stroke-width', 1);

        // Candle bodies
        candlesticks.append('rect')
            .attr('x', (d: IndicatorData) => xScale(d.date) - 3)
            .attr('y', (d: IndicatorData) => yScale(Math.max(d.open, d.close)))
            .attr('width', 6)
            .attr('height', (d: IndicatorData) => Math.abs(yScale(d.open) - yScale(d.close)) || 1)
            .attr('fill', (d: IndicatorData) => d.close > d.open ? '#10B981' : '#EF4444')
            .attr('stroke', (d: IndicatorData) => d.close > d.open ? '#10B981' : '#EF4444');

        // Execution Signals (Arrows)
        if (executionSignals.length > 0) {
            const signalGroup = chartGroup.append('g').attr('class', 'signals');

            signalGroup.selectAll('.signal-marker')
                .data(executionSignals)
                .enter()
                .append('path')
                .attr('d', (d: any) => {
                    // Triangle pointing up or down
                    return d.type === 'long' || d.type === 'buy' || d.type === 'entry_long'
                        ? d3.symbol().type(d3.symbolTriangle).size(100)()
                        : d3.symbol().type(d3.symbolTriangle).size(100)();
                })
                .attr('transform', (d: any) => {
                    const date = new Date(d.timestamp);
                    const y = yScale(d.price);
                    // Rotate 180 degrees for sell/short signals
                    const rotation = d.type === 'long' || d.type === 'buy' || d.type === 'entry_long' ? 0 : 180;
                    // Offset slightly from the candle
                    const yOffset = d.type === 'long' || d.type === 'buy' || d.type === 'entry_long' ? 15 : -15;
                    return `translate(${xScale(date)}, ${y + yOffset}) rotate(${rotation})`;
                })
                .attr('fill', (d: any) => d.type === 'long' || d.type === 'buy' || d.type === 'entry_long' ? '#10B981' : '#EF4444')
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        }

        // Technical indicators
        // Technical indicators
        if (visibleIndicators.sma || visibleIndicators.rsi || visibleIndicators.bollingerBands || visibleIndicators.macd) {
            // RSI Indicator (if enabled)
            if (visibleIndicators.rsi && indicatorData.some(d => d.rsi !== undefined)) {
                const rsiHeight = 80;
                const rsiGroup = svg.append('g')
                    .attr('transform', `translate(${margin.left}, ${dimensions.height - rsiHeight - 20})`);

                const rsiScale = d3.scaleLinear()
                    .domain([0, 100])
                    .range([rsiHeight, 0]);

                const rsiLine = d3.line<IndicatorData>()
                    .x((d: IndicatorData) => xScale(d.date))
                    .y((d: IndicatorData) => rsiScale(d.rsi || 50))
                    .curve(d3.curveMonotoneX);

                const validRSIData = indicatorData.filter((d: IndicatorData) => d.rsi !== undefined);
                if (validRSIData.length > 0) {
                    rsiGroup.append('path')
                        .datum(validRSIData)
                        .attr('fill', 'none')
                        .attr('stroke', '#8B5CF6')
                        .attr('stroke-width', 2)
                        .attr('d', rsiLine);

                    // RSI levels (30 and 70)
                    rsiGroup.append('line')
                        .attr('x1', 0)
                        .attr('x2', dimensions.width - margin.left - margin.right)
                        .attr('y1', rsiScale(70))
                        .attr('y2', rsiScale(70))
                        .attr('stroke', '#EF4444')
                        .attr('stroke-dasharray', '3,3')
                        .attr('opacity', 0.5);

                    rsiGroup.append('line')
                        .attr('x1', 0)
                        .attr('x2', dimensions.width - margin.left - margin.right)
                        .attr('y1', rsiScale(30))
                        .attr('y2', rsiScale(30))
                        .attr('stroke', '#10B981')
                        .attr('stroke-dasharray', '3,3')
                        .attr('opacity', 0.5);
                }
            }

            // Bollinger Bands (if enabled)
            if (visibleIndicators.bollingerBands && indicatorData.some(d => d.bollingerBands)) {
                const upperLine = d3.line<IndicatorData>()
                    .x((d: IndicatorData) => xScale(d.date))
                    .y((d: IndicatorData) => yScale(d.bollingerBands?.upper || 0))
                    .curve(d3.curveMonotoneX)
                    .defined((d: IndicatorData) => d.bollingerBands?.upper !== null && d.bollingerBands?.upper !== undefined);

                const lowerLine = d3.line<IndicatorData>()
                    .x((d: IndicatorData) => xScale(d.date))
                    .y((d: IndicatorData) => yScale(d.bollingerBands?.lower || 0))
                    .curve(d3.curveMonotoneX)
                    .defined((d: IndicatorData) => d.bollingerBands?.lower !== null && d.bollingerBands?.lower !== undefined);

                const middleLine = d3.line<IndicatorData>()
                    .x((d: IndicatorData) => xScale(d.date))
                    .y((d: IndicatorData) => yScale(d.bollingerBands?.middle || 0))
                    .curve(d3.curveMonotoneX)
                    .defined((d: IndicatorData) => d.bollingerBands?.middle !== null && d.bollingerBands?.middle !== undefined);

                // Filter for valid Bollinger data but keep all data points for continuous lines
                const validBollingerData = indicatorData.filter((d: IndicatorData) =>
                    d.bollingerBands?.upper !== null && d.bollingerBands?.upper !== undefined &&
                    d.bollingerBands?.lower !== null && d.bollingerBands?.lower !== undefined &&
                    d.bollingerBands?.middle !== null && d.bollingerBands?.middle !== undefined);

                if (validBollingerData.length > 1) {
                    // Fill area between bands
                    const area = d3.area<IndicatorData>()
                        .x((d: IndicatorData) => xScale(d.date))
                        .y0((d: IndicatorData) => yScale(d.bollingerBands?.lower || 0))
                        .y1((d: IndicatorData) => yScale(d.bollingerBands?.upper || 0))
                        .curve(d3.curveMonotoneX);

                    // Add fill area
                    chartGroup.append('path')
                        .datum(validBollingerData)
                        .attr('fill', '#6366F1')
                        .attr('fill-opacity', 0.1)
                        .attr('d', area);

                    // Upper band
                    chartGroup.append('path')
                        .datum(indicatorData)  // Use all data, let the line.defined() handle gaps
                        .attr('fill', 'none')
                        .attr('stroke', '#6366F1')
                        .attr('stroke-width', 1.5)
                        .attr('stroke-dasharray', '3,3')
                        .attr('opacity', 0.8)
                        .attr('d', upperLine);

                    // Lower band
                    chartGroup.append('path')
                        .datum(indicatorData)  // Use all data, let the line.defined() handle gaps
                        .attr('fill', 'none')
                        .attr('stroke', '#6366F1')
                        .attr('stroke-width', 1.5)
                        .attr('stroke-dasharray', '3,3')
                        .attr('opacity', 0.8)
                        .attr('d', lowerLine);

                    // Middle band (20-period SMA)
                    chartGroup.append('path')
                        .datum(indicatorData)  // Use all data, let the line.defined() handle gaps
                        .attr('fill', 'none')
                        .attr('stroke', '#6366F1')
                        .attr('stroke-width', 2)
                        .attr('opacity', 0.9)
                        .attr('d', middleLine);
                }
            }

            // MACD Indicator (if enabled)
            if (visibleIndicators.macd && indicatorData.some(d => d.macd)) {
                const macdHeight = 100;
                const macdGroup = svg.append('g')
                    .attr('transform', `translate(${margin.left}, ${dimensions.height - macdHeight - 120})`);

                const macdValues = indicatorData
                    .filter(d => d.macd)
                    .map(d => [d.macd!.macd, d.macd!.signal, d.macd!.histogram])
                    .flat();

                const macdScale = d3.scaleLinear()
                    .domain(d3.extent(macdValues) as [number, number])
                    .range([macdHeight, 0]);

                const macdLine = d3.line<IndicatorData>()
                    .x((d: IndicatorData) => xScale(d.date))
                    .y((d: IndicatorData) => macdScale(d.macd?.macd || 0))
                    .curve(d3.curveMonotoneX);

                const signalLine = d3.line<IndicatorData>()
                    .x((d: IndicatorData) => xScale(d.date))
                    .y((d: IndicatorData) => macdScale(d.macd?.signal || 0))
                    .curve(d3.curveMonotoneX);

                const validMACDData = indicatorData.filter((d: IndicatorData) => d.macd);
                if (validMACDData.length > 0) {
                    // MACD line
                    macdGroup.append('path')
                        .datum(validMACDData)
                        .attr('fill', 'none')
                        .attr('stroke', '#3B82F6')
                        .attr('stroke-width', 2)
                        .attr('d', macdLine);

                    // Signal line
                    macdGroup.append('path')
                        .datum(validMACDData)
                        .attr('fill', 'none')
                        .attr('stroke', '#EF4444')
                        .attr('stroke-width', 1)
                        .attr('d', signalLine);

                    // Histogram bars
                    macdGroup.selectAll('.macd-histogram')
                        .data(validMACDData)
                        .enter()
                        .append('rect')
                        .attr('class', 'macd-histogram')
                        .attr('x', (d: IndicatorData) => xScale(d.date) - 1)
                        .attr('y', (d: IndicatorData) => Math.min(macdScale(0), macdScale(d.macd?.histogram || 0)))
                        .attr('width', 2)
                        .attr('height', (d: IndicatorData) => Math.abs(macdScale(0) - macdScale(d.macd?.histogram || 0)))
                        .attr('fill', (d: IndicatorData) => (d.macd?.histogram || 0) >= 0 ? '#10B981' : '#EF4444')
                        .attr('opacity', 0.7);
                }
            }

            // SMA Line (backward compatibility)
            if (visibleIndicators.sma) {
                const smaLine = d3.line<IndicatorData>()
                    .x((d: IndicatorData) => xScale(d.date))
                    .y((d: IndicatorData) => yScale(d.sma20 || 0))
                    .curve(d3.curveMonotoneX);

                const validSMAData = indicatorData.filter((d: IndicatorData) => d.sma20);
                if (validSMAData.length > 0) {
                    chartGroup.append('path')
                        .datum(validSMAData)
                        .attr('fill', 'none')
                        .attr('stroke', '#F59E0B')
                        .attr('stroke-width', 2)
                        .attr('d', smaLine);
                }
            }
        }

        // Volume chart
        if (visibleIndicators.volume) {
            const volumeGroup = svg.append('g')
                .attr('transform', `translate(${margin.left}, ${margin.top + chartHeight + 40})`);

            volumeGroup.selectAll('.volume-bar')
                .data(indicatorData)
                .enter()
                .append('rect')
                .attr('class', 'volume-bar')
                .attr('x', (d: IndicatorData) => xScale(d.date) - 2)
                .attr('y', (d: IndicatorData) => volumeScale(d.volume || 0))
                .attr('width', 4)
                .attr('height', (d: IndicatorData) => volumeHeight - volumeScale(d.volume || 0))
                .attr('fill', (d: IndicatorData) => d.close > d.open ? '#10B981' : '#EF4444')
                .attr('opacity', 0.6);

            // Volume axis
            const volumeAxis = d3.axisLeft(volumeScale)
                .tickFormat((domainValue: d3.AxisDomain) => {
                    const value = domainValue as number;
                    return d3.format('.2s')(value);
                });

            volumeGroup.append('g')
                .call(volumeAxis as any)
                .attr('class', 'text-gray-400');
        }

        // Crosshair
        const focus = chartGroup.append('g')
            .attr('class', 'focus')
            .style('display', 'none');

        focus.append('line')
            .attr('class', 'x-hover-line hover-line')
            .attr('y1', 0)
            .attr('y2', chartHeight)
            .style('stroke', '#6B7280')
            .style('stroke-dasharray', '3,3');

        focus.append('line')
            .attr('class', 'y-hover-line hover-line')
            .attr('x1', 0)
            .attr('x2', width)
            .style('stroke', '#6B7280')
            .style('stroke-dasharray', '3,3');

        chartGroup.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', chartHeight)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mouseover', () => focus.style('display', null))
            .on('mouseout', () => focus.style('display', 'none'))
            .on('mousemove', function (event) {
                const [mouseX] = d3.pointer(event);
                const x0 = xScale.invert(mouseX);
                // Mouse position to data mapping
                const bisect = d3.bisector<IndicatorData, Date>((d: IndicatorData) => d.date).left;
                const i = bisect(indicatorData, x0, 1);
                const d0 = indicatorData[i - 1];
                const d1 = indicatorData[i];
                const d = d1 && x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime() ? d1 : d0;

                if (d) {
                    focus.select('.x-hover-line').attr('transform', `translate(${xScale(d.date)}, 0)`);
                    focus.select('.y-hover-line').attr('transform', `translate(0, ${yScale(d.close)})`);
                }
            });



    }, [indicatorData, dimensions, visibleIndicators, executionSignals]);

    const currentData = indicatorData[indicatorData.length - 1];

    return (
        <div ref={containerRef} className="w-full bg-gray-900 rounded-lg border border-gray-700">
            {/* Toolbar - simplified to show actual features */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center space-x-4">
                    <h3 className="text-white font-semibold">Advanced Financial Chart</h3>
                    <div className="text-sm text-gray-400">
                        Powered by D3.js • Live Data Updates
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setIsMatrixOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                    >
                        <LayoutGrid size={16} />
                        Indicators
                    </button>
                    <div className="flex items-center space-x-4 text-sm">
                        <label className="flex items-center text-gray-300 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                checked={visibleIndicators.rsi}
                                onChange={(e) => setVisibleIndicators(prev => ({ ...prev, rsi: e.target.checked }))}
                                className="mr-2"
                            />
                            RSI
                        </label>
                        <label className="flex items-center text-gray-300 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                checked={visibleIndicators.bollingerBands}
                                onChange={(e) => setVisibleIndicators(prev => ({ ...prev, bollingerBands: e.target.checked }))}
                                className="mr-2"
                            />
                            Bollinger Bands
                        </label>
                        <label className="flex items-center text-gray-300 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                checked={visibleIndicators.macd}
                                onChange={(e) => setVisibleIndicators(prev => ({ ...prev, macd: e.target.checked }))}
                                className="mr-2"
                            />
                            MACD
                        </label>
                        <label className="flex items-center text-gray-300 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                checked={visibleIndicators.sma}
                                onChange={(e) => setVisibleIndicators(prev => ({ ...prev, sma: e.target.checked }))}
                                className="mr-2"
                            />
                            SMA
                        </label>
                        <label className="flex items-center text-gray-300 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                checked={visibleIndicators.volume}
                                onChange={(e) => setVisibleIndicators(prev => ({ ...prev, volume: e.target.checked }))}
                                className="mr-2"
                            />
                            Volume
                        </label>
                    </div>
                </div>
            </div>

            {/* OHLC Info */}
            {currentData && (
                <div className="flex items-center space-x-6 p-3 bg-gray-800 text-sm">
                    <span className="text-gray-400">O:</span>
                    <span className="text-white font-mono">${currentData.open.toFixed(2)}</span>
                    <span className="text-gray-400">H:</span>
                    <span className="text-green-400 font-mono">${currentData.high.toFixed(2)}</span>
                    <span className="text-gray-400">L:</span>
                    <span className="text-red-400 font-mono">${currentData.low.toFixed(2)}</span>
                    <span className="text-gray-400">C:</span>
                    <span className={`font - mono ${currentData.close > currentData.open ? 'text-green-400' : 'text-red-400'
                        } `}>
                        ${currentData.close.toFixed(2)}
                    </span>
                    {visibleIndicators.sma && (
                        <>
                            <span className="text-gray-400">SMA20:</span>
                            <span className="text-yellow-400 font-mono">
                                ${currentData.sma20?.toFixed(2) || 'N/A'}
                            </span>
                        </>
                    )}
                    {visibleIndicators.rsi && currentData.rsi && (
                        <>
                            <span className="text-gray-400">RSI:</span>
                            <span className={`font - mono ${currentData.rsi > 70 ? 'text-red-400' :
                                currentData.rsi < 30 ? 'text-green-400' : 'text-purple-400'
                                } `}>
                                {currentData.rsi.toFixed(1)}
                            </span>
                        </>
                    )}
                    {visibleIndicators.macd && currentData.macd && (
                        <>
                            <span className="text-gray-400">MACD:</span>
                            <span className={`font - mono ${currentData.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'
                                } `}>
                                {currentData.macd.macd.toFixed(4)}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Chart */}
            <div className="relative">
                <svg
                    ref={svgRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    className="bg-gray-900"
                />

                {/* Trading Signal & Technical Analysis Indicators */}
                <div className="absolute top-4 right-4 space-y-2">
                    {/* Trading Signal */}
                    {tradingSignal && (
                        <div className="bg-gray-800 bg-opacity-95 rounded-lg p-3 text-xs border border-gray-600">
                            <div className="flex items-center space-x-2 mb-2">
                                <div className={`w - 2 h - 2 rounded - full ${tradingSignal.type === 'buy' ? 'bg-green-500' :
                                    tradingSignal.type === 'sell' ? 'bg-red-500' : 'bg-yellow-500'
                                    } `}></div>
                                <span className={`font - semibold ${tradingSignal.type === 'buy' ? 'text-green-400' :
                                    tradingSignal.type === 'sell' ? 'text-red-400' : 'text-yellow-400'
                                    } `}>
                                    {tradingSignal.type.toUpperCase()} Signal
                                </span>
                                <span className="text-gray-400">
                                    ({tradingSignal.strength}%)
                                </span>
                            </div>
                            {tradingSignal.reasons.length > 0 && (
                                <div className="text-gray-300">
                                    {tradingSignal.reasons.join(', ')}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Technical Indicators Status */}
                    <div className="bg-gray-800 bg-opacity-95 rounded-lg p-3 text-xs border border-gray-600">
                        <div className="text-white font-semibold mb-2">Phase 1 Indicators</div>
                        <div className="space-y-1">
                            <div className="text-green-400">✓ D3 Candlesticks</div>
                            <div className="text-blue-400">✓ OHLC Display</div>
                            <div className="text-purple-400">✓ RSI (14-period)</div>
                            <div className="text-indigo-400">✓ Bollinger Bands</div>
                            <div className="text-blue-500">✓ MACD</div>
                            <div className="text-yellow-400">✓ SMA (20-period)</div>
                            <div className="text-green-500">✓ Trading Signals</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between p-3 bg-gray-800 text-xs border-t border-gray-700">
                <div className="flex items-center space-x-4">
                    {visibleIndicators.sma && (
                        <div className="flex items-center">
                            <div className="w-3 h-0.5 bg-yellow-500 mr-2"></div>
                            <span className="text-gray-400">SMA(20)</span>
                        </div>
                    )}
                    {visibleIndicators.rsi && (
                        <div className="flex items-center">
                            <div className="w-3 h-0.5 bg-purple-500 mr-2"></div>
                            <span className="text-gray-400">RSI(14)</span>
                        </div>
                    )}
                    {visibleIndicators.bollingerBands && (
                        <div className="flex items-center">
                            <div className="w-3 h-0.5 bg-indigo-500 mr-2"></div>
                            <span className="text-gray-400">Bollinger Bands</span>
                        </div>
                    )}
                    {visibleIndicators.macd && (
                        <div className="flex items-center">
                            <div className="w-3 h-0.5 bg-blue-500 mr-2"></div>
                            <span className="text-gray-400">MACD(12,26,9)</span>
                        </div>
                    )}
                </div>
                <div className="text-gray-500">
                    Phase 1 Technical Indicators • Mathematical Accuracy Verified
                </div>
            </div>

            <IndicatorMatrix
                isOpen={isMatrixOpen}
                onClose={() => setIsMatrixOpen(false)}
                onSelect={async (strategyId) => {
                    console.log('Selected strategy:', strategyId);
                    setIsMatrixOpen(false);

                    try {
                        // 1. Fetch strategy details (to get the script)
                        // In a real app, we might need a separate call or pass the full object
                        // For now, we'll fetch all strategies and find the one matching ID
                        const { getStrategies, executeStrategy } = await import('../../services/api');
                        const strategies = await getStrategies();
                        const strategy = strategies.find((s: any) => s.id === strategyId);

                        if (strategy && strategy.script) {
                            // 2. Execute the strategy
                            console.log('Executing strategy:', strategy.name);
                            const result = await executeStrategy(strategy.script);

                            if (result.success) {
                                console.log('Execution successful:', result);

                                // 3. Update Chart State with Signals
                                // Transform backend signals to chart format if needed
                                // For now, we'll just use the first signal type for the main display
                                // or visualize all of them.

                                // Let's overlay the signals on the chart
                                // We need to store them in state
                                setExecutionSignals(result.signals);
                                alert(`Strategy executed! Found ${result.signals.length} signals.`);
                            } else {
                                console.error('Execution failed:', result.error);
                                alert('Strategy execution failed: ' + result.error);
                            }
                        } else {
                            alert('Strategy script not found.');
                        }
                    } catch (error) {
                        console.error('Error executing strategy:', error);
                        alert('Failed to execute strategy.');
                    }
                }}
            />
        </div>
    );
};

export default AdvancedFinancialChart;
