import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  ...props
}) => {
  let p = 'p-5';
  if (padding === 'none') p = 'p-0';
  if (padding === 'sm') p = 'p-3.5';
  if (padding === 'lg') p = 'p-6';

  return (
    <div
      className={`bg-white border border-[#E4DFD3] rounded-[6px] shadow-none ${p} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
  badge,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E4DFD3] ${className}`}>
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#1C1F1D]">
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[#6B6F6A] mt-0.5 leading-normal">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
};
