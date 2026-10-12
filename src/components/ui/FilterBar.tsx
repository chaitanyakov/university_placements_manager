import React from 'react';
import { Search, RotateCcw } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterField {
  id: string;
  label: string;
  options: FilterOption[];
  value: string;
}

interface FilterBarProps {
  fields: FilterField[];
  onFilterChange: (id: string, value: string) => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  onReset: () => void;
  className?: string;
  activeCount?: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  fields,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  onReset,
  className = '',
  activeCount,
}) => {
  // Count non-default filters
  const computedActiveCount =
    activeCount !== undefined
      ? activeCount
      : fields.filter((f) => f.value && f.value !== 'All' && f.value !== '').length +
        (searchValue && searchValue.trim().length > 0 ? 1 : 0);

  return (
    <div
      className={`bg-white border border-[#E4DFD3] rounded-[6px] p-3 flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2.5 flex-1">
        {/* Search input */}
        {onSearchChange && (
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#6B6F6A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8 pl-8 pr-3 text-xs bg-[#FAF8F3] border border-[#E4DFD3] rounded-[4px] text-[#1C1F1D] focus:bg-white focus:outline-none focus:border-[#1F4D3F] placeholder:text-[#6B6F6A]"
            />
          </div>
        )}

        {/* Filter selects */}
        {fields.map((field) => (
          <div key={field.id} className="flex items-center gap-1.5">
            <label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#6B6F6A] whitespace-nowrap">
              {field.label}:
            </label>
            <select
              value={field.value}
              onChange={(e) => onFilterChange(field.id, e.target.value)}
              className="h-8 px-2.5 text-xs bg-[#FAF8F3] hover:bg-white border border-[#E4DFD3] rounded-[4px] text-[#1C1F1D] focus:bg-white focus:outline-none focus:border-[#1F4D3F] cursor-pointer"
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Active filter count & Reset link */}
      <div className="flex items-center gap-3 shrink-0 text-xs">
        {computedActiveCount > 0 ? (
          <span className="text-[11px] font-medium text-[#1F4D3F] bg-[#EAF3ED] px-2 py-0.5 rounded-[3px] tabular-nums">
            {computedActiveCount} active {computedActiveCount === 1 ? 'filter' : 'filters'}
          </span>
        ) : (
          <span className="text-[11px] text-[#6B6F6A]">All filters clear</span>
        )}

        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs text-[#6B6F6A] hover:text-[#C2501F] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset filters</span>
        </button>
      </div>
    </div>
  );
};
