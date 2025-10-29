import React from 'react';
import { DateFilter, DateFilterOperator } from '../types';

interface FilterControlsProps {
    textFilter: string;
    setTextFilter: (value: string) => void;
    dateFilter: DateFilter;
    setDateFilter: (value: DateFilter) => void;
    createdDateFilter: DateFilter;
    setCreatedDateFilter: (value: DateFilter) => void;
    smartFilter: 'all' | 'missing-po' | 'missing-so' | 'missing-supplier-inv' | 'missing-customer-inv' | 'complete' | 'incomplete';
    setSmartFilter: (value: 'all' | 'missing-po' | 'missing-so' | 'missing-supplier-inv' | 'missing-customer-inv' | 'complete' | 'incomplete') => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({ 
    textFilter, 
    setTextFilter, 
    dateFilter, 
    setDateFilter,
    createdDateFilter,
    setCreatedDateFilter,
    smartFilter,
    setSmartFilter
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
        setSmartFilter('all');
    };

    return (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 gap-4">
                {/* Smart Filters - Quick Actions */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        🎯 Smart Filters - Quick Actions
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSmartFilter('all')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                smartFilter === 'all'
                                    ? 'bg-gray-700 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            All Batches
                        </button>
                        <button
                            onClick={() => setSmartFilter('complete')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                smartFilter === 'complete'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-green-700 border border-green-300 hover:bg-green-50'
                            }`}
                        >
                            ✓ Complete Batches
                        </button>
                        <button
                            onClick={() => setSmartFilter('incomplete')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                smartFilter === 'incomplete'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-white text-orange-700 border border-orange-300 hover:bg-orange-50'
                            }`}
                        >
                            ⚠ Incomplete Batches
                        </button>
                        <button
                            onClick={() => setSmartFilter('missing-po')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                smartFilter === 'missing-po'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
                            }`}
                        >
                            Missing PO
                        </button>
                        <button
                            onClick={() => setSmartFilter('missing-so')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                smartFilter === 'missing-so'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
                            }`}
                        >
                            Missing SO
                        </button>
                        <button
                            onClick={() => setSmartFilter('missing-supplier-inv')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                smartFilter === 'missing-supplier-inv'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
                            }`}
                        >
                            Missing Supplier Invoice
                        </button>
                        <button
                            onClick={() => setSmartFilter('missing-customer-inv')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                smartFilter === 'missing-customer-inv'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
                            }`}
                        >
                            Missing Customer Invoice
                        </button>
                    </div>
                </div>

                {/* Text Search */}
                <div>
                    <label htmlFor="text-search" className="block text-sm font-medium text-gray-700">
                        Search
                    </label>
                    <input
                        id="text-search"
                        type="text"
                        placeholder="Search across all fields..."
                        value={textFilter}
                        onChange={(e) => setTextFilter(e.target.value)}
                        className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                </div>
                
                {/* FSC Approval Date Filter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="date-operator" className="block text-sm font-medium text-gray-700">
                            FSC Approval Date
                        </label>
                        <select
                            id="date-operator"
                            value={dateFilter.operator}
                            onChange={handleOperatorChange}
                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        >
                            <option value="exact">Exactly on</option>
                            <option value="before">On or Before</option>
                            <option value="after">On or After</option>
                            <option value="between">Between</option>
                        </select>
                    </div>
                    
                    <div className={`${dateFilter.operator === 'between' ? 'md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2' : ''}`}>
                        <input
                            type="date"
                            value={dateFilter.date1}
                            onChange={handleDate1Change}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            aria-label="FSC Approval start date"
                        />
                        {dateFilter.operator === 'between' && (
                            <input
                                type="date"
                                value={dateFilter.date2}
                                onChange={handleDate2Change}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                aria-label="FSC Approval end date"
                            />
                        )}
                    </div>
                </div>

                {/* Created Date Filter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="created-date-operator" className="block text-sm font-medium text-gray-700">
                            Created Date
                        </label>
                        <select
                            id="created-date-operator"
                            value={createdDateFilter.operator}
                            onChange={handleCreatedOperatorChange}
                            className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        >
                            <option value="exact">Exactly on</option>
                            <option value="before">On or Before</option>
                            <option value="after">On or After</option>
                            <option value="between">Between</option>
                        </select>
                    </div>
                    
                    <div className={`${createdDateFilter.operator === 'between' ? 'md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2' : ''}`}>
                        <input
                            type="date"
                            value={createdDateFilter.date1}
                            onChange={handleCreatedDate1Change}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            aria-label="Created start date"
                        />
                        {createdDateFilter.operator === 'between' && (
                            <input
                                type="date"
                                value={createdDateFilter.date2}
                                onChange={handleCreatedDate2Change}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                aria-label="Created end date"
                            />
                        )}
                    </div>
                </div>

                {/* Clear Button */}
                <button
                    onClick={handleClearFilters}
                    className="w-full px-4 py-2 border border-transparent rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition"
                    aria-label="Clear all filters"
                >
                    Clear All Filters
                </button>
            </div>
        </div>
    );
};