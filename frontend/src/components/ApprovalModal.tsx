import React from 'react';

interface ApprovalModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    action: string;
    amount: string;
    isLoading?: boolean;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onConfirm, onCancel, action, amount, isLoading = false }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-600 p-6 rounded-lg max-w-sm w-full">
                <h3 className="text-xl font-bold mb-4 text-yellow-500">⚠️ Confirm Action</h3>
                <p className="mb-4 text-gray-300">
                    Are you sure you want to <strong>{action}</strong> BTC for <strong>{amount} USDT</strong>?
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className={`flex-1 py-2 rounded text-white ${isLoading ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-2 rounded text-white font-bold flex items-center justify-center gap-2 ${isLoading ? 'bg-yellow-700 cursor-not-allowed opacity-50' : 'bg-yellow-600 hover:bg-yellow-500'}`}
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Confirm'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
