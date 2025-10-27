import React from 'react';
import { DateFilter, DateFilterOperator } from '../types';

interface FilterControlsProps {
    textFilter: string;
    setTextFilter: (value: string) => void;
    dateFilter: DateFilter;
    setDateFilter: (value: DateFilter) => void;
    createdDateFilter: DateFilter;
    setCreatedDateFilter: (value: DateFilter) => void;
    uploadStatusFilter: 'all' | 'complete' | 'partial' | 'none';
    setUploadStatusFilter: (value: 'all' | 'complete' | 'partial' | 'none') => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({ 
    textFilter, 
    setTextFilter, 
    dateFilter, 
    setDateFilter,
    createdDateFilter,
    setCreatedDateFilter,
    uploadStatusFilter,
    setUploadStatusFilter
}) => {
    const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setDateFilter({
            ...dateFilter,
            operator: e.target.value as DateFilterOperator,
        });
    };

    const handleDate1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateFilter({ ...dateFilter, date1: e.target.value });
    };
    
    const handleDate2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateFilter({ ...dateFilter, date2: e.target.value });
    };

    const handleCreatedOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCreatedDateFilter({
            ...createdDateFilter,
            operator: e.target.value as DateFilterOperator,
        });
    };

    const handleCreatedDate1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCreatedDateFilter({ ...createdDateFilter, date1: e.target.value });
    };
    
    const handleCreatedDate2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCreatedDateFilter({ ...createdDateFilter, date2: e.target.value });
    };

    const handleClearFilters = () => {
        setTextFilter('');
        setDateFilter({ operator: 'exact', date1: '', date2: '' });
        setCreatedDateFilter({ operator: 'exact', date1: '', date2: '' });
        setUploadStatusFilter('all');
    };

    return (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 gap-3">
                {/* Text Search */}
                <div>
                    <label htmlFor="text-search" className="block text-xs font-medium text-gray-700 mb-1">
                        Search
                    </label>
                    <input
                        id="text-search"
                        type="text"
                        placeholder="Search across all fields..."
                        value={textFilter}
                        onChange={(e) => setTextFilter(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                </div>
                
                {/* Upload Status Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Upload Status
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setUploadStatusFilter('all')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                                uploadStatusFilter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setUploadStatusFilter('complete')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                                uploadStatusFilter === 'complete'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            ✓ Complete
                        </button>
                        <button
                            onClick={() => setUploadStatusFilter('partial')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                                uploadStatusFilter === 'partial'
                                    ? 'bg-yellow-600 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            ⚠ Partial
                        </button>
                        <button
                            onClick={() => setUploadStatusFilter('none')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                                uploadStatusFilter === 'none'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            ✗ Not Started
                        </button>
                    </div>
                </div>
                
                {/* FSC Approval Date Filter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label htmlFor="date-operator" className="block text-xs font-medium text-gray-700 mb-1">
                            FSC Approval Date
                        </label>
                        <select
                            id="date-operator"
                            value={dateFilter.operator}
                            onChange={handleOperatorChange}
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        >
                            <option value="exact">Exactly on</option>
                            <option value="before">On or Before</option>
                            <option value="after">On or After</option>
                            <option value="between">Between</option>
                        </select>
                    </div>
                    
                    <div className={`${dateFilter.operator === 'between' ? 'md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5' : ''}`}>
                        <input
                            type="date"
                            value={dateFilter.date1}
                            onChange={handleDate1Change}
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            aria-label="FSC Approval start date"
                        />
                        {dateFilter.operator === 'between' && (
                            <input
                                type="date"
                                value={dateFilter.date2}
                                onChange={handleDate2Change}
                                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                aria-label="FSC Approval end date"
                            />
                        )}
                    </div>
                </div>

                {/* Created Date Filter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label htmlFor="created-date-operator" className="block text-xs font-medium text-gray-700 mb-1">
                            Created Date
                        </label>
                        <select
                            id="created-date-operator"
                            value={createdDateFilter.operator}
                            onChange={handleCreatedOperatorChange}
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        >
                            <option value="exact">Exactly on</option>
                            <option value="before">On or Before</option>
                            <option value="after">On or After</option>
                            <option value="between">Between</option>
                        </select>
                    </div>
                    
                    <div className={`${createdDateFilter.operator === 'between' ? 'md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5' : ''}`}>
                        <input
                            type="date"
                            value={createdDateFilter.date1}
                            onChange={handleCreatedDate1Change}
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            aria-label="Created start date"
                        />
                        {createdDateFilter.operator === 'between' && (
                            <input
                                type="date"
                                value={createdDateFilter.date2}
                                onChange={handleCreatedDate2Change}
                                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                aria-label="Created end date"
                            />
                        )}
                    </div>
                </div>

                {/* Clear Button */}
                <button
                    onClick={handleClearFilters}
                    className="w-full px-3 py-1.5 text-xs border border-transparent rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition"
                    aria-label="Clear all filters"
                >
                    Clear All Filters
                </button>
            </div>
        </div>
    );
};