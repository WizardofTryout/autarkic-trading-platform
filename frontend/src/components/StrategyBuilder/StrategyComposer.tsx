import React, { useState, useEffect } from 'react';
import { Wand2, Plus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { getStrategies, type Strategy } from '../../services/api';
import { NotificationModal } from '../Common/NotificationModal';
import TranspilationProgress from '../Common/TranspilationProgress';

interface StrategyComposerProps {
    onStrategyComposed?: (pythonCode: string, indicatorNames: string[]) => void;
}

const StrategyComposer: React.FC<StrategyComposerProps> = ({ onStrategyComposed }) => {
    const [indicators, setIndicators] = useState<Strategy[]>([]);
    const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
    const [compositionPrompt, setCompositionPrompt] = useState('');
    const [isComposing, setIsComposing] = useState(false);
    const [composedCode, setComposedCode] = useState<string | null>(null);
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        type: 'success' | 'error' | 'info';
        title: string;
        message: string;
    }>({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    });

    useEffect(() => {
        loadIndicators();
    }, []);

    const loadIndicators = async () => {
        try {
            const allStrategies = await getStrategies();
            // Filter only indicators that have Python code
            const indicatorsWithCode = allStrategies.filter(
                s => s.type === 'indicator' && s.python_code
            );
            setIndicators(indicatorsWithCode);
        } catch (error) {
            console.error('Failed to load indicators:', error);
        }
    };

    const toggleIndicator = (id: string) => {
        setSelectedIndicators(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleCompose = async () => {
        if (selectedIndicators.length < 2) {
            setNotification({
                isOpen: true,
                type: 'error',
                title: 'Insufficient Indicators',
                message: 'Please select at least 2 indicators to compose a strategy.'
            });
            return;
        }

        if (!compositionPrompt.trim()) {
            setNotification({
                isOpen: true,
                type: 'error',
                title: 'Missing Instructions',
                message: 'Please provide instructions on how to combine the indicators.'
            });
            return;
        }

        setIsComposing(true);
        setComposedCode(null);

        try {
            const response = await fetch('/api/v1/strategies/compose', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    indicator_ids: selectedIndicators,
                    composition_prompt: compositionPrompt
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Composition failed');
            }

            const data = await response.json();

            setComposedCode(data.python_code);
            setNotification({
                isOpen: true,
                type: 'success',
                title: 'Strategy Composed Successfully',
                message: `Combined ${data.indicators_used.length} indicators into a trading strategy!`
            });

            if (onStrategyComposed) {
                onStrategyComposed(data.python_code, data.indicators_used);
            }

        } catch (error: any) {
            console.error('Composition error:', error);
            setNotification({
                isOpen: true,
                type: 'error',
                title: 'Composition Failed',
                message: error.message || 'Failed to compose strategy'
            });
        } finally {
            setIsComposing(false);
        }
    };

    const selectedIndicatorNames = indicators
        .filter(i => selectedIndicators.includes(i.id))
        .map(i => i.name);

    return (
        <div className="h-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-y-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Wand2 className="w-6 h-6 text-purple-500" />
                    <h2 className="text-2xl font-bold">Strategy Composer</h2>
                </div>
                <p className="text-gray-400 text-sm">
                    Combine multiple indicators into a complete trading strategy using AI
                </p>
            </div>

            {/* Indicator Selection */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="text-blue-400">1.</span>
                    Select Indicators
                    <span className="text-xs text-gray-500">({selectedIndicators.length} selected)</span>
                </h3>

                {indicators.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-6 text-center">
                        <p className="text-gray-400 mb-2">No indicators with Python code found</p>
                        <p className="text-sm text-gray-500">
                            Create indicators and generate Python code first
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {indicators.map(indicator => (
                            <button
                                key={indicator.id}
                                onClick={() => toggleIndicator(indicator.id)}
                                className={`p-4 rounded-lg border-2 transition-all text-left ${selectedIndicators.includes(indicator.id)
                                        ? 'border-purple-500 bg-purple-500/10'
                                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium text-white mb-1">{indicator.name}</div>
                                        <div className="text-xs text-gray-400 line-clamp-2">
                                            {indicator.description || 'No description'}
                                        </div>
                                    </div>
                                    {selectedIndicators.includes(indicator.id) && (
                                        <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0 ml-2" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Selected Indicators Summary */}
            {selectedIndicators.length > 0 && (
                <div className="mb-6">
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-2">Selected Indicators:</div>
                        <div className="flex flex-wrap gap-2">
                            {selectedIndicatorNames.map((name, idx) => (
                                <span
                                    key={idx}
                                    className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2"
                                >
                                    {name}
                                    <button
                                        onClick={() => {
                                            const indicator = indicators.find(i => i.name === name);
                                            if (indicator) toggleIndicator(indicator.id);
                                        }}
                                        className="hover:text-purple-100"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Composition Instructions */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="text-blue-400">2.</span>
                    Composition Instructions
                </h3>
                <textarea
                    value={compositionPrompt}
                    onChange={(e) => setCompositionPrompt(e.target.value)}
                    placeholder="Example: Buy when RSI is below 30 AND MACD crosses above signal line. Sell when RSI is above 70 OR MACD crosses below signal line."
                    className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                    Describe how the indicators should be combined to generate buy/sell signals
                </p>
            </div>

            {/* Compose Button */}
            <div className="mb-6">
                <button
                    onClick={handleCompose}
                    disabled={isComposing || selectedIndicators.length < 2}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                    {isComposing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Composing Strategy...
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-5 h-5" />
                            Compose Strategy
                        </>
                    )}
                </button>
            </div>

            {/* Composed Code Preview */}
            {composedCode && (
                <div className="flex-1 min-h-0">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        Composed Strategy Code
                    </h3>
                    <div className="bg-gray-800 rounded-lg p-4 overflow-auto h-full">
                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                            {composedCode}
                        </pre>
                    </div>
                </div>
            )}

            {/* Modals */}
            <NotificationModal
                isOpen={notification.isOpen}
                type={notification.type}
                title={notification.title}
                message={notification.message}
                onClose={() => setNotification({ ...notification, isOpen: false })}
            />

            <TranspilationProgress isOpen={isComposing} />
        </div>
    );
};

export default StrategyComposer;
