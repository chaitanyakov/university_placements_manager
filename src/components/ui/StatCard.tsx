import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  caption?: string;
  delta?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  onClick?: () => void;
  className?: string;
  highlight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  caption,
  delta,
  onClick,
  className = '',
  highlight = false,
}) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`bg-white border rounded-[6px] p-4 sm:p-5 flex flex-col justify-between transition-colors duration-120 select-none ${
        highlight ? 'border-[#1F4D3F] bg-[#FAF8F3]' : 'border-[#E4DFD3]'
      } ${
        isClickable
          ? 'cursor-pointer hover:border-[#1F4D3F] hover:bg-[#FAF8F3] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2501F]'
          : ''
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#6B6F6A] block truncate">
            {label}
          </span>
          {isClickable && (
            <ArrowUpRight className="w-3.5 h-3.5 text-[#6B6F6A] group-hover:text-[#1F4D3F] transition-colors shrink-0" />
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#1C1F1D] tabular-nums">
            {value}
          </span>
          {delta && (
            <span
              className={`inline-flex items-center text-xs font-medium tabular-nums ${
                delta.isPositive !== false ? 'text-[#1E5631]' : 'text-[#9E2A2B]'
              }`}
            >
              {delta.isPositive !== false ? (
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-0.5" />
              )}
              {delta.value}
            </span>
          )}
        </div>
      </div>

      {caption && (
        <p className="mt-2.5 text-xs text-[#6B6F6A] leading-relaxed border-t border-[#F2EFE9] pt-2">
          {caption}
        </p>
      )}
    </div>
  );
};
