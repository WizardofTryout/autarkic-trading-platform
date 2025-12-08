/**
 * Deploy Agent Modal - Wizard for deploying a new trading agent
 * 
 * Multi-step form for configuring agent parameters:
 * 1. Name & Symbol
 * 2. Mode (Paper/Live)
 * 3. Strategy Selection
 * 4. Risk Settings
 */

import React, { useState, useEffect } from 'react';
import { useFleetStore } from '../../store/fleetStore';
import type { DeployAgentParams } from '../../store/fleetStore';
import { X, Bot, ChevronRight, ChevronLeft, Check, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import './DeployAgentModal.css';

interface Strategy {
    id: string;
    name: string;
    type: string;
    python_code: string | null;
}

const POPULAR_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

const DeployAgentModal: React.FC = () => {
    const { setShowDeployModal, deployAgent, isLoading } = useFleetStore();

    const [step, setStep] = useState(1);
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState<DeployAgentParams>({
        name: '',
        symbol: 'BTC/USDT',
        mode: 'PAPER',
        budget: 1000,
        max_drawdown_percent: 10,
        risk_per_trade: 0.01,
        min_rr_ratio: 2,
        macro_strategy_id: undefined,
        micro_strategy_id: undefined,
        macro_timeframe: '4h',
        micro_timeframe: '15m',
    });

    // Fetch strategies on mount
    useEffect(() => {
        const fetchStrategies = async () => {
            try {
                const data = await api.get('/strategies');
                // Filter to only show strategies with Python code
                const compiled = data.filter((s: Strategy) => s.python_code);
                setStrategies(compiled);
            } catch (e) {
                console.error('Failed to fetch strategies:', e);
            }
        };
        fetchStrategies();
    }, []);

    const handleChange = (field: keyof DeployAgentParams, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setError(null);
        try {
            await deployAgent(formData);
            setShowDeployModal(false);
        } catch (e: any) {
            setError(e.message || 'Failed to deploy agent');
        }
    };

    const canGoNext = () => {
        switch (step) {
            case 1: return formData.name.length >= 2 && formData.symbol.length > 0;
            case 2: return formData.budget > 0;
            case 3: return true; // Strategies are optional
            case 4: return formData.max_drawdown_percent > 0;
            default: return false;
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="modal-step">
                        <h3>Basic Information</h3>
                        <p className="step-description">Give your agent a name and select a trading pair.</p>

                        <div className="form-group">
                            <label>Agent Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="e.g., BTC Trend Rider"
                                maxLength={50}
                            />
                        </div>

                        <div className="form-group">
                            <label>Trading Symbol</label>
                            <select
                                value={formData.symbol}
                                onChange={(e) => handleChange('symbol', e.target.value)}
                            >
                                {POPULAR_SYMBOLS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="modal-step">
                        <h3>Trading Mode & Budget</h3>
                        <p className="step-description">Choose whether to trade with paper or real funds.</p>

                        <div className="mode-selector">
                            <div
                                className={`mode-card ${formData.mode === 'PAPER' ? 'selected' : ''}`}
                                onClick={() => handleChange('mode', 'PAPER')}
                            >
                                <div className="mode-icon paper">📄</div>
                                <div className="mode-info">
                                    <h4>Paper Trading</h4>
                                    <p>Simulated trades with virtual funds</p>
                                </div>
                            </div>

                            <div
                                className={`mode-card ${formData.mode === 'LIVE' ? 'selected' : ''}`}
                                onClick={() => handleChange('mode', 'LIVE')}
                            >
                                <div className="mode-icon live">💰</div>
                                <div className="mode-info">
                                    <h4>Live Trading</h4>
                                    <p>Real trades on exchange</p>
                                </div>
                                {formData.mode === 'LIVE' && (
                                    <div className="live-warning">
                                        <AlertTriangle size={14} />
                                        Real funds at risk
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Budget (USDT)</label>
                            <input
                                type="number"
                                value={formData.budget}
                                onChange={(e) => handleChange('budget', parseFloat(e.target.value) || 0)}
                                min={10}
                                step={100}
                            />
                            <span className="form-hint">This amount will be locked from your account</span>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="modal-step">
                        <h3>Strategy Selection</h3>
                        <p className="step-description">Select strategies for multi-timeframe analysis.</p>

                        <div className="strategy-grid">
                            <div className="strategy-column">
                                <label>Macro Strategy ({formData.macro_timeframe})</label>
                                <select
                                    value={formData.macro_timeframe}
                                    onChange={(e) => handleChange('macro_timeframe', e.target.value)}
                                    className="timeframe-select"
                                >
                                    {TIMEFRAMES.slice(4).map(tf => (
                                        <option key={tf} value={tf}>{tf}</option>
                                    ))}
                                </select>
                                <select
                                    value={formData.macro_strategy_id || ''}
                                    onChange={(e) => handleChange('macro_strategy_id', e.target.value || undefined)}
                                >
                                    <option value="">None (Manual)</option>
                                    {strategies.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="strategy-column">
                                <label>Micro Strategy ({formData.micro_timeframe})</label>
                                <select
                                    value={formData.micro_timeframe}
                                    onChange={(e) => handleChange('micro_timeframe', e.target.value)}
                                    className="timeframe-select"
                                >
                                    {TIMEFRAMES.slice(0, 4).map(tf => (
                                        <option key={tf} value={tf}>{tf}</option>
                                    ))}
                                </select>
                                <select
                                    value={formData.micro_strategy_id || ''}
                                    onChange={(e) => handleChange('micro_strategy_id', e.target.value || undefined)}
                                >
                                    <option value="">None (Manual)</option>
                                    {strategies.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {strategies.length === 0 && (
                            <div className="no-strategies-hint">
                                No compiled strategies found. Create and compile a strategy first.
                            </div>
                        )}
                    </div>
                );

            case 4:
                return (
                    <div className="modal-step">
                        <h3>Risk Management</h3>
                        <p className="step-description">Configure risk parameters and kill switch.</p>

                        <div className="risk-grid">
                            <div className="form-group">
                                <label>Max Drawdown (Kill Switch) %</label>
                                <input
                                    type="number"
                                    value={formData.max_drawdown_percent}
                                    onChange={(e) => handleChange('max_drawdown_percent', parseFloat(e.target.value) || 10)}
                                    min={1}
                                    max={50}
                                    step={1}
                                />
                                <span className="form-hint">Agent stops if loss exceeds this %</span>
                            </div>

                            <div className="form-group">
                                <label>Risk Per Trade %</label>
                                <input
                                    type="number"
                                    value={formData.risk_per_trade * 100}
                                    onChange={(e) => handleChange('risk_per_trade', (parseFloat(e.target.value) || 1) / 100)}
                                    min={0.1}
                                    max={10}
                                    step={0.1}
                                />
                                <span className="form-hint">% of budget risked per trade</span>
                            </div>

                            <div className="form-group">
                                <label>Minimum Risk/Reward Ratio</label>
                                <input
                                    type="number"
                                    value={formData.min_rr_ratio}
                                    onChange={(e) => handleChange('min_rr_ratio', parseFloat(e.target.value) || 2)}
                                    min={1}
                                    max={10}
                                    step={0.5}
                                />
                                <span className="form-hint">Only take trades with R:R ≥ this</span>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="deploy-summary">
                            <h4>Summary</h4>
                            <ul>
                                <li><strong>Name:</strong> {formData.name}</li>
                                <li><strong>Symbol:</strong> {formData.symbol}</li>
                                <li><strong>Mode:</strong> {formData.mode}</li>
                                <li><strong>Budget:</strong> ${formData.budget}</li>
                                <li><strong>Kill Switch:</strong> {formData.max_drawdown_percent}%</li>
                            </ul>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="modal-overlay" onClick={() => setShowDeployModal(false)}>
            <div className="deploy-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-title">
                        <Bot size={20} />
                        <h2>Deploy New Agent</h2>
                    </div>
                    <button className="modal-close" onClick={() => setShowDeployModal(false)}>
                        <X size={20} />
                    </button>
                </div>

                {/* Step Indicator */}
                <div className="step-indicator">
                    {[1, 2, 3, 4].map(s => (
                        <div
                            key={s}
                            className={`step-dot ${s === step ? 'active' : ''} ${s < step ? 'completed' : ''}`}
                        >
                            {s < step ? <Check size={12} /> : s}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="modal-content">
                    {renderStep()}

                    {error && <div className="modal-error">{error}</div>}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    {step > 1 && (
                        <button className="btn-secondary" onClick={() => setStep(step - 1)}>
                            <ChevronLeft size={16} />
                            Back
                        </button>
                    )}

                    <div className="footer-spacer" />

                    {step < 4 ? (
                        <button
                            className="btn-primary"
                            onClick={() => setStep(step + 1)}
                            disabled={!canGoNext()}
                        >
                            Next
                            <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            className="btn-deploy"
                            onClick={handleSubmit}
                            disabled={isLoading || !canGoNext()}
                        >
                            {isLoading ? 'Deploying...' : 'Deploy Agent'}
                            <Bot size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeployAgentModal;
