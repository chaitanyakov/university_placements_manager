import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
  width?: string;
  defaultVisible?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T | ((item: T) => string);
  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  onRowClick?: (item: T) => void;
  rowActions?: (item: T) => React.ReactNode;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectRow?: (id: string, item: T) => void;
  onSelectAll?: (allIds: string[]) => void;
  pageSize?: number;
  exportFilename?: string;
  searchPlaceholder?: string;
  toolbarExtra?: React.ReactNode;
  rowDimmed?: (item: T) => boolean;
  rowTooltip?: (item: T) => string | undefined;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  isLoading = false,
  emptyMessage = 'No records match the current criteria.',
  emptyAction,
  onRowClick,
  rowActions,
  selectable = false,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  pageSize = 15,
  exportFilename,
  searchPlaceholder,
  toolbarExtra,
  rowDimmed,
  rowTooltip,
}: DataTableProps<T>) {
  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Column visibility
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    columns.forEach((c) => {
      if (c.defaultVisible !== false) {
        keys.add(c.key);
      }
    });
    return keys;
  });
  const [showColMenu, setShowColMenu] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const getItemId = (item: T): string => {
    if (typeof keyField === 'function') {
      return keyField(item);
    }
    return String(item[keyField] ?? '');
  };

  // Filtered & Sorted data
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    return data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      let valA = col.sortValue ? col.sortValue(a) : a[col.key];
      let valB = col.sortValue ? col.sortValue(b) : b[col.key];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sortKey, sortOrder, columns]);

  // Paginated data
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleExportCSV = () => {
    if (sortedData.length === 0) return;
    const activeCols = columns.filter((c) => visibleColumnKeys.has(c.key));
    const headers = activeCols.map((c) => c.header);
    const rows = sortedData.map((item) =>
      activeCols.map((c) => {
        let val = c.sortValue ? c.sortValue(item) : item[c.key];
        if (val === undefined || val === null) val = '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
    );

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFilename || 'export'}.csv`;
    link.click();
  };

  const allVisibleIds = paginatedData.map(getItemId);
  const isAllSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="bg-white border border-[#E4DFD3] rounded-[6px] overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      {(searchPlaceholder || exportFilename || toolbarExtra || columns.length > 4) && (
        <div className="p-3 border-b border-[#E4DFD3] bg-[#FCFBF8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
            {searchPlaceholder && (
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#6B6F6A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-[#E4DFD3] rounded-[4px] text-[#1C1F1D] focus:outline-none focus:border-[#1F4D3F] placeholder:text-[#6B6F6A]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {toolbarExtra}

            {/* Column Visibility Menu */}
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Eye className="w-3.5 h-3.5 text-[#6B6F6A]" />}
                onClick={() => setShowColMenu(!showColMenu)}
                className="text-xs"
              >
                Columns
              </Button>
              {showColMenu && (
                <div className="absolute right-0 top-9 w-48 bg-white border border-[#E4DFD3] rounded-[6px] p-2 shadow-sm z-30">
                  <div className="text-[11px] font-semibold text-[#6B6F6A] uppercase tracking-wider px-2 py-1">
                    Toggle Columns
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 py-1">
                    {columns.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-[#FAF8F3] rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumnKeys.has(col.key)}
                          onChange={() => {
                            const next = new Set(visibleColumnKeys);
                            if (next.has(col.key)) {
                              if (next.size > 1) next.delete(col.key);
                            } else {
                              next.add(col.key);
                            }
                            setVisibleColumnKeys(next);
                          }}
                          className="rounded text-[#1F4D3F] focus:ring-0"
                        />
                        <span className="truncate">{col.header}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export CSV button slot */}
            {exportFilename && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5 text-[#6B6F6A]" />}
                onClick={handleExportCSV}
                className="text-xs"
              >
                Export CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table Container with Sticky Header */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] sticky top-0 z-10 text-xs font-medium text-[#6B6F6A]">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => {
                      if (onSelectAll) {
                        onSelectAll(e.target.checked ? allVisibleIds : []);
                      }
                    }}
                    className="rounded text-[#1F4D3F] focus:ring-0 cursor-pointer"
                  />
                </th>
              )}

              {columns
                .filter((c) => visibleColumnKeys.has(c.key))
                .map((col) => {
                  const isSorted = sortKey === col.key;
                  const alignClass =
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left';

                  return (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      className={`px-4 py-2.5 uppercase tracking-[0.06em] text-[11px] font-semibold text-[#6B6F6A] select-none ${alignClass} ${
                        col.sortable ? 'cursor-pointer hover:text-[#1C1F1D]' : ''
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 ${
                          col.align === 'right' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-[#6B6F6A]">
                            {isSorted ? (
                              sortOrder === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5 text-[#1F4D3F]" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-[#1F4D3F]" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}

              {rowActions && (
                <th className="w-16 px-4 py-2.5 text-right uppercase tracking-[0.06em] text-[11px] font-semibold text-[#6B6F6A]">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E4DFD3] bg-white">
            {isLoading ? (
              // Skeleton loading rows (delta <= 2px)
              Array.from({ length: Math.min(pageSize, 6) }).map((_, idx) => (
                <tr key={`skel-${idx}`} className="h-[44px]">
                  {selectable && <td className="px-3 py-2 text-center" />}
                  {columns
                    .filter((c) => visibleColumnKeys.has(c.key))
                    .map((col) => (
                      <td key={col.key} className="px-4 py-2">
                        <div className="h-4 bg-[#F0EEE9] rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  {rowActions && <td className="px-4 py-2" />}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.filter((c) => visibleColumnKeys.has(c.key)).length +
                    (selectable ? 1 : 0) +
                    (rowActions ? 1 : 0)
                  }
                  className="py-12 text-center text-[#6B6F6A]"
                >
                  <p className="text-sm">{emptyMessage}</p>
                  {emptyAction && (
                    <div className="mt-3">
                      <Button variant="secondary" size="sm" onClick={emptyAction.onClick}>
                        {emptyAction.label}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, idx) => {
                const itemId = getItemId(item);
                const isSelected = selectedIds.includes(itemId);
                const isDimmed = rowDimmed ? rowDimmed(item) : false;
                const tooltipText = rowTooltip ? rowTooltip(item) : undefined;

                return (
                  <tr
                    key={itemId || idx}
                    onClick={() => onRowClick && onRowClick(item)}
                    title={tooltipText}
                    className={`h-[44px] transition-colors duration-120 group ${
                      isDimmed ? 'opacity-50 bg-[#FAF9F5]' : 'hover:bg-[#FAF8F3]'
                    } ${onRowClick ? 'cursor-pointer' : ''} ${
                      isSelected ? 'bg-[#F4F9F5]' : ''
                    }`}
                  >
                    {selectable && (
                      <td
                        className="px-3 py-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onSelectRow && onSelectRow(itemId, item)}
                          className="rounded text-[#1F4D3F] focus:ring-0 cursor-pointer"
                        />
                      </td>
                    )}

                    {columns
                      .filter((c) => visibleColumnKeys.has(c.key))
                      .map((col) => {
                        const alignClass =
                          col.align === 'right'
                            ? 'text-right tabular-nums'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left';

                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 text-[#1C1F1D] text-sm whitespace-nowrap ${alignClass}`}
                          >
                            {col.render ? col.render(item, startIndex + idx) : item[col.key]}
                          </td>
                        );
                      })}

                    {rowActions && (
                      <td
                        className="px-4 py-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                          {rowActions(item)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      {!isLoading && totalItems > 0 && (
        <div className="px-4 py-3 border-t border-[#E4DFD3] bg-[#FCFBF8] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B6F6A]">
          <div className="tabular-nums">
            Showing <span className="font-medium text-[#1C1F1D]">{startIndex + 1}</span>-
            <span className="font-medium text-[#1C1F1D]">
              {Math.min(startIndex + pageSize, totalItems)}
            </span>{' '}
            of <span className="font-medium text-[#1C1F1D]">{totalItems}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2 h-7"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2 py-1 text-xs tabular-nums text-[#1C1F1D]">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 h-7"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
