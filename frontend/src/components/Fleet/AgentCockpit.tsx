/**
 * Agent Cockpit - Detailed view for a single trading agent
 * 
 * Shows:
 * - Live chart with Ghost Lines (agent overlays)
 * - Scrolling log terminal
 * - Agent controls (START/PAUSE/STOP, Approve proposal)
 * - Agent configuration summary
 */

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useFleetStore } from '../../store/fleetStore';
import type { TradingAgent, AgentLog, VisualOverlay } from '../../store/fleetStore';
import {
    ArrowLeft, Play, Pause, StopCircle, Check, X,
    RefreshCw, Terminal
} from 'lucide-react';
import KlineChartCore from '../Chart/KlineChartCore';
import LivePriceTicker from './LivePriceTicker';
import StrategySelector from './StrategySelector';
import { ConfirmationModal } from '../Common/ConfirmationModal';
import { ActivePositionCard } from './ActivePositionCard';
import { useTimezone } from '../../utils/timezone';
import './AgentCockpit.css';

interface AgentCockpitProps {
    agent: TradingAgent;
}

const AgentCockpit: React.FC<AgentCockpitProps> = ({ agent }) => {
    const { formatLogTimestamp } = useTimezone();
    const {
        agentLogs,
        selectAgent,
        setShowAgentCockpit,
        startAgent,
        pauseAgent,
        stopAgent,
        approveProposal,
        fetchAgentLogs,
        updateAgent,
        fetchBacktestSnapshot,
        backtestVisuals,
    } = useFleetStore();

    const logContainerRef = useRef<HTMLDivElement>(null);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

    // Strategy Confirmation State
    const [pendingStrategy, setPendingStrategy] = useState<{
        type: 'MACRO' | 'MICRO';
        strategyId: string | null;
    } | null>(null);

    const logs: AgentLog[] = agentLogs[agent.id] || [];

    // Check if agent is paused (allow strategy changes)
    const isPaused = agent.status === 'PAUSED' || agent.status === 'STOPPED';

    // Strategy change handlers (Intercepted by Confirmation)
    const handleMacroStrategyChange = useCallback((strategyId: string | null) => {
        setPendingStrategy({ type: 'MACRO', strategyId });
    }, []);

    const handleMicroStrategyChange = useCallback((strategyId: string | null) => {
        setPendingStrategy({ type: 'MICRO', strategyId });
    }, []);

    const confirmStrategyChange = async () => {
        if (!pendingStrategy) return;

        try {
            console.log(`[AgentCockpit] Confirming ${pendingStrategy.type} strategy update to:`, pendingStrategy.strategyId);

            if (pendingStrategy.type === 'MACRO') {
                await updateAgent(agent.id, { macro_strategy_id: pendingStrategy.strategyId } as any);
            } else {
                await updateAgent(agent.id, { micro_strategy_id: pendingStrategy.strategyId } as any);
            }

            // Note: Agent status is NOT automatically changed to RUNNING. 
            // It remains PAUSED/STOPPED as required by the update logic.
            // The user must manually click Start.

        } catch (err) {
            console.error('Failed to update strategy:', err);
        } finally {
            setPendingStrategy(null);
        }
    };

    const cancelStrategyChange = () => {
        setPendingStrategy(null);
    };

    // Extract Ghost Lines from logs or current proposal
    const ghostLines: VisualOverlay[] = useMemo(() => {
        // First, check if we have a current proposal to visualize
        if (agent.current_proposal) {
            return [
                {
                    shape: 'line' as const,
                    price: agent.current_proposal.entry,
                    color: '#3b82f6',  // Blue for entry
                    label: `Entry: $${agent.current_proposal.entry.toFixed(2)}`,
                    style: 'solid' as const,
                },
                {
                    shape: 'line' as const,
                    price: agent.current_proposal.stop_loss,
                    color: '#ef4444',  // Red for stop loss
                    label: `SL: $${agent.current_proposal.stop_loss.toFixed(2)}`,
                    style: 'dashed' as const,
                },
                {
                    shape: 'line' as const,
                    price: agent.current_proposal.take_profit,
                    color: '#10b981',  // Green for take profit
                    label: `TP: $${agent.current_proposal.take_profit.toFixed(2)}`,
                    style: 'dashed' as const,
                },
            ];
        }

        // Fallback: Check logs for visual_snapshot
        const latestWithVisuals = logs.find(log =>
            log.visual_snapshot && log.visual_snapshot.length > 0
        );

        return latestWithVisuals?.visual_snapshot || [];
    }, [agent.current_proposal, logs]);

    // Fetch logs on mount and periodically
    useEffect(() => {
        fetchAgentLogs(agent.id);
        const interval = setInterval(() => fetchAgentLogs(agent.id), 10000);
        return () => clearInterval(interval);
    }, [agent.id]);

    // Fetch Backtest Snapshot on start
    useEffect(() => {
        if (['ACTIVE', 'SCANNING', 'PROPOSING'].includes(agent.status)) {
            fetchBacktestSnapshot(agent.id);
        }
    }, [agent.id, agent.status]);

    const macroOverlays = useMemo(() => {
        const backtest = backtestVisuals[agent.id]?.macro || [];
        return [...backtest, ...ghostLines];
    }, [backtestVisuals, agent.id, ghostLines]);

    const microOverlays = useMemo(() => {
        const backtest = backtestVisuals[agent.id]?.micro || [];
        return [...backtest, ...ghostLines];
    }, [backtestVisuals, agent.id, ghostLines]);

    // Auto-scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = 0;
        }
    }, [logs]);

    const handleBack = () => {
        selectAgent(null);
        setShowAgentCockpit(false);
    };

    const handleApprove = async () => {
        try {
            await approveProposal(agent.id, true, 'Approved via cockpit');
        } catch (e) {
            console.error('Approve failed:', e);
        }
    };

    const handleReject = async () => {
        try {
            await approveProposal(agent.id, false, 'Rejected via cockpit');
        } catch (e) {
            console.error('Reject failed:', e);
        }
    };

    const renderLogEntry = (log: AgentLog) => {
        const time = formatLogTimestamp(log.timestamp);
        const statusClass = log.status.toLowerCase().replace('_', '-');
        const isExpanded = expandedLogs.has(log.id);

        const toggleExpand = () => {
            setExpandedLogs(prev => {
                const newSet = new Set(prev);
                if (newSet.has(log.id)) {
                    newSet.delete(log.id);
                } else {
                    newSet.add(log.id);
                }
                return newSet;
            });
        };

        return (
            <div
                key={log.id}
                className={`log-entry status-${statusClass} ${isExpanded ? 'expanded' : ''}`}
                onClick={toggleExpand}
            >
                <span className="log-time">{time}</span>
                <span className={`log-status ${statusClass}`}>{log.status}</span>
                <span className="log-text" title={log.log_text || '-'}>{log.log_text || '-'}</span>
            </div>
        );
    };

    const isRunning = ['SCANNING', 'PROPOSING', 'AWAITING_APPROVAL', 'ACTIVE', 'IN_POSITION'].includes(agent.status);
    const canApprove = agent.status === 'AWAITING_APPROVAL';

    return (
        <div className="agent-cockpit">
            {/* Header */}
            <div className="cockpit-header">
                <button className="back-btn" onClick={handleBack}>
                    <ArrowLeft size={18} />
                    Back to Fleet
                </button>

                <div className="agent-info">
                    <h2>{agent.name}</h2>
                    <span className="agent-symbol">{agent.symbol}</span>
                    <span className={`mode-badge ${agent.mode.toLowerCase()}`}>{agent.mode}</span>
                    <span className={`status-badge ${agent.status.toLowerCase()}`}>{agent.status}</span>
                </div>

                <div className="cockpit-actions">
                    {agent.status === 'PAUSED' || agent.status === 'STOPPED' ? (
                        <button className="action-btn start" onClick={() => startAgent(agent.id)}>
                            <Play size={16} />
                            Start
                        </button>
                    ) : isRunning ? (
                        <button className="action-btn pause" onClick={() => pauseAgent(agent.id)}>
                            <Pause size={16} />
                            Pause
                        </button>
                    ) : null}

                    <button className="action-btn stop" onClick={() => stopAgent(agent.id)}>
                        <StopCircle size={16} />
                        Stop
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="cockpit-content">
                {/* Left: Dual Chart Area - Macro (top) + Micro (bottom) */}
                <div className="cockpit-chart">
                    {/* Macro Timeframe Chart - Higher timeframe for trend analysis */}
                    <div className="cockpit-chart-container macro-chart">
                        <div className="chart-header">
                            <div className="chart-label">
                                <span className="timeframe-badge macro">MACRO</span>
                                {isPaused ? (
                                    <select
                                        className="bg-gray-800 text-white text-xs rounded border border-gray-600 px-1 py-0.5 ml-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={agent.macro_timeframe}
                                        onChange={(e) => updateAgent(agent.id, { macro_timeframe: e.target.value })}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {['1m', '5m', '15m', '30m', '1h', '4h', '1d'].map(tf => (
                                            <option key={tf} value={tf}>{tf}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span>{agent.symbol} - {agent.macro_timeframe}</span>
                                )}
                            </div>
                            <div className="chart-header-right">
                                <span className="chart-description">Übergeordneter Trend</span>
                                <StrategySelector
                                    label="MACRO"
                                    currentStrategyId={agent.macro_strategy_id}
                                    onStrategyChange={handleMacroStrategyChange}
                                    isPaused={isPaused}
                                />
                            </div>
                        </div>
                        <div className="chart-wrapper">
                            <KlineChartCore
                                symbol={agent.symbol}
                                timeframe={agent.macro_timeframe}
                                overlays={macroOverlays}
                                showToolbar={false}
                            />
                        </div>
                    </div>

                    {/* Micro Timeframe Chart - Lower timeframe for trade execution */}
                    <div className="cockpit-chart-container micro-chart">
                        <div className="chart-header">
                            <div className="chart-label">
                                <span className="timeframe-badge micro">MICRO</span>
                                {isPaused ? (
                                    <select
                                        className="bg-gray-800 text-white text-xs rounded border border-gray-600 px-1 py-0.5 ml-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={agent.micro_timeframe}
                                        onChange={(e) => updateAgent(agent.id, { micro_timeframe: e.target.value })}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {['1s', '15s', '1m', '5m', '15m', '30m', '1h', '4h'].map(tf => (
                                            <option key={tf} value={tf}>{tf}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span>{agent.symbol} - {agent.micro_timeframe}</span>
                                )}
                            </div>
                            <div className="chart-header-right">
                                <span className="chart-description">Trade-Ausführung</span>
                                <StrategySelector
                                    label="MICRO"
                                    currentStrategyId={agent.micro_strategy_id}
                                    onStrategyChange={handleMicroStrategyChange}
                                    isPaused={isPaused}
                                />
                                {ghostLines.length > 0 && (
                                    <span className="ghost-lines-indicator">
                                        🎯 Ghost Lines
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="chart-wrapper">
                            <KlineChartCore
                                symbol={agent.symbol}
                                timeframe={agent.micro_timeframe}
                                overlays={microOverlays}
                                showToolbar={false}
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Sidebar */}
                <div className="cockpit-sidebar">
                    {/* Approval Panel */}
                    {canApprove && (
                        <div className="approval-panel">
                            <h3>Trade Proposal</h3>
                            <p>Agent is awaiting your approval to execute trade.</p>

                            {agent.current_proposal && (
                                <div className="proposal-summary">
                                    <div className="proposal-row">
                                        <span>Side:</span>
                                        <span className={agent.current_proposal.side.toLowerCase()}>
                                            {agent.current_proposal.side}
                                        </span>
                                    </div>
                                    <div className="proposal-row">
                                        <span>Entry:</span>
                                        <span>${agent.current_proposal.entry.toFixed(2)}</span>
                                    </div>
                                    <div className="proposal-row">
                                        <span>Stop Loss:</span>
                                        <span className="sl">${agent.current_proposal.stop_loss.toFixed(2)}</span>
                                    </div>
                                    <div className="proposal-row">
                                        <span>Take Profit:</span>
                                        <span className="tp">${agent.current_proposal.take_profit.toFixed(2)}</span>
                                    </div>
                                    <div className="proposal-row">
                                        <span>Size:</span>
                                        <span>{agent.current_proposal.position_size.toFixed(6)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="approval-actions">
                                <button className="btn-approve" onClick={handleApprove}>
                                    <Check size={16} />
                                    Approve
                                </button>
                                <button className="btn-reject" onClick={handleReject}>
                                    <X size={16} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active Position Card */}
                    {agent.active_position && (
                        <div className="mb-4">
                            <ActivePositionCard position={agent.active_position} />
                        </div>
                    )}

                    {/* Live Price Ticker */}
                    <LivePriceTicker symbol={agent.symbol} />

                    {/* Stats Panel */}
                    <div className="stats-panel">
                        <h3>Session Stats</h3>
                        <div className="stats-grid">
                            <div className="stat">
                                <span className="stat-label">Budget</span>
                                <span className="stat-value">${Number(agent.budget || 0).toLocaleString()}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">P&L</span>
                                <span className={`stat-value ${Number(agent.session_pnl) >= 0 ? 'profit' : 'loss'}`}>
                                    {Number(agent.session_pnl) >= 0 ? '+' : ''}{Number(agent.session_pnl || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">Trades</span>
                                <span className="stat-value">{agent.total_trades}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">Win Rate</span>
                                <span className="stat-value">
                                    {agent.total_trades > 0
                                        ? ((agent.winning_trades / agent.total_trades) * 100).toFixed(0) + '%'
                                        : '-'
                                    }
                                </span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">Kill Switch</span>
                                <span className="stat-value">{Number(agent.max_drawdown_percent || 0)}%</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">Risk/Trade</span>
                                <span className="stat-value">{(Number(agent.risk_per_trade || 0) * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Log Terminal */}
                    <div className="log-panel">
                        <div className="log-header">
                            <Terminal size={14} />
                            <h3>Agent Log</h3>
                            <button onClick={() => fetchAgentLogs(agent.id)}>
                                <RefreshCw size={12} />
                            </button>
                        </div>
                        <div className="log-container" ref={logContainerRef}>
                            {logs.length === 0 ? (
                                <div className="log-empty">No logs yet. Start the agent to see activity.</div>
                            ) : (
                                logs.map(renderLogEntry)
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Confirmation Modal for Strategy Change */}
            <ConfirmationModal
                isOpen={!!pendingStrategy}
                title="Strategie ändern?"
                message={`Bist du sicher, dass du die ${pendingStrategy?.type}-Strategie ändern möchtest? Der Agent muss danach manuell wieder gestartet werden.`}
                confirmLabel="Strategie ändern"
                type="warning"
                onConfirm={confirmStrategyChange}
                onCancel={cancelStrategyChange}
            />
        </div>
    );
};

export default AgentCockpit;
