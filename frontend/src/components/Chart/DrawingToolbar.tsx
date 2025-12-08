/**
 * DrawingToolbar - Collapsible left sidebar for chart drawing tools
 * 
 * Features:
 * - Hamburger menu to expand/collapse (as OVERLAY, not pushing content)
 * - Tool groups with expandable sub-menus
 * - Integration with KlineCharts overlay API
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Menu,
    Minus,
    TrendingUp,
    Grid3X3,
    Hash,
    MessageSquare,
    Magnet,
    Lock,
    Eye,
    EyeOff,
    Trash2,
    ChevronRight,
    X,
} from 'lucide-react';

// Tool definitions with overlay names from KlineCharts
// Note: circle, rect, triangle are NOT built-in - they require custom overlay registration
const TOOL_GROUPS = {
    lines: {
        icon: Minus,
        label: 'Lines',
        tools: [
            { name: 'horizontalStraightLine', label: 'Horizontal Line', icon: '─' },
            { name: 'horizontalRayLine', label: 'Horizontal Ray', icon: '─→' },
            { name: 'horizontalSegment', label: 'Horizontal Segment', icon: '──' },
            { name: 'verticalStraightLine', label: 'Vertical Line', icon: '│' },
            { name: 'verticalRayLine', label: 'Vertical Ray', icon: '│↓' },
            { name: 'verticalSegment', label: 'Vertical Segment', icon: '│' },
        ],
    },
    trendLines: {
        icon: TrendingUp,
        label: 'Trend Lines',
        tools: [
            { name: 'straightLine', label: 'Trend Line', icon: '╱' },
            { name: 'rayLine', label: 'Ray', icon: '╱→' },
            { name: 'segment', label: 'Segment', icon: '╱' },
            { name: 'priceLine', label: 'Price Line', icon: '─ 123' },
        ],
    },
    fibonacci: {
        icon: Grid3X3,
        label: 'Fibonacci',
        tools: [
            { name: 'fibonacciLine', label: 'Fibonacci Line', icon: '≡' },
        ],
    },
    channels: {
        icon: Hash,
        label: 'Channels',
        tools: [
            { name: 'priceChannelLine', label: 'Price Channel', icon: '⫽' },
            { name: 'parallelStraightLine', label: 'Parallel Line', icon: '∥' },
        ],
    },
    annotations: {
        icon: MessageSquare,
        label: 'Annotations',
        tools: [
            { name: 'simpleAnnotation', label: 'Annotation', icon: 'A' },
            { name: 'simpleTag', label: 'Price Tag', icon: '🏷' },
        ],
    },
};

interface DrawingToolbarProps {
    onSelectTool: (toolName: string) => void;
    onClearOverlays: () => void;
    onToggleVisibility: (visible: boolean) => void;
    onToggleLock: (locked: boolean) => void;
    activeTool: string | null;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
    onSelectTool,
    onClearOverlays,
    onToggleVisibility,
    onToggleLock,
    activeTool,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [isMagnetActive, setIsMagnetActive] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [overlaysVisible, setOverlaysVisible] = useState(true);
    const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });

    const toolbarRef = useRef<HTMLDivElement>(null);
    const groupRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Close submenu when clicking outside or collapsing
    useEffect(() => {
        if (!isExpanded) {
            setExpandedGroup(null);
        }
    }, [isExpanded]);

    // Close submenu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                setExpandedGroup(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleGroupClick = (groupKey: string, e: React.MouseEvent) => {
        if (expandedGroup === groupKey) {
            setExpandedGroup(null);
        } else {
            // Calculate submenu position based on button position in viewport
            const button = e.currentTarget as HTMLElement;
            const buttonRect = button.getBoundingClientRect();
            const toolbarWidth = isExpanded ? 180 : 44;

            // Get toolbar position in viewport
            const toolbarRect = toolbarRef.current?.getBoundingClientRect();
            const toolbarLeft = toolbarRect?.left || 0;

            setSubmenuPosition({
                top: buttonRect.top,
                left: toolbarLeft + toolbarWidth,
            });
            setExpandedGroup(groupKey);
        }
    };

    const handleToolSelect = (toolName: string) => {
        onSelectTool(toolName);
        setExpandedGroup(null);
    };

    const handleToggleVisibility = () => {
        const newVisible = !overlaysVisible;
        setOverlaysVisible(newVisible);
        onToggleVisibility(newVisible);
    };

    const handleToggleLock = () => {
        const newLocked = !isLocked;
        setIsLocked(newLocked);
        onToggleLock(newLocked);
    };

    const handleClear = () => {
        onClearOverlays();
    };

    return (
        <div ref={toolbarRef} className={`drawing-toolbar ${isExpanded ? 'expanded' : 'collapsed'}`}>
            {/* Hamburger Toggle */}
            <button
                className="toolbar-toggle"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
            >
                {isExpanded ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Tool Groups */}
            <div className="toolbar-content">
                {Object.entries(TOOL_GROUPS).map(([key, group]) => {
                    const IconComponent = group.icon;
                    const isActive = expandedGroup === key;
                    const hasActiveTool = group.tools.some(t => t.name === activeTool);

                    return (
                        <div
                            key={key}
                            className="tool-group"
                            ref={(el) => { groupRefs.current[key] = el; }}
                        >
                            <button
                                className={`tool-btn ${hasActiveTool ? 'active' : ''}`}
                                onClick={(e) => handleGroupClick(key, e)}
                                title={group.label}
                            >
                                <IconComponent size={18} />
                                {isExpanded && (
                                    <>
                                        <span className="tool-label">{group.label}</span>
                                        <ChevronRight
                                            size={14}
                                            className={`chevron ${isActive ? 'rotated' : ''}`}
                                        />
                                    </>
                                )}
                            </button>

                            {/* Sub-menu - fixed position based on button */}
                            {isActive && (
                                <div
                                    className="tool-submenu"
                                    style={{
                                        top: submenuPosition.top,
                                        left: submenuPosition.left,
                                    }}
                                >
                                    {group.tools.map((tool) => (
                                        <button
                                            key={tool.name}
                                            className={`submenu-item ${activeTool === tool.name ? 'active' : ''}`}
                                            onClick={() => handleToolSelect(tool.name)}
                                        >
                                            <span className="tool-icon">{tool.icon}</span>
                                            <span>{tool.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Divider */}
                <div className="toolbar-divider" />

                {/* Utility Buttons */}
                <button
                    className={`tool-btn ${isMagnetActive ? 'active' : ''}`}
                    onClick={() => setIsMagnetActive(!isMagnetActive)}
                    title="Magnet (snap to price)"
                >
                    <Magnet size={18} />
                    {isExpanded && <span className="tool-label">Magnet</span>}
                </button>

                <button
                    className={`tool-btn ${isLocked ? 'active' : ''}`}
                    onClick={handleToggleLock}
                    title={isLocked ? 'Unlock overlays' : 'Lock overlays'}
                >
                    <Lock size={18} />
                    {isExpanded && <span className="tool-label">{isLocked ? 'Unlock' : 'Lock'}</span>}
                </button>

                <button
                    className={`tool-btn ${!overlaysVisible ? 'active' : ''}`}
                    onClick={handleToggleVisibility}
                    title={overlaysVisible ? 'Hide overlays' : 'Show overlays'}
                >
                    {overlaysVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                    {isExpanded && <span className="tool-label">{overlaysVisible ? 'Hide' : 'Show'}</span>}
                </button>

                <button
                    className="tool-btn danger"
                    onClick={handleClear}
                    title="Clear all overlays"
                >
                    <Trash2 size={18} />
                    {isExpanded && <span className="tool-label">Clear</span>}
                </button>
            </div>

            <style>{`
                .drawing-toolbar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    display: flex;
                    flex-direction: column;
                    background: rgba(30, 32, 36, 0.98);
                    border-right: 1px solid rgba(255, 255, 255, 0.08);
                    z-index: 100;
                    transition: width 0.2s ease;
                    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
                }
                .drawing-toolbar.collapsed {
                    width: 44px;
                }
                .drawing-toolbar.expanded {
                    width: 180px;
                }
                .toolbar-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 44px;
                    background: rgba(255, 255, 255, 0.03);
                    border: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    color: #9ca3af;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .toolbar-toggle:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: #fff;
                }
                .toolbar-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px 0;
                }
                .tool-group {
                    position: relative;
                }
                .tool-btn {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 12px;
                    background: transparent;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                    transition: all 0.15s;
                    text-align: left;
                }
                .tool-btn:hover {
                    background: rgba(59, 130, 246, 0.1);
                    color: #fff;
                }
                .tool-btn.active {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3B82F6;
                }
                .tool-btn.danger:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }
                .tool-label {
                    flex: 1;
                    font-size: 13px;
                    white-space: nowrap;
                }
                .chevron {
                    transition: transform 0.2s;
                }
                .chevron.rotated {
                    transform: rotate(90deg);
                }
                .tool-submenu {
                    position: fixed;
                    min-width: 180px;
                    background: #1e2024;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                    z-index: 10000;
                    overflow: hidden;
                }
                .submenu-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 14px;
                    background: transparent;
                    border: none;
                    color: #d1d5db;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.15s;
                    text-align: left;
                }
                .submenu-item:hover {
                    background: rgba(59, 130, 246, 0.1);
                }
                .submenu-item.active {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3B82F6;
                }
                .tool-icon {
                    width: 20px;
                    text-align: center;
                    font-size: 14px;
                }
                .toolbar-divider {
                    height: 1px;
                    background: rgba(255, 255, 255, 0.08);
                    margin: 8px 12px;
                }
            `}</style>
        </div>
    );
};

export default DrawingToolbar;
