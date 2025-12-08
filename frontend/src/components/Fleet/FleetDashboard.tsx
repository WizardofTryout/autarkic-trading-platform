/**
 * Fleet Dashboard - Mission Control Overview
 * 
 * Displays all trading agents in a table with live status updates.
 * Provides controls for deploying, starting, and managing agents.
 */

import React, { useEffect } from 'react';
import { useFleetStore } from '../../store/fleetStore';
import type { TradingAgent, AgentStatus } from '../../store/fleetStore';
import { Plus, Play, Pause, StopCircle, Trash2, Eye, RefreshCw, Bot } from 'lucide-react';
import DeployAgentModal from './DeployAgentModal';
import AgentCockpit from './AgentCockpit';
import './FleetDashboard.css';

// Status color mapping
const STATUS_COLORS: Record<AgentStatus, { bg: string; text: string; dot: string }> = {
    PAUSED: { bg: 'rgba(107, 114, 128, 0.2)', text: '#9CA3AF', dot: '#6B7280' },
    SCANNING: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60A5FA', dot: '#3B82F6' },
    PROPOSING: { bg: 'rgba(234, 179, 8, 0.2)', text: '#FBBF24', dot: '#EAB308' },
    AWAITING_APPROVAL: { bg: 'rgba(249, 115, 22, 0.2)', text: '#FB923C', dot: '#F97316' },
    ACTIVE: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ADE80', dot: '#22C55E' },
    IN_POSITION: { bg: 'rgba(139, 92, 246, 0.2)', text: '#A78BFA', dot: '#8B5CF6' },
    COOLDOWN: { bg: 'rgba(107, 114, 128, 0.2)', text: '#9CA3AF', dot: '#6B7280' },
    STOPPED: { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171', dot: '#EF4444' },
    ERROR: { bg: 'rgba(220, 38, 38, 0.2)', text: '#FCA5A5', dot: '#DC2626' },
};

const FleetDashboard: React.FC = () => {
    const {
        agents,
        selectedAgentId,
        isLoading,
        error,
        showDeployModal,
        showAgentCockpit,
        wsConnected,
        fetchAgents,
        startAgent,
        pauseAgent,
        stopAgent,
        deleteAgent,
        selectAgent,
        setShowDeployModal,
        connectWebSocket,
        disconnectWebSocket
    } = useFleetStore();

    // Connect WebSocket on mount
    useEffect(() => {
        fetchAgents();
        connectWebSocket();

        return () => {
            disconnectWebSocket();
        };
    }, []);

    // Calculate fleet stats
    const activeCount = agents.filter(a => ['SCANNING', 'PROPOSING', 'ACTIVE', 'IN_POSITION'].includes(a.status)).length;
    const totalPnL = agents.reduce((sum, a) => sum + (Number(a.session_pnl) || 0), 0);
    const totalBudget = agents.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);

    const handleDelete = async (agentId: string, agentName: string) => {
        if (window.confirm(`Are you sure you want to delete agent "${agentName}"? This will release its budget.`)) {
            try {
                await deleteAgent(agentId);
            } catch (e) {
                console.error('Delete failed:', e);
            }
        }
    };

    const renderStatusBadge = (status: AgentStatus) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS.PAUSED;
        return (
            <div
                className="status-badge"
                style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                }}
            >
                <span className="status-dot" style={{ backgroundColor: colors.dot }} />
                {status}
            </div>
        );
    };

    const renderAgentActions = (agent: TradingAgent) => {
        const isRunning = ['SCANNING', 'PROPOSING', 'AWAITING_APPROVAL', 'ACTIVE', 'IN_POSITION'].includes(agent.status);

        return (
            <div className="agent-actions">
                {agent.status === 'PAUSED' || agent.status === 'STOPPED' ? (
                    <button
                        className="action-btn start"
                        onClick={() => startAgent(agent.id)}
                        title="Start Agent"
                    >
                        <Play size={14} />
                    </button>
                ) : isRunning ? (
                    <button
                        className="action-btn pause"
                        onClick={() => pauseAgent(agent.id)}
                        title="Pause Agent"
                    >
                        <Pause size={14} />
                    </button>
                ) : null}

                <button
                    className="action-btn view"
                    onClick={() => selectAgent(agent.id)}
                    title="View Agent"
                >
                    <Eye size={14} />
                </button>

                {agent.status !== 'IN_POSITION' && (
                    <button
                        className="action-btn stop"
                        onClick={() => stopAgent(agent.id)}
                        title="Stop Agent"
                    >
                        <StopCircle size={14} />
                    </button>
                )}

                {(agent.status === 'PAUSED' || agent.status === 'STOPPED') && (
                    <button
                        className="action-btn delete"
                        onClick={() => handleDelete(agent.id, agent.name)}
                        title="Delete Agent"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        );
    };

    // If cockpit is open, show that instead
    if (showAgentCockpit && selectedAgentId) {
        const selectedAgent = agents.find(a => a.id === selectedAgentId);
        if (selectedAgent) {
            return <AgentCockpit agent={selectedAgent} />;
        }
    }

    return (
        <div className="fleet-dashboard">
            {/* Header */}
            <div className="fleet-header">
                <div className="fleet-title">
                    <Bot size={24} />
                    <h2>Trading Fleet</h2>
                    <span className={`ws-indicator ${wsConnected ? 'connected' : 'disconnected'}`}>
                        {wsConnected ? '● Live' : '○ Offline'}
                    </span>
                </div>

                <div className="fleet-actions">
                    <button onClick={fetchAgents} className="btn-refresh" disabled={isLoading}>
                        <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
                    </button>
                    <button onClick={() => setShowDeployModal(true)} className="btn-deploy">
                        <Plus size={16} />
                        Deploy Agent
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="fleet-stats">
                <div className="stat-card">
                    <span className="stat-label">Total Agents</span>
                    <span className="stat-value">{agents.length}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Active</span>
                    <span className="stat-value active">{activeCount}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Total Budget</span>
                    <span className="stat-value">${totalBudget.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Session P&L</span>
                    <span className={`stat-value ${totalPnL >= 0 ? 'profit' : 'loss'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USDT
                    </span>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="fleet-error">
                    {error}
                </div>
            )}

            {/* Agents Table */}
            <div className="agents-table-container">
                {agents.length === 0 ? (
                    <div className="no-agents">
                        <Bot size={48} />
                        <p>No agents deployed yet</p>
                        <button onClick={() => setShowDeployModal(true)} className="btn-deploy">
                            <Plus size={16} />
                            Deploy Your First Agent
                        </button>
                    </div>
                ) : (
                    <table className="agents-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Symbol</th>
                                <th>Mode</th>
                                <th>Status</th>
                                <th>Budget</th>
                                <th>Session P&L</th>
                                <th>Trades</th>
                                <th>Kill Switch</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map(agent => (
                                <tr key={agent.id} className={selectedAgentId === agent.id ? 'selected' : ''}>
                                    <td className="agent-name">{agent.name}</td>
                                    <td className="agent-symbol">{agent.symbol}</td>
                                    <td>
                                        <span className={`mode-badge ${agent.mode.toLowerCase()}`}>
                                            {agent.mode}
                                        </span>
                                    </td>
                                    <td>{renderStatusBadge(agent.status)}</td>
                                    <td className="agent-budget">${Number(agent.budget || 0).toLocaleString()}</td>
                                    <td className={`agent-pnl ${Number(agent.session_pnl) >= 0 ? 'profit' : 'loss'}`}>
                                        {Number(agent.session_pnl) >= 0 ? '+' : ''}{Number(agent.session_pnl || 0).toFixed(2)}
                                    </td>
                                    <td className="agent-trades">
                                        {agent.winning_trades}/{agent.total_trades}
                                    </td>
                                    <td className="agent-killswitch">
                                        {Number(agent.max_drawdown_percent || 0)}%
                                    </td>
                                    <td>{renderAgentActions(agent)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Deploy Modal */}
            {showDeployModal && <DeployAgentModal />}
        </div>
    );
};

export default FleetDashboard;
