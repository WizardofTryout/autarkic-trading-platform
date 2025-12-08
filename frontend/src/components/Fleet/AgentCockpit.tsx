/**
 * Agent Cockpit - Detailed view for a single trading agent
 * 
 * Shows:
 * - Live chart with Ghost Lines (agent overlays)
 * - Scrolling log terminal
 * - Agent controls (START/PAUSE/STOP, Approve proposal)
 * - Agent configuration summary
 */

import React, { useEffect, useRef } from 'react';
import { useFleetStore } from '../../store/fleetStore';
import type { TradingAgent, AgentLog } from '../../store/fleetStore';
import {
    ArrowLeft, Play, Pause, StopCircle, Check, X,
    RefreshCw, Terminal
} from 'lucide-react';
import './AgentCockpit.css';

interface AgentCockpitProps {
    agent: TradingAgent;
}

const AgentCockpit: React.FC<AgentCockpitProps> = ({ agent }) => {
    const {
        agentLogs,
        selectAgent,
        setShowAgentCockpit,
        startAgent,
        pauseAgent,
        stopAgent,
        approveProposal,
        fetchAgentLogs
    } = useFleetStore();

    const logContainerRef = useRef<HTMLDivElement>(null);
    const logs = agentLogs[agent.id] || [];

    // Fetch logs on mount and periodically
    useEffect(() => {
        fetchAgentLogs(agent.id);
        const interval = setInterval(() => fetchAgentLogs(agent.id), 10000);
        return () => clearInterval(interval);
    }, [agent.id]);

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
        const time = new Date(log.timestamp).toLocaleTimeString();
        const statusClass = log.status.toLowerCase().replace('_', '-');

        return (
            <div key={log.id} className={`log-entry status-${statusClass}`}>
                <span className="log-time">{time}</span>
                <span className={`log-status ${statusClass}`}>{log.status}</span>
                <span className="log-text">{log.log_text || '-'}</span>
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
                {/* Left: Chart Area (Placeholder for KlineCharts integration) */}
                <div className="cockpit-chart">
                    <div className="chart-placeholder">
                        <div className="chart-header">
                            <span>{agent.symbol} - Agent View</span>
                            <span className="timeframes">
                                {agent.macro_timeframe} / {agent.micro_timeframe}
                            </span>
                        </div>
                        <div className="chart-body">
                            <p>📊 KlineCharts Integration</p>
                            <p className="hint">Ghost Lines will appear here when agent proposes trades</p>

                            {/* Show proposal visuals if available */}
                            {agent.current_proposal && (
                                <div className="proposal-preview">
                                    <h4>Current Proposal</h4>
                                    <div className="proposal-details">
                                        <span className={`side ${agent.current_proposal.side.toLowerCase()}`}>
                                            {agent.current_proposal.side}
                                        </span>
                                        <span>Entry: ${agent.current_proposal.entry.toFixed(2)}</span>
                                        <span className="sl">SL: ${agent.current_proposal.stop_loss.toFixed(2)}</span>
                                        <span className="tp">TP: ${agent.current_proposal.take_profit.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
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
        </div>
    );
};

export default AgentCockpit;
