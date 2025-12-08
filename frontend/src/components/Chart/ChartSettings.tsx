/**
 * ChartSettings - Einstellungen für den Chart
 * 
 * Enthält:
 * - Hintergrundfarbe Color Picker
 * - Textfarbe Color Picker (für Kontrast)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';

// Vordefinierte Hintergrundfarben (dunkel)
const bgPresetColors = [
    '#111827', // Gray-900 (Default Dark)
    '#0f172a', // Slate-900
    '#030712', // Gray-950 (Darkest)
    '#1e1b4b', // Indigo-950
    '#0c0a09', // Stone-950
    '#0a0a0a', // Neutral-950
    '#1c1917', // Stone-900
    '#171717', // Neutral-900
    '#18181b', // Zinc-900
    '#1f2937', // Gray-800
    '#27272a', // Zinc-800
    '#292524', // Stone-800
];

// Vordefinierte Textfarben (hell für dunkle Hintergründe)
const textPresetColors = [
    '#9CA3AF', // Gray-400 (Default)
    '#D1D5DB', // Gray-300
    '#E5E7EB', // Gray-200
    '#F3F4F6', // Gray-100
    '#FFFFFF', // White
    '#F9FAFB', // Gray-50
    '#6366F1', // Indigo-500 (Accent)
    '#10B981', // Emerald-500 (Green)
    '#F59E0B', // Amber-500 (Orange)
    '#EF4444', // Red-500
    '#8B5CF6', // Violet-500
    '#06B6D4', // Cyan-500
];

interface ChartSettingsProps {
    className?: string;
}

const ChartSettings: React.FC<ChartSettingsProps> = ({ className = '' }) => {
    const {
        chartBackgroundColor, setChartBackgroundColor,
        chartTextColor, setChartTextColor
    } = useTradingStore();

    const [isOpen, setIsOpen] = useState(false);
    const [customBgColor, setCustomBgColor] = useState(chartBackgroundColor);
    const [customTextColor, setCustomTextColor] = useState(chartTextColor);
    const popupRef = useRef<HTMLDivElement>(null);

    // Sync local state with store
    useEffect(() => {
        setCustomBgColor(chartBackgroundColor);
    }, [chartBackgroundColor]);

    useEffect(() => {
        setCustomTextColor(chartTextColor);
    }, [chartTextColor]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleBgColorChange = (color: string) => {
        setCustomBgColor(color);
        setChartBackgroundColor(color);
    };

    const handleTextColorChange = (color: string) => {
        setCustomTextColor(color);
        setChartTextColor(color);
    };

    const handleResetAll = () => {
        handleBgColorChange('#111827');
        handleTextColorChange('#9CA3AF');
    };

    return (
        <div className={`relative ${className}`}>
            {/* Settings Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Chart Settings"
            >
                <Settings className="w-4 h-4" />
            </button>

            {/* Settings Popup */}
            {isOpen && (
                <div
                    ref={popupRef}
                    className="absolute right-0 top-full mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-4 max-h-[80vh] overflow-y-auto"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">Chart Settings</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Background Color Section */}
                    <div className="mb-5">
                        <label className="block text-xs text-gray-400 mb-2 font-medium">
                            🎨 Background Color
                        </label>

                        {/* Custom Color Picker */}
                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="color"
                                value={customBgColor}
                                onChange={(e) => handleBgColorChange(e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer border-2 border-gray-600"
                            />
                            <input
                                type="text"
                                value={customBgColor}
                                onChange={(e) => handleBgColorChange(e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                                placeholder="#111827"
                            />
                        </div>

                        {/* Preset Colors */}
                        <div className="grid grid-cols-6 gap-2">
                            {bgPresetColors.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => handleBgColorChange(color)}
                                    className={`w-8 h-8 rounded border-2 transition-all ${chartBackgroundColor === color
                                            ? 'border-blue-500 scale-110'
                                            : 'border-gray-600 hover:border-gray-400'
                                        }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Text Color Section */}
                    <div className="mb-4">
                        <label className="block text-xs text-gray-400 mb-2 font-medium">
                            ✏️ Text Color
                        </label>

                        {/* Custom Color Picker */}
                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="color"
                                value={customTextColor}
                                onChange={(e) => handleTextColorChange(e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer border-2 border-gray-600"
                            />
                            <input
                                type="text"
                                value={customTextColor}
                                onChange={(e) => handleTextColorChange(e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm font-mono"
                                style={{ color: customTextColor }}
                                placeholder="#9CA3AF"
                            />
                        </div>

                        {/* Preset Colors */}
                        <div className="grid grid-cols-6 gap-2">
                            {textPresetColors.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => handleTextColorChange(color)}
                                    className={`w-8 h-8 rounded border-2 transition-all ${chartTextColor === color
                                            ? 'border-blue-500 scale-110'
                                            : 'border-gray-600 hover:border-gray-400'
                                        }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div
                        className="p-3 rounded-lg mb-4 text-center text-sm"
                        style={{
                            backgroundColor: chartBackgroundColor,
                            color: chartTextColor,
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        Preview: BTC 89,950.45 ▲ +2.3%
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={handleResetAll}
                        className="w-full py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors border border-gray-600"
                    >
                        Reset to Defaults
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChartSettings;
