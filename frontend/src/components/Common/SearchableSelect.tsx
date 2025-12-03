import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface Option {
    id: string;
    label: string;
    subLabel?: string; // Optional secondary text (e.g. price)
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    className = "",
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter options
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
    );

    const selectedOption = options.find(opt => opt.id === value);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div
                className={`flex items-center justify-between bg-gray-900 border border-gray-600 rounded px-3 py-2 cursor-pointer hover:bg-gray-800 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={`text-sm ${selectedOption ? 'text-white' : 'text-gray-400'} truncate`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-xl z-50 max-h-64 flex flex-col">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-md">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                className="w-full bg-gray-900 text-white pl-8 pr-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500 border border-gray-700"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-center text-gray-500 text-sm">No results found</div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.id}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 transition-colors flex justify-between items-center ${opt.id === value ? 'bg-blue-900/30 text-blue-400' : 'text-gray-300'}`}
                                    onClick={() => {
                                        onChange(opt.id);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                >
                                    <span>{opt.label}</span>
                                    {opt.subLabel && (
                                        <span className="text-xs text-gray-500 ml-2">{opt.subLabel}</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
