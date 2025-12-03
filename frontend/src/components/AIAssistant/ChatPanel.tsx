import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI, generateStrategy } from '../../services/api';
import { useTradingStore } from '../../store/tradingStore';
import { Send, Bot, User, Code, Loader2, X, Sparkles, Copy, ArrowDownToLine, Square } from 'lucide-react';

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
    code?: string; // Optional code block for strategy generation
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentScript?: string;
    initialMessage?: string;
    analysisContext?: string;
    onLoadCode?: (code: string) => void; // Callback to load code into editor
    defaultMode?: 'chat' | 'strategy';
    layoutMode?: 'overlay' | 'embedded';
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, currentScript, initialMessage, analysisContext, onLoadCode, defaultMode = 'chat', layoutMode = 'overlay' }) => {
    const { symbol, timeframe, portfolio, currentPrice } = useTradingStore();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hello! I am your Trading Assistant. How can I help you today?', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [includeContext, setIncludeContext] = useState(true);
    const [isStrategyMode, setIsStrategyMode] = useState(defaultMode === 'strategy'); // Toggle for Strategy Builder
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && initialMessage) {
            setInput(initialMessage);
        }
    }, [isOpen, initialMessage]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            setMessages(prev => [...prev, { role: 'ai', content: '[Request cancelled by user]', timestamp: new Date() }]);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        // Create new AbortController
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            if (isStrategyMode) {
                // Strategy Generation Mode
                const response = await generateStrategy(userMsg.content, includeContext ? currentScript : undefined, controller.signal);

                const aiMsg: Message = {
                    role: 'ai',
                    content: response.explanation || "Here is your generated strategy:",
                    timestamp: new Date(),
                    code: response.code
                };
                setMessages(prev => [...prev, aiMsg]);

            } else {
                // Normal Chat Mode
                let context: any = undefined;

                if (includeContext) {
                    // Fetch recent market data for context
                    let recentCandles: any[] = [];
                    let technicalAnalysis: any = null;

                    try {
                        // Dynamically import getMarketData to avoid circular dependencies if any, 
                        // or just use the imported one. 
                        // We need to import getMarketData at the top.
                        const { getMarketData } = await import('../../services/api');
                        const { addTechnicalIndicators } = await import('../../utils/technicalIndicators');

                        // Fetch 200 candles to ensure valid indicator calculations (EMA/MACD need history)
                        const data = await getMarketData(symbol, timeframe, 200);

                        if (Array.isArray(data)) {
                            // 1. Calculate Indicators
                            const dataWithIndicators = addTechnicalIndicators(data.map((d: any) => ({
                                ...d,
                                time: d.timestamp || d.time // Ensure time format
                            })));

                            const latest = dataWithIndicators[dataWithIndicators.length - 1];

                            if (latest) {
                                technicalAnalysis = {
                                    rsi: latest.rsi,
                                    macd: latest.macd,
                                    bollinger_bands: latest.bollingerBands,
                                    sma20: latest.sma20,
                                    volume: latest.volume,
                                    close: latest.close
                                };
                            }

                            // 2. Prepare Recent History (Last 100 candles for AI analysis)
                            recentCandles = dataWithIndicators.slice(-100).map((c: any) => ({
                                time: new Date(c.time).toISOString(),
                                open: c.open,
                                high: c.high,
                                low: c.low,
                                close: c.close,
                                volume: c.volume,
                                // Include key indicators in history too if needed, but raw price is usually enough for AI to see patterns
                                rsi: c.rsi,
                                sma20: c.sma20
                            }));
                        }
                    } catch (err) {
                        console.error("Failed to fetch context data", err);
                    }

                    // Calculate PnL for positions manually to ensure accuracy
                    const positionsWithPnL = portfolio?.positions?.filter(p => p.symbol === symbol).map(p => {
                        let pnl = 0;
                        let pnlPercent = 0;
                        if (currentPrice && p.entry_price) {
                            if (p.side.toUpperCase() === 'LONG' || p.side.toUpperCase() === 'BUY') {
                                pnl = (currentPrice - p.entry_price) * p.size;
                                pnlPercent = ((currentPrice - p.entry_price) / p.entry_price) * 100;
                            } else {
                                pnl = (p.entry_price - currentPrice) * p.size;
                                pnlPercent = ((p.entry_price - currentPrice) / p.entry_price) * 100;
                            }
                        }
                        return {
                            ...p,
                            unrealized_pnl: pnl,
                            unrealized_pnl_percent: pnlPercent,
                            current_price: currentPrice
                        };
                    }) || [];

                    context = {
                        symbol,
                        timeframe,
                        current_price: currentPrice,
                        portfolio: portfolio ? {
                            balance: portfolio.balance,
                            positions: positionsWithPnL,
                            open_orders: portfolio.orders?.filter(o => o.symbol === symbol) || []
                        } : null,
                        recent_candles: recentCandles,
                        technical_analysis: technicalAnalysis,
                        script: currentScript,
                        analysis_content: analysisContext
                    };
                }

                const response = await chatWithAI(userMsg.content, context, controller.signal);

                const aiMsg: Message = {
                    role: 'ai',
                    content: response.response,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, aiMsg]);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Request aborted');
                return; // Already handled in handleStop
            }
            const errorMsg: Message = {
                role: 'ai',
                content: `Error: ${error.message || 'Something went wrong.'}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
                abortControllerRef.current = null;
            }
        }
    };

    if (!isOpen && layoutMode === 'overlay') return null;
    if (!isOpen && layoutMode === 'embedded') return null; // Or handle visibility differently for embedded

    const overlayClasses = "fixed right-0 top-16 bottom-0 w-96 bg-gray-900 border-l border-gray-700 shadow-2xl z-30 transition-transform transform translate-x-0";
    const embeddedClasses = "w-full h-full bg-gray-900 border-t border-b border-gray-800 flex flex-col";

    return (
        <div className={`flex flex-col ${layoutMode === 'overlay' ? overlayClasses : embeddedClasses}`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                <div className="flex items-center gap-2">
                    <Bot className={`w-5 h-5 ${isStrategyMode ? 'text-purple-400' : 'text-blue-400'}`} />
                    <h2 className="font-bold text-white">{isStrategyMode ? 'Strategy Builder' : 'AI Assistant'}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsStrategyMode(!isStrategyMode)}
                        className={`p-1.5 rounded-md transition-colors ${isStrategyMode ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                        title={isStrategyMode ? "Switch to Chat" : "Switch to Strategy Builder"}
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[90%] rounded-lg p-3 ${msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-200 border border-gray-700'
                            }`}>
                            <div className="text-xs opacity-50 mb-1 flex items-center gap-1">
                                {msg.role === 'ai' ? <Bot size={12} /> : <User size={12} />}
                                {msg.role === 'ai' ? (isStrategyMode && msg.code ? 'Builder' : 'Assistant') : 'You'}
                            </div>
                            <div className="whitespace-pre-wrap text-sm font-mono">{msg.content}</div>

                            {/* Code Block Display */}
                            {msg.code && (
                                <div className="mt-3 bg-gray-950 rounded border border-gray-700 overflow-hidden">
                                    <div className="flex justify-between items-center px-2 py-1 bg-gray-900 border-b border-gray-700">
                                        <span className="text-xs text-gray-400">Pine Script</span>
                                        <div className="flex gap-1">
                                            {onLoadCode && (
                                                <button
                                                    onClick={() => onLoadCode(msg.code!)}
                                                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                                                >
                                                    <ArrowDownToLine size={12} /> Load
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <pre className="p-2 text-xs text-green-400 overflow-x-auto">
                                        <code>{msg.code.substring(0, 150)}...</code>
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center gap-2">
                            <Loader2 className={`w-4 h-4 animate-spin ${isStrategyMode ? 'text-purple-400' : 'text-blue-400'}`} />
                            <span className="text-sm text-gray-400">{isStrategyMode ? 'Generating Strategy...' : 'Thinking...'}</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700 bg-gray-800">
                <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white">
                        <input
                            type="checkbox"
                            checked={includeContext}
                            onChange={e => setIncludeContext(e.target.checked)}
                            className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                        />
                        <Code className="w-3 h-3" />
                        Include Context
                    </label>
                </div>
                <div className="flex gap-2 items-end">
                    <textarea
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-md p-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[40px] max-h-[200px]"
                        rows={2}
                        placeholder={isStrategyMode ? "Describe your strategy (e.g. Buy when RSI < 30)..." : "Ask me anything..."}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    {isLoading ? (
                        <button
                            onClick={handleStop}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-md transition-colors flex items-center justify-center w-10 h-10"
                            title="Stop Generation"
                        >
                            <Square className="w-4 h-4 fill-current" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className={`${isStrategyMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-md transition-colors flex items-center justify-center w-10 h-10`}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
