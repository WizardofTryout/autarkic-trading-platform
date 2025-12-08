/**
 * KlineToolbar - Toolbar für KlineCharts Core
 * 
 * Features:
 * - Timeframe-Buttons (1s bis 1d)
 * - Indicator Dropdown (Built-in Indikatoren)
 * - Custom Strategies Button
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTradingStore } from '../../store/tradingStore';
import { BarChart2, Plus, Minus, ChevronDown } from 'lucide-react';

// Available timeframes
const TIMEFRAMES = ['1s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'];

// Built-in indicators from KlineCharts
const INDICATORS = {
    main: [
        { name: 'MA', label: 'MA (Moving Average)' },
        { name: 'EMA', label: 'EMA (Exponential MA)' },
        { name: 'SMA', label: 'SMA (Simple MA)' },
        { name: 'BOLL', label: 'Bollinger Bands' },
        { name: 'SAR', label: 'SAR (Stop and Reverse)' },
    ],
    sub: [
        { name: 'VOL', label: 'Volume' },
        { name: 'MACD', label: 'MACD' },
        { name: 'RSI', label: 'RSI (Relative Strength)' },
        { name: 'KDJ', label: 'KDJ' },
        { name: 'CCI', label: 'CCI' },
        { name: 'WR', label: 'Williams %R' },
        { name: 'OBV', label: 'On Balance Volume' },
        { name: 'ROC', label: 'Rate of Change' },
        { name: 'ATR', label: 'ATR (True Range)' },
    ],
};

interface KlineToolbarProps {
    onAddIndicator?: (name: string, isStack: boolean) => void;
    onRemoveIndicator?: (name: string, isMain: boolean) => void;
    onOpenStrategiesModal?: () => void;
}

const KlineToolbar: React.FC<KlineToolbarProps> = ({
    onAddIndicator,
    onRemoveIndicator,
    onOpenStrategiesModal,
}) => {
    const { timeframe, setTimeframe } = useTradingStore();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [activeIndicators, setActiveIndicators] = useState<string[]>(['VOL']);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleIndicator = (name: string, isMain: boolean) => {
        if (activeIndicators.includes(name)) {
            setActiveIndicators(prev => prev.filter(i => i !== name));
            onRemoveIndicator?.(name, isMain);
        } else {
            setActiveIndicators(prev => [...prev, name]);
            onAddIndicator?.(name, isMain);
        }
    };

    return (
        <div className="kline-toolbar">
            {/* Timeframes */}
            <div className="toolbar-group">
                {TIMEFRAMES.map((tf) => (
                    <button
                        key={tf}
                        className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                        onClick={() => setTimeframe(tf)}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            {/* Divider */}
            <div className="toolbar-divider" />

            {/* Indicators */}
            <div className="toolbar-group" ref={dropdownRef}>
                <button
                    className="indicator-btn"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                    <BarChart2 className="btn-icon" />
                    Indicators
                    <ChevronDown className={`chevron ${dropdownOpen ? 'open' : ''}`} />
                </button>

                {dropdownOpen && (
                    <div className="dropdown">
                        <div className="dropdown-section">
                            <div className="section-title">Main Indicators</div>
                            {INDICATORS.main.map((ind) => (
                                <div
                                    key={ind.name}
                                    className={`dropdown-item ${activeIndicators.includes(ind.name) ? 'active' : ''}`}
                                    onClick={() => toggleIndicator(ind.name, true)}
                                >
                                    <span>{ind.label}</span>
                                    {activeIndicators.includes(ind.name) ? (
                                        <Minus className="item-icon" />
                                    ) : (
                                        <Plus className="item-icon" />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="dropdown-section">
                            <div className="section-title">Sub Indicators</div>
                            {INDICATORS.sub.map((ind) => (
                                <div
                                    key={ind.name}
                                    className={`dropdown-item ${activeIndicators.includes(ind.name) ? 'active' : ''}`}
                                    onClick={() => toggleIndicator(ind.name, false)}
                                >
                                    <span>{ind.label}</span>
                                    {activeIndicators.includes(ind.name) ? (
                                        <Minus className="item-icon" />
                                    ) : (
                                        <Plus className="item-icon" />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="dropdown-section">
                            <div
                                className="dropdown-item strategies"
                                onClick={() => {
                                    setDropdownOpen(false);
                                    onOpenStrategiesModal?.();
                                }}
                            >
                                📊 Custom Strategies...
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .kline-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 16px;
                    background: rgba(30, 32, 36, 0.95);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }
                .toolbar-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    position: relative;
                }
                .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                }
                .tf-btn {
                    padding: 5px 8px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #9ca3af;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .tf-btn:hover {
                    color: #fff;
                    background: rgba(255, 255, 255, 0.05);
                }
                .tf-btn.active {
                    color: #fff;
                    background: #3B82F6;
                }
                .indicator-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    font-size: 13px;
                    color: #d1d5db;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .indicator-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                .btn-icon {
                    width: 16px;
                    height: 16px;
                }
                .chevron {
                    width: 14px;
                    height: 14px;
                    transition: transform 0.2s;
                }
                .chevron.open {
                    transform: rotate(180deg);
                }
                .dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 6px;
                    min-width: 240px;
                    background: #1e2024;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    z-index: 1000;
                    overflow: hidden;
                }
                .dropdown-section {
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }
                .dropdown-section:last-child {
                    border-bottom: none;
                }
                .section-title {
                    padding: 4px 12px 8px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #6b7280;
                    letter-spacing: 0.5px;
                }
                .dropdown-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    font-size: 13px;
                    color: #d1d5db;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .dropdown-item:hover {
                    background: rgba(59, 130, 246, 0.1);
                }
                .dropdown-item.active {
                    color: #3B82F6;
                }
                .dropdown-item.strategies {
                    color: #f59e0b;
                    font-weight: 500;
                }
                .item-icon {
                    width: 14px;
                    height: 14px;
                }
            `}</style>
        </div>
    );
};

export default KlineToolbar;
