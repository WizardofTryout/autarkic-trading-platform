import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI, generateStrategy } from '../../services/api';
import { useTradingStore } from '../../store/tradingStore';
import { Send, Bot, User, Code, Loader2, X, Sparkles, Copy, ArrowDownToLine, Square, FileCode2, Wand2, Bug, Zap, HelpCircle, Plus } from 'lucide-react';

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
    code?: string; // Optional code block for strategy generation
    codeLanguage?: 'pinescript' | 'python'; // Language of the code block
}

// Quick action button type for Strategy Builder
interface QuickAction {
    id: string;
    icon: React.ReactNode;
    label: string;
    description: string;
    promptPrefix: string;
    color: string;
    requiresInput: boolean; // Whether to show input modal
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentScript?: string;
    currentPythonCode?: string;  // New: Python code from editor
    initialMessage?: string;
    analysisContext?: string;
    onLoadCode?: (code: string) => void; // Callback to load Pine Script code into editor
    onLoadPythonCode?: (code: string) => void; // New: Callback to load Python code
    defaultMode?: 'chat' | 'strategy';
    defaultLanguage?: 'pinescript' | 'python'; // New: Default language mode
    layoutMode?: 'overlay' | 'embedded';
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
    isOpen, 
    onClose, 
    currentScript, 
    currentPythonCode,
    initialMessage, 
    analysisContext, 
    onLoadCode, 
    onLoadPythonCode,
    defaultMode = 'chat', 
    defaultLanguage = 'pinescript',
    layoutMode = 'overlay' 
}) => {
    const { symbol, timeframe, portfolio, currentPrice } = useTradingStore();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hello! I am your Strategy Builder Assistant. Use the quick actions below or ask me anything!', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [includeContext, setIncludeContext] = useState(true);
    const [isStrategyMode, setIsStrategyMode] = useState(defaultMode === 'strategy'); // Toggle for Strategy Builder
    const [codeLanguage, setCodeLanguage] = useState<'pinescript' | 'python'>(defaultLanguage); // New: Language toggle
    const [activeQuickAction, setActiveQuickAction] = useState<QuickAction | null>(null); // For modal input
    const [quickActionInput, setQuickActionInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Define Quick Actions for Strategy Builder
    const quickActions: QuickAction[] = [
        {
            id: 'new',
            icon: <Plus className="w-5 h-5" />,
            label: 'New Strategy',
            description: 'Create from scratch',
            promptPrefix: 'Create a new trading strategy: ',
            color: 'green',
            requiresInput: true
        },
        {
            id: 'improve',
            icon: <Zap className="w-5 h-5" />,
            label: 'Improve Code',
            description: 'Optimize & enhance',
            promptPrefix: 'Analyze and improve this code. Make it more efficient, add better error handling, and optimize the logic: ',
            color: 'blue',
            requiresInput: false
        },
        {
            id: 'fix',
            icon: <Bug className="w-5 h-5" />,
            label: 'Fix Bugs',
            description: 'Debug & repair',
            promptPrefix: 'Find and fix any bugs, errors, or issues in this code. Explain what was wrong and how you fixed it: ',
            color: 'red',
            requiresInput: false
        },
        {
            id: 'explain',
            icon: <HelpCircle className="w-5 h-5" />,
            label: 'Explain Code',
            description: 'Understand logic',
            promptPrefix: 'Explain this code in detail. Break down the strategy logic, entry/exit conditions, and how each part works: ',
            color: 'purple',
            requiresInput: false
        }
    ];

    // Handle Quick Action click
    const handleQuickAction = (action: QuickAction) => {
        if (action.requiresInput) {
            // Show input modal for actions that need user input
            setActiveQuickAction(action);
            setQuickActionInput('');
        } else {
            // Execute immediately with current code as context
            executeQuickAction(action, '');
        }
    };

    // Execute the quick action with optional user input
    const executeQuickAction = async (action: QuickAction, userInput: string) => {
        const currentCode = codeLanguage === 'python' ? currentPythonCode : currentScript;
        
        // Build the full prompt
        let fullPrompt = action.promptPrefix;
        if (userInput) {
            fullPrompt += userInput;
        }
        if (currentCode && action.id !== 'new') {
            fullPrompt += `\n\nCurrent Code:\n${currentCode}`;
        }

        // Close modal if open
        setActiveQuickAction(null);
        setQuickActionInput('');

        // Add user message
        const userMsg: Message = { 
            role: 'user', 
            content: action.id === 'new' ? `🆕 New Strategy: ${userInput}` : `🔧 ${action.label}`, 
            timestamp: new Date() 
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const response = await generateStrategy(
                fullPrompt,
                action.id === 'new' ? undefined : currentCode,
                controller.signal,
                codeLanguage
            );

            const aiMsg: Message = {
                role: 'ai',
                content: response.explanation || `Here is your ${action.label.toLowerCase()} result:`,
                timestamp: new Date(),
                code: response.code,
                codeLanguage: codeLanguage
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                setMessages(prev => [...prev, {
                    role: 'ai',
                    content: `Error: ${error.message || 'Something went wrong.'}`,
                    timestamp: new Date()
                }]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

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
                // Strategy Generation Mode - use selected language
                const currentCode = codeLanguage === 'python' ? currentPythonCode : currentScript;
                const response = await generateStrategy(
                    userMsg.content, 
                    includeContext ? currentCode : undefined, 
                    controller.signal,
                    codeLanguage
                );

                const aiMsg: Message = {
                    role: 'ai',
                    content: response.explanation || `Here is your generated ${codeLanguage === 'python' ? 'Python' : 'Pine Script'} strategy:`,
                    timestamp: new Date(),
                    code: response.code,
                    codeLanguage: codeLanguage
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

    // Helper to get color classes for quick action buttons
    const getColorClasses = (color: string, isHover = false) => {
        const colors: Record<string, { bg: string; hover: string; text: string }> = {
            green: { bg: 'bg-green-500/20', hover: 'group-hover:bg-green-500/30', text: 'text-green-400' },
            blue: { bg: 'bg-blue-500/20', hover: 'group-hover:bg-blue-500/30', text: 'text-blue-400' },
            red: { bg: 'bg-red-500/20', hover: 'group-hover:bg-red-500/30', text: 'text-red-400' },
            purple: { bg: 'bg-purple-500/20', hover: 'group-hover:bg-purple-500/30', text: 'text-purple-400' },
            yellow: { bg: 'bg-yellow-500/20', hover: 'group-hover:bg-yellow-500/30', text: 'text-yellow-400' },
        };
        return colors[color] || colors.blue;
    };

    return (
        <div className={`flex flex-col ${layoutMode === 'overlay' ? overlayClasses : embeddedClasses}`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                <div className="flex items-center gap-2">
                    <Sparkles className={`w-5 h-5 ${isStrategyMode ? 'text-purple-400' : 'text-blue-400'}`} />
                    <h2 className="font-bold text-white">{isStrategyMode ? 'Strategy Builder' : 'AI Assistant'}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsStrategyMode(!isStrategyMode)}
                        className={`p-1.5 rounded-md transition-colors ${isStrategyMode ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                        title={isStrategyMode ? "Switch to Chat" : "Switch to Strategy Builder"}
                    >
                        <Bot className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Strategy Mode: Quick Actions + Custom Inquiry Layout */}
            {isStrategyMode ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Language Toggle */}
                    <div className="px-4 pt-4 pb-2">
                        <div className="flex rounded-lg overflow-hidden border border-gray-700 w-full">
                            <button
                                onClick={() => setCodeLanguage('pinescript')}
                                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                    codeLanguage === 'pinescript' 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            >
                                🌲 Pine Script
                            </button>
                            <button
                                onClick={() => setCodeLanguage('python')}
                                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                    codeLanguage === 'python' 
                                        ? 'bg-yellow-600 text-white' 
                                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            >
                                🐍 Python
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="px-4 py-3">
                        <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Quick Actions</label>
                        <div className="grid grid-cols-2 gap-2">
                            {quickActions.map((action) => {
                                const colors = getColorClasses(action.color);
                                return (
                                    <button
                                        key={action.id}
                                        onClick={() => handleQuickAction(action)}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group text-left"
                                    >
                                        <div className={`p-1.5 ${colors.bg} ${colors.hover} rounded-lg transition-colors`}>
                                            <span className={colors.text}>{action.icon}</span>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-xs text-white truncate">{action.label}</span>
                                            <span className="text-[10px] text-gray-500 truncate">{action.description}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Messages/Response Area */}
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 border-t border-gray-800">
                        {messages.slice(1).map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[95%] rounded-lg p-3 ${msg.role === 'user'
                                    ? 'bg-purple-600/30 text-white border border-purple-600/50'
                                    : 'bg-gray-800 text-gray-200 border border-gray-700'
                                    }`}>
                                    <div className="text-xs opacity-50 mb-1 flex items-center gap-1">
                                        {msg.role === 'ai' ? <Bot size={12} /> : <User size={12} />}
                                        {msg.role === 'ai' ? 'Builder' : 'You'}
                                    </div>
                                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>

                                    {/* Code Block Display */}
                                    {msg.code && (
                                        <div className="mt-3 bg-gray-950 rounded border border-gray-700 overflow-hidden">
                                            <div className="flex justify-between items-center px-2 py-1 bg-gray-900 border-b border-gray-700">
                                                <span className={`text-xs ${msg.codeLanguage === 'python' ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {msg.codeLanguage === 'python' ? '🐍 Python' : '🌲 Pine Script'}
                                                </span>
                                                <div className="flex gap-1">
                                                    {msg.codeLanguage === 'python' && onLoadPythonCode && (
                                                        <button
                                                            onClick={() => onLoadPythonCode(msg.code!)}
                                                            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
                                                        >
                                                            <ArrowDownToLine size={12} /> Load
                                                        </button>
                                                    )}
                                                    {msg.codeLanguage !== 'python' && onLoadCode && (
                                                        <button
                                                            onClick={() => onLoadCode(msg.code!)}
                                                            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                                                        >
                                                            <ArrowDownToLine size={12} /> Load
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <pre className={`p-2 text-xs overflow-x-auto max-h-32 ${msg.codeLanguage === 'python' ? 'text-yellow-400' : 'text-green-400'}`}>
                                                <code>{msg.code.substring(0, 300)}{msg.code.length > 300 ? '...' : ''}</code>
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                    <span className="text-sm text-gray-400">
                                        Generating {codeLanguage === 'python' ? 'Python' : 'Pine Script'}...
                                    </span>
                                    <button
                                        onClick={handleStop}
                                        className="ml-2 text-xs text-red-400 hover:text-red-300"
                                    >
                                        Stop
                                    </button>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Custom Inquiry Input */}
                    <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                        <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Custom Inquiry</label>
                        <div className="flex flex-col gap-2">
                            <textarea
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500 resize-none transition-colors"
                                rows={3}
                                placeholder="Ask anything about your strategy..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                disabled={isLoading}
                            />
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white">
                                    <input
                                        type="checkbox"
                                        checked={includeContext}
                                        onChange={e => setIncludeContext(e.target.checked)}
                                        className="rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                                    />
                                    <Code className="w-3 h-3" />
                                    Include Code
                                </label>
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                    Ask Builder
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Chat Mode: Original Layout */
                <>
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
                                        {msg.role === 'ai' ? 'Assistant' : 'You'}
                                    </div>
                                    <div className="whitespace-pre-wrap text-sm font-mono">{msg.content}</div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                    <span className="text-sm text-gray-400">Thinking...</span>
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
                                placeholder="Ask me anything..."
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
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-md transition-colors flex items-center justify-center w-10 h-10"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Quick Action Input Modal */}
            {activeQuickAction && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
                        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${getColorClasses(activeQuickAction.color).bg}`}>
                                <span className={getColorClasses(activeQuickAction.color).text}>
                                    {activeQuickAction.icon}
                                </span>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">{activeQuickAction.label}</h3>
                                <p className="text-xs text-gray-400">{activeQuickAction.description}</p>
                            </div>
                            <button
                                onClick={() => setActiveQuickAction(null)}
                                className="ml-auto text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <label className="text-sm text-gray-300 mb-2 block">
                                Describe your {codeLanguage === 'python' ? 'Python' : 'Pine Script'} strategy:
                            </label>
                            <textarea
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                                rows={4}
                                placeholder="e.g., RSI divergence strategy that buys when RSI < 30 and price makes higher lows..."
                                value={quickActionInput}
                                onChange={e => setQuickActionInput(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="p-4 border-t border-gray-700 flex gap-2 justify-end">
                            <button
                                onClick={() => setActiveQuickAction(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => executeQuickAction(activeQuickAction, quickActionInput)}
                                disabled={!quickActionInput.trim()}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <Wand2 className="w-4 h-4" />
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;
