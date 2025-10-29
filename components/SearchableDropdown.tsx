import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface SearchableDropdownOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchableDropdownProps {
  options: SearchableDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  enableQuickSearch?: boolean;
  className?: string;
  label?: string;
  noResultsMessage?: string;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Quick Search...',
  enableQuickSearch = true,
  className = '',
  label,
  noResultsMessage = 'No results found'
}) => {
  // Validate and sanitize options
  const validOptions = options.filter(opt => opt && opt.value !== undefined && opt.value !== null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLUListElement>(null);

  // Filter options based on search query
  const filteredOptions = searchQuery.trim()
    ? validOptions.filter(opt => {
        // Defensive checks - ensure all fields are strings
        const label = String(opt.label || '');
        const value = String(opt.value || '');
        const subtitle = opt.subtitle ? String(opt.subtitle) : '';
        const query = searchQuery.toLowerCase();
        
        return (
          label.toLowerCase().includes(query) ||
          value.toLowerCase().includes(query) ||
          (subtitle && subtitle.toLowerCase().includes(query))
        );
      })
    : validOptions;

  // Find the selected option's label
  const selectedOption = validOptions.find(opt => opt.value === value);
  const displayValue = selectedOption?.label || placeholder;

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && enableQuickSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, enableQuickSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
        break;
      
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[focusedIndex].value);
        }
        break;
      
      case 'Tab':
        // If dropdown is open and search is not focused, focus search
        if (enableQuickSearch && document.activeElement !== searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current?.focus();
          setFocusedIndex(-1);
        }
        break;
    }
  };

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && optionsListRef.current) {
      const focusedElement = optionsListRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setSearchQuery('');
    setFocusedIndex(-1);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setSearchQuery('');
      setFocusedIndex(-1);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {label && (
        <label className="text-xs font-medium text-gray-700 block mb-1">
          {label}
        </label>
      )}
      
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 text-sm text-left border border-yellow-300 rounded focus:ring-yellow-500 focus:border-yellow-500 bg-white flex items-center justify-between hover:bg-gray-50 transition"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-900'}`}>
          {displayValue}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 flex flex-col">
          {/* Embedded Quick Search - FIRST ITEM */}
          {enableQuickSearch && (
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setFocusedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 mt-1 px-1">
                  {filteredOptions.length} of {validOptions.length} results
                </p>
              )}
            </div>
          )}

          {/* Options List */}
          <ul
            ref={optionsListRef}
            role="listbox"
            className="overflow-y-auto py-1 max-h-64"
            onKeyDown={handleKeyDown}
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">
                {noResultsMessage}
              </li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`
                    px-3 py-2 text-sm cursor-pointer transition
                    ${option.value === value ? 'bg-yellow-50 text-yellow-900 font-medium' : 'text-gray-900'}
                    ${focusedIndex === index ? 'bg-yellow-100' : 'hover:bg-gray-100'}
                  `}
                >
                  <div className="flex flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.subtitle && (
                      <span className="text-xs text-gray-500 truncate mt-0.5">
                        {option.subtitle}
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
