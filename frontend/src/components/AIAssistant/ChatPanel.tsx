import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI } from '../../services/api';
import { useTradingStore } from '../../store/tradingStore';
import { Send, Bot, User, Code, Loader2, X } from 'lucide-react';

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentScript?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, currentScript }) => {
    const { symbol, timeframe } = useTradingStore();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hello! I am your Trading Assistant. How can I help you today?', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [includeContext, setIncludeContext] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const context = includeContext ? {
                symbol,
                timeframe,
                script: currentScript
            } : undefined;

            const response = await chatWithAI(userMsg.content, context);

            const aiMsg: Message = {
                role: 'ai',
                content: response.response,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
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
                    <Bot className="w-5 h-5 text-blue-400" />
                    <h2 className="font-bold text-white">AI Assistant</h2>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'user'
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
                        Include Context (Symbol, Script)
                    </label>
                </div>
                <div className="flex gap-2">
                    <textarea
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-md p-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
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
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-md transition-colors flex items-center justify-center w-10"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
