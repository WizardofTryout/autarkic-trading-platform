import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface AlertModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    title = 'Alert',
    message,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                    {message}
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-sm transition-colors shadow-lg"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
