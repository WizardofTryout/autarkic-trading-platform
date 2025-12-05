import React, { useState, useEffect } from 'react';
import { Search, FileText, Folder, Trash2, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { getDocuments, deleteDocument, type DocumentResponse } from '../../services/api';

interface DocumentExplorerProps {
    onLoadDocument: (doc: DocumentResponse) => void;
    refreshTrigger?: number;
}

const DocumentExplorer: React.FC<DocumentExplorerProps> = ({ onLoadDocument, refreshTrigger = 0 }) => {
    const [documents, setDocuments] = useState<DocumentResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['General']));

    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; docId: string | null; docTitle: string }>({
        isOpen: false,
        docId: null,
        docTitle: ''
    });

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const docs = await getDocuments();
            setDocuments(docs);
        } catch (error) {
            console.error("Failed to fetch documents:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [refreshTrigger]);

    const initiateDelete = (e: React.MouseEvent, doc: DocumentResponse) => {
        e.stopPropagation();
        setDeleteConfirmation({
            isOpen: true,
            docId: doc.id,
            docTitle: doc.title
        });
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation.docId) return;

        try {
            await deleteDocument(deleteConfirmation.docId);
            setDocuments(prev => prev.filter(d => d.id !== deleteConfirmation.docId));
            setDeleteConfirmation({ isOpen: false, docId: null, docTitle: '' });
        } catch (error) {
            console.error("Failed to delete document:", error);
            alert("Failed to delete document"); // Keep fallback or use NotificationModal if available
        }
    };

    const cancelDelete = () => {
        setDeleteConfirmation({ isOpen: false, docId: null, docTitle: '' });
    };

    const toggleFolder = (folder: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folder)) {
                newSet.delete(folder);
            } else {
                newSet.add(folder);
            }
            return newSet;
        });
    };

    // Group documents by folder
    const groupedDocs = documents.reduce((acc, doc) => {
        const folder = doc.folder || 'Uncategorized';
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push(doc);
        return acc;
    }, {} as Record<string, DocumentResponse[]>);

    // Filter by search
    const filteredGroups = Object.entries(groupedDocs).reduce((acc, [folder, docs]) => {
        const filtered = docs.filter(d =>
            d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        if (filtered.length > 0) {
            acc[folder] = filtered;
        }
        return acc;
    }, {} as Record<string, DocumentResponse[]>);

    return (
        <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800 w-full relative">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Documents</h2>
                <button
                    onClick={fetchDocuments}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search reports..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 text-white pl-9 pr-4 py-2 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
                    />
                </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto p-2">
                {Object.keys(filteredGroups).length === 0 ? (
                    <div className="text-center text-gray-500 mt-8 text-sm">
                        {searchTerm ? 'No matching documents found' : 'No saved documents yet'}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {Object.entries(filteredGroups).map(([folder, docs]) => (
                            <div key={folder} className="mb-2">
                                {/* Folder Header */}
                                <button
                                    onClick={() => toggleFolder(folder)}
                                    className="w-full flex items-center p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors text-sm font-medium"
                                >
                                    {expandedFolders.has(folder) ? (
                                        <ChevronDown size={14} className="mr-2" />
                                    ) : (
                                        <ChevronRight size={14} className="mr-2" />
                                    )}
                                    <Folder size={14} className="mr-2 text-yellow-500" />
                                    {folder}
                                    <span className="ml-auto text-xs text-gray-500">{docs.length}</span>
                                </button>

                                {/* Documents in Folder */}
                                {expandedFolders.has(folder) && (
                                    <div className="ml-4 pl-2 border-l border-gray-800 mt-1 space-y-1">
                                        {docs.map(doc => (
                                            <div
                                                key={doc.id}
                                                onClick={() => onLoadDocument(doc)}
                                                className="group flex items-center justify-between p-2 rounded-md hover:bg-gray-800 cursor-pointer transition-colors"
                                            >
                                                <div className="flex items-center min-w-0">
                                                    <FileText size={14} className="text-blue-400 mr-2 flex-shrink-0" />
                                                    <div className="truncate">
                                                        <div className="text-sm text-gray-300 group-hover:text-white truncate">
                                                            {doc.title}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {new Date(doc.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => initiateDelete(e, doc)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Custom Delete Confirmation Modal */}
            {deleteConfirmation.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-700">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Trash2 size={18} className="text-red-400" />
                                Delete Document?
                            </h3>
                        </div>
                        <div className="p-4">
                            <p className="text-gray-300 text-sm">
                                Are you sure you want to delete <strong>"{deleteConfirmation.docTitle}"</strong>? This action cannot be undone.
                            </p>
                        </div>
                        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={cancelDelete}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-red-900/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentExplorer;
