/**
 * StrategySelector - Dropdown component for selecting strategies
 * 
 * Shows available strategies and allows switching when agent is paused.
 * Used in both Macro and Micro chart headers.
 */

import React, { useEffect, useState } from 'react';
import { ChevronDown, AlertTriangle, Star } from 'lucide-react';
import { getStrategies, updateStrategy } from '../../services/api';
import type { Strategy } from '../../services/api';
import './StrategySelector.css';

interface StrategySelectorProps {
    label: 'MACRO' | 'MICRO';
    currentStrategyId: string | null;
    onStrategyChange: (strategyId: string | null) => void;
    disabled?: boolean;
    isPaused: boolean;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({
    label,
    currentStrategyId,
    onStrategyChange,
    disabled = false,
    isPaused,
}) => {
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [showPauseWarning, setShowPauseWarning] = useState(false);

    // Fetch available strategies
    useEffect(() => {
        const fetchStrategiesData = async () => {
            try {
                setIsLoading(true);
                const data = await getStrategies();
                // Filter only compiled strategies
                const compiledStrategies = (data || []).filter(
                    (s: Strategy) => s.status === 'compiled' || s.python_code
                );
                setStrategies(compiledStrategies);
                setError(null);
            } catch (err: any) {
                console.error('Failed to fetch strategies:', err);
                setError('Failed to load strategies');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStrategiesData();
    }, []);

    const currentStrategy = strategies.find(s => s.id === currentStrategyId);
    const displayName = currentStrategy?.name || 'No Strategy';

    // Sort strategies: favorites first
    const sortedStrategies = [...strategies].sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return a.name.localeCompare(b.name);
    });

    const handleSelect = (strategyId: string | null) => {
        if (!isPaused) {
            setShowPauseWarning(true);
            setTimeout(() => setShowPauseWarning(false), 3000);
            return;
        }
        onStrategyChange(strategyId);
        setIsOpen(false);
    };

    const toggleFavorite = async (e: React.MouseEvent, strategyId: string, currentFavorite: boolean) => {
        e.stopPropagation();
        try {
            // Optimistic update
            setStrategies(prev => prev.map(s =>
                s.id === strategyId ? { ...s, is_favorite: !currentFavorite } : s
            ));
            await updateStrategy(strategyId, { is_favorite: !currentFavorite });
        } catch (err) {
            console.error('Failed to update favorite:', err);
            // Revert on error
            setStrategies(prev => prev.map(s =>
                s.id === strategyId ? { ...s, is_favorite: currentFavorite } : s
            ));
        }
    };

    if (isLoading) {
        return (
            <div className="strategy-selector loading">
                <span className="loading-text">Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="strategy-selector error">
                <AlertTriangle size={12} />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className={`strategy-selector ${disabled ? 'disabled' : ''}`}>
            <button
                className={`strategy-selector-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span className="strategy-name">{displayName}</span>
                <ChevronDown size={14} className="chevron" />
            </button>

            {isOpen && (
                <>
                    <div className="strategy-dropdown-overlay" onClick={() => setIsOpen(false)} />
                    <div className="strategy-dropdown">
                        <div className="dropdown-header">
                            <span>Select {label} Strategy</span>
                            {!isPaused && (
                                <span className="pause-hint">⚠️ Pause agent first</span>
                            )}
                        </div>
                        <div className="dropdown-options">
                            <button
                                className={`dropdown-option ${!currentStrategyId ? 'selected' : ''}`}
                                onClick={() => handleSelect(null)}
                            >
                                <div className="option-left">
                                    <span className="option-star empty" />
                                    <span className="option-name">No Strategy</span>
                                </div>
                                <span className="option-desc">MANUAL</span>
                            </button>
                            {sortedStrategies.map(strategy => (
                                <button
                                    key={strategy.id}
                                    className={`dropdown-option ${currentStrategyId === strategy.id ? 'selected' : ''}`}
                                    onClick={() => handleSelect(strategy.id)}
                                >
                                    <div className="option-left">
                                        <span
                                            className={`option-star ${strategy.is_favorite ? 'favorite' : ''}`}
                                            onClick={(e) => toggleFavorite(e, strategy.id, strategy.is_favorite || false)}
                                        >
                                            <Star size={14} fill={strategy.is_favorite ? '#fbbf24' : 'none'} />
                                        </span>
                                        <span className="option-name">{strategy.name}</span>
                                    </div>
                                    <span className="option-type">{strategy.type?.toUpperCase() || 'STRAT'}</span>
                                </button>
                            ))}
                            {strategies.length === 0 && (
                                <div className="no-strategies">
                                    No compiled strategies available.
                                    <br />
                                    Create one in Strategy Builder.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Custom Toast Notification */}
            {showPauseWarning && (
                <div className="strategy-toast">
                    <AlertTriangle size={16} />
                    <span>Bitte pausiere den Agent zuerst, um die Strategie zu wechseln.</span>
                </div>
            )}
        </div>
    );
};

export default StrategySelector;
