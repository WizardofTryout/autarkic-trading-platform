import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface TranspilationProgressProps {
    isOpen: boolean;
    onCancel?: () => void;
}

const TranspilationProgress: React.FC<TranspilationProgressProps> = ({ isOpen, onCancel }) => {
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Initializing...');

    useEffect(() => {
        if (!isOpen) {
            setProgress(0);
            setStatusMessage('Initializing...');
            return;
        }

        // Simulate progress stages
        const stages = [
            { progress: 10, message: 'Connecting to AI Engine...', duration: 300 },
            { progress: 30, message: 'Analyzing Pine Script...', duration: 500 },
            { progress: 50, message: 'Generating Python Code...', duration: 1000 },
            { progress: 75, message: 'Optimizing Code Structure...', duration: 800 },
            { progress: 90, message: 'Finalizing...', duration: 400 }
        ];

        let currentStage = 0;
        let timeout: ReturnType<typeof setTimeout>;

        const advanceStage = () => {
            if (currentStage < stages.length) {
                const stage = stages[currentStage];
                setProgress(stage.progress);
                setStatusMessage(stage.message);
                currentStage++;
                timeout = setTimeout(advanceStage, stage.duration);
            }
        };

        advanceStage();

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    <h3 className="text-xl font-bold text-white">Generating Python Code</h3>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>{statusMessage}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500 ease-out rounded-full relative overflow-hidden"
                            style={{ width: `${progress}%` }}
                        >
                            {/* Animated shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                    </div>
                </div>

                {/* Status Details */}
                <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2 text-sm text-gray-300">
                        <div className="flex-shrink-0 mt-0.5">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                            <p className="font-medium text-white mb-1">AI Transpilation in Progress</p>
                            <p className="text-xs text-gray-400">
                                Using Gemini 2.5 Flash to convert your Pine Script strategy into optimized Python code.
                                This usually takes 3-5 seconds.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Cancel Button (optional) */}
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};

export default TranspilationProgress;
