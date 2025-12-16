/**
 * Fleet Dashboard - Mission Control Overview
 * 
 * Displays all trading agents in a table with live status updates.
 * Provides controls for deploying, starting, and managing agents.
 */

import React, { useEffect, useState } from 'react';
import { useFleetStore } from '../../store/fleetStore';
import type { TradingAgent, AgentStatus } from '../../store/fleetStore';
import { Plus, Play, Pause, StopCircle, Trash2, Eye, RefreshCw, Bot, Pencil } from 'lucide-react';
import DeployAgentModal from './DeployAgentModal';
import AgentCockpit from './AgentCockpit';
import './FleetDashboard.css';

// Lazy load EditPositionModal
const EditPositionModal = React.lazy(() => import('../Dashboard/EditPositionModal'));

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
        deployWizardState,
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
        disconnectWebSocket,
        closePosition,
        approveProposal
    } = useFleetStore();

    // State for expanded trade details
    const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
    
    // State for approval modal
    const [approvalModal, setApprovalModal] = useState<{ show: boolean; agent: TradingAgent | null }>({ 
        show: false, 
        agent: null 
    });

    // State for editing position TP/SL
    const [editingPosition, setEditingPosition] = useState<any | null>(null);
    
    // State for agent pause warning
    const [showPauseWarning, setShowPauseWarning] = useState(false);

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

    // Delete confirmation modal state
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; agentId: string; agentName: string }>({
        show: false, agentId: '', agentName: ''
    });

    const handleDeleteClick = (agentId: string, agentName: string) => {
        setDeleteConfirm({ show: true, agentId, agentName });
    };

    const handleDeleteConfirm = async () => {
        try {
            await deleteAgent(deleteConfirm.agentId);
        } catch (e) {
            console.error('Delete failed:', e);
        } finally {
            setDeleteConfirm({ show: false, agentId: '', agentName: '' });
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirm({ show: false, agentId: '', agentName: '' });
    };

    const renderStatusBadge = (status: AgentStatus, agent?: TradingAgent) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS.PAUSED;
        const isClickable = status === 'AWAITING_APPROVAL' && agent;
        
        return (
            <div
                className={`status-badge ${isClickable ? 'clickable' : ''}`}
                style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                    cursor: isClickable ? 'pointer' : 'default',
                }}
                onClick={() => {
                    if (isClickable && agent) {
                        setApprovalModal({ show: true, agent });
                    }
                }}
                title={isClickable ? 'Click to review proposal' : ''}
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
                        onClick={() => handleDeleteClick(agent.id, agent.name)}
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
                                <React.Fragment key={agent.id}>
                                    <tr className={selectedAgentId === agent.id ? 'selected' : ''}>
                                        <td className="agent-name">{agent.name}</td>
                                        <td className="agent-symbol">{agent.symbol}</td>
                                        <td>
                                            <span className={`mode-badge ${agent.mode.toLowerCase()}`}>
                                                {agent.mode}
                                            </span>
                                        </td>
                                        <td>{renderStatusBadge(agent.status, agent)}</td>
                                        <td className="agent-budget">${Number(agent.budget || 0).toLocaleString()}</td>
                                        <td className={`agent-pnl ${Number(agent.session_pnl) >= 0 ? 'profit' : 'loss'}`}>
                                            {Number(agent.session_pnl) >= 0 ? '+' : ''}{Number(agent.session_pnl || 0).toFixed(2)}
                                        </td>
                                        <td
                                            className="agent-trades clickable"
                                            onClick={() => setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id)}
                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            {agent.active_positions?.length || 0}/{agent.total_trades}
                                            {(agent.active_positions && agent.active_positions.length > 0) && (expandedAgentId === agent.id ? ' ▲' : ' ▼')}
                                        </td>
                                        <td className="agent-killswitch">
                                            {Number(agent.max_drawdown_percent || 0)}%
                                        </td>
                                        <td>{renderAgentActions(agent)}</td>
                                    </tr>
                                    {expandedAgentId === agent.id && (agent.active_positions && agent.active_positions.length > 0 ? agent.active_positions : (agent.active_position ? [agent.active_position] : [])).map((position) => (
                                        <tr key={position.id} className="expanded-details-row">
                                            <td colSpan={9}>
                                                <div className="trade-details-panel">
                                                    <div className="detail-group">
                                                        <span className="detail-label">Symbol</span>
                                                        <span className="detail-value">{position.symbol} ({position.side})</span>
                                                    </div>
                                                    <div className="detail-group">
                                                        <span className="detail-label">Entry</span>
                                                        <span className="detail-value">${position.entry_price.toFixed(2)}</span>
                                                    </div>
                                                    <div className="detail-group">
                                                        <span className="detail-label">Current P&L</span>
                                                        <span className={`detail-value ${position.unrealized_pnl >= 0 ? 'profit' : 'loss'}`}>
                                                            {position.unrealized_pnl >= 0 ? '+' : ''}
                                                            {position.unrealized_pnl?.toFixed(2) || '0.00'}
                                                        </span>
                                                    </div>
                                                    <div className="detail-group">
                                                        <span className="detail-label">Stop Loss</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span className="detail-value loss">${position.stop_loss?.toFixed(2) || '-'}</span>
                                                            <button
                                                                className="btn-edit-small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingPosition({ ...position, agentId: agent.id, agentStatus: agent.status });
                                                                }}
                                                                title="Edit TP/SL"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="detail-group">
                                                        <span className="detail-label">Take Profit</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span className="detail-value profit">${position.take_profit?.toFixed(2) || '-'}</span>
                                                            <button
                                                                className="btn-edit-small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingPosition({ ...position, agentId: agent.id, agentStatus: agent.status });
                                                                }}
                                                                title="Edit TP/SL"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="detail-actions">
                                                        <button
                                                            className="btn-close-position"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm('Are you sure you want to close this position?')) {
                                                                    await closePosition(position.id);
                                                                }
                                                            }}
                                                        >
                                                            Close Trade
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>

                            ))}
                        </tbody >
                    </table >
                )}
            </div >

            {/* Deploy Modal */}
            {deployWizardState.isOpen && <DeployAgentModal />}

            {/* Approval Modal */}
            {approvalModal.show && approvalModal.agent && approvalModal.agent.current_proposal && (
                <div className="modal-overlay" onClick={() => setApprovalModal({ show: false, agent: null })}>
                    <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="approval-header">
                            <h3>Trade Proposal</h3>
                            <p className="approval-subtitle">Agent is awaiting your approval to execute trade.</p>
                        </div>
                        
                        <div className="proposal-details">
                            <div className="proposal-row">
                                <span className="proposal-label">Side:</span>
                                <span className={`proposal-value ${approvalModal.agent.current_proposal.side === 'LONG' ? 'long' : 'short'}`}>
                                    {approvalModal.agent.current_proposal.side}
                                </span>
                            </div>
                            <div className="proposal-row">
                                <span className="proposal-label">Entry:</span>
                                <span className="proposal-value">${approvalModal.agent.current_proposal.entry?.toFixed(2)}</span>
                            </div>
                            <div className="proposal-row">
                                <span className="proposal-label">Stop Loss:</span>
                                <span className="proposal-value loss">${approvalModal.agent.current_proposal.stop_loss?.toFixed(2)}</span>
                            </div>
                            <div className="proposal-row">
                                <span className="proposal-label">Take Profit:</span>
                                <span className="proposal-value profit">${approvalModal.agent.current_proposal.take_profit?.toFixed(2)}</span>
                            </div>
                            <div className="proposal-row">
                                <span className="proposal-label">Size:</span>
                                <span className="proposal-value">{approvalModal.agent.current_proposal.position_size?.toFixed(6)}</span>
                            </div>
                        </div>
                        
                        <div className="approval-actions">
                            <button 
                                className="btn-approve"
                                onClick={async () => {
                                    try {
                                        await approveProposal(approvalModal.agent!.id, true);
                                        setApprovalModal({ show: false, agent: null });
                                    } catch (err) {
                                        console.error('Failed to approve:', err);
                                    }
                                }}
                            >
                                ✓ Approve
                            </button>
                            <button 
                                className="btn-reject"
                                onClick={async () => {
                                    try {
                                        await approveProposal(approvalModal.agent!.id, false, 'Rejected by user');
                                        setApprovalModal({ show: false, agent: null });
                                    } catch (err) {
                                        console.error('Failed to reject:', err);
                                    }
                                }}
                            >
                                ✗ Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {
                deleteConfirm.show && (
                    <div className="modal-overlay" onClick={handleDeleteCancel}>
                        <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="confirm-header">
                                <Trash2 size={24} className="confirm-icon" />
                                <h3>Delete Agent</h3>
                            </div>
                            <p className="confirm-message">
                                Are you sure you want to delete <strong>"{deleteConfirm.agentName}"</strong>?
                            </p>
                            <p className="confirm-warning">
                                This will release the agent's locked budget back to your account.
                            </p>
                            <div className="confirm-actions">
                                <button className="btn-cancel" onClick={handleDeleteCancel}>
                                    Cancel
                                </button>
                                <button className="btn-delete" onClick={handleDeleteConfirm}>
                                    <Trash2 size={16} />
                                    Delete Agent
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Agent Pause Warning Modal */}
            {showPauseWarning && (
                <div className="modal-overlay" onClick={() => setShowPauseWarning(false)}>
                    <div className="pause-warning-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="warning-header">
                            <span className="warning-icon">⚠️</span>
                            <h3>Agent pausieren erforderlich</h3>
                        </div>
                        <p className="warning-message">
                            Bitte pausiere den Agent erst, bevor du Stop Loss und Take Profit anpassen kannst.
                        </p>
                        <div className="warning-actions">
                            <button 
                                className="btn-warning-ok"
                                onClick={() => setShowPauseWarning(false)}
                            >
                                OK, verstanden
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Position Modal */}
            {editingPosition && (
                <React.Suspense fallback={<div>Loading...</div>}>
                    <EditPositionModal
                        position={editingPosition}
                        currentPrice={editingPosition.entry_price}
                        onClose={() => setEditingPosition(null)}
                        onSave={async (positionId: string, updates: { stop_loss?: number; take_profit?: number }) => {
                            // Check if agent is running
                            if (editingPosition.agentStatus === 'RUNNING') {
                                setShowPauseWarning(true);
                                return;
                            }

                            try {
                                const response = await fetch(`/api/v1/paper/positions/${positionId}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(updates)
                                });

                                if (!response.ok) {
                                    const error = await response.json();
                                    throw new Error(error.detail || 'Failed to update position');
                                }

                                // Refresh agent data
                                await fetchAgents();
                                setEditingPosition(null);
                            } catch (error: any) {
                                console.error('Failed to update position:', error);
                                alert('❌ ' + error.message);
                            }
                        }}
                    />
                </React.Suspense>
            )}
        </div >
    );
};

export default FleetDashboard;
