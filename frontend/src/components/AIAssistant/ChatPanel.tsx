import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI, generateStrategy } from '../../services/api';
import { useTradingStore } from '../../store/tradingStore';
import { Send, Bot, User, Code, Loader2, X, Sparkles, Copy, ArrowDownToLine } from 'lucide-react';

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
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, currentScript, initialMessage, analysisContext, onLoadCode, defaultMode = 'chat' }) => {
    const { symbol, timeframe } = useTradingStore();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hello! I am your Trading Assistant. How can I help you today?', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [includeContext, setIncludeContext] = useState(true);
    const [isStrategyMode, setIsStrategyMode] = useState(defaultMode === 'strategy'); // Toggle for Strategy Builder
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            if (isStrategyMode) {
                // Strategy Generation Mode
                const response = await generateStrategy(userMsg.content, includeContext ? currentScript : undefined);

                const aiMsg: Message = {
                    role: 'ai',
                    content: response.explanation || "Here is your generated strategy:",
                    timestamp: new Date(),
                    code: response.code
                };
                setMessages(prev => [...prev, aiMsg]);

            } else {
                // Normal Chat Mode
                const context = includeContext ? {
                    symbol,
                    timeframe,
                    script: currentScript,
                    analysis_content: analysisContext
                } : undefined;

                const response = await chatWithAI(userMsg.content, context);

                const aiMsg: Message = {
                    role: 'ai',
                    content: response.response,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, aiMsg]);
            }
        } catch (error: any) {
            const errorMsg: Message = {
                role: 'ai',
                content: `Error: ${error.message || 'Something went wrong.'}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-16 bottom-0 w-96 bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col z-30 transition-transform transform translate-x-0">
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
                <div className="flex gap-2">
                    <textarea
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-md p-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
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
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className={`${isStrategyMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-md transition-colors flex items-center justify-center w-10`}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
