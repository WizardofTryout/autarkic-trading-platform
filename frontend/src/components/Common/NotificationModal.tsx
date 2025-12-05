import React from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface NotificationModalProps {
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
    onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
    isOpen,
    type,
    title,
    message,
    onClose
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl w-96 transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className={`text-lg font-semibold flex items-center gap-2 ${type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-gray-300 text-sm leading-relaxed">
                        {message}
                    </p>
                </div>
                <div className="p-4 border-t border-gray-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
