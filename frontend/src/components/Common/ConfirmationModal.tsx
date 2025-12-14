import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'warning' | 'info' | 'danger';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    type = 'warning'
}) => {
    if (!isOpen) return null;

    const colors = {
        warning: 'text-yellow-400',
        info: 'text-blue-400',
        danger: 'text-red-400'
    };

    const confirmColors = {
        warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
        info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl w-full max-w-md transform transition-all scale-100">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full bg-gray-700/50 flex-shrink-0 ${colors[type]}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-2">
                                {title}
                            </h3>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 bg-gray-900/50 rounded-b-lg border-t border-gray-700">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors flex items-center gap-2"
                    >
                        <X size={16} />
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${confirmColors[type]}`}
                    >
                        <Check size={16} />
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
