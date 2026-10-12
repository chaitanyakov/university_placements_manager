import React, { useState } from 'react';
import { Printer, Upload, Check } from 'lucide-react';
import { Button } from './Button';

// -------------------------------------------------------------
// PROGRESS BAR (thin, 4px, green)
// -------------------------------------------------------------
export const ProgressBar: React.FC<{
  value: number; // 0 - 100
  max?: number;
  className?: string;
  showLabel?: boolean;
}> = ({ value, max = 100, className = '', showLabel = false }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs text-[#6B6F6A] mb-1 tabular-nums">
          <span>{Math.round(percentage)}% complete</span>
          <span>
            {value} / {max}
          </span>
        </div>
      )}
      <div className="h-1 w-full bg-[#E4DFD3] rounded-[2px] overflow-hidden">
        <div
          className="h-full bg-[#1F4D3F] transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// TABS (underline style)
// -------------------------------------------------------------
export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export const Tabs: React.FC<{
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`flex border-b border-[#E4DFD3] overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 -mb-px ${
              isActive
                ? 'border-[#1F4D3F] text-[#1F4D3F] font-semibold'
                : 'border-transparent text-[#6B6F6A] hover:text-[#1C1F1D] hover:border-[#DDD8CE]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-[3px] tabular-nums ${
                  isActive ? 'bg-[#EAF3ED] text-[#1E5631]' : 'bg-[#FAF8F3] text-[#6B6F6A]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// -------------------------------------------------------------
// STEPPER (simple numbered text with a line)
// -------------------------------------------------------------
export const Stepper: React.FC<{
  steps: string[];
  currentStep: number; // 1-indexed
  onStepClick?: (step: number) => void;
  className?: string;
}> = ({ steps, currentStep, onStepClick, className = '' }) => {
  return (
    <div className={`flex items-center w-full max-w-xl mx-auto ${className}`}>
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <React.Fragment key={label}>
            <div
              onClick={() => onStepClick && isCompleted && onStepClick(stepNum)}
              className={`flex items-center gap-2 select-none ${
                isCompleted && onStepClick ? 'cursor-pointer' : ''
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium tabular-nums border ${
                  isCompleted
                    ? 'bg-[#1F4D3F] text-white border-[#1F4D3F]'
                    : isCurrent
                    ? 'bg-white text-[#1F4D3F] border-[#1F4D3F] ring-2 ring-[#1F4D3F]/20'
                    : 'bg-white text-[#6B6F6A] border-[#E4DFD3]'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2]" /> : stepNum}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCurrent ? 'text-[#1C1F1D] font-semibold' : 'text-[#6B6F6A]'
                }`}
              >
                {label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-4 ${
                  stepNum < currentStep ? 'bg-[#1F4D3F]' : 'bg-[#E4DFD3]'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// -------------------------------------------------------------
// TOOLTIP
// -------------------------------------------------------------
export const Tooltip: React.FC<{
  content: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ content, children, className = '' }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 text-xs text-white bg-[#1C1F1D] rounded-[4px] shadow-md z-30 whitespace-nowrap pointer-events-none">
          {content}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// EMPTY STATE (one plain sentence + one action button, no illustration)
// -------------------------------------------------------------
export const EmptyState: React.FC<{
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({ message, actionLabel, onAction, className = '' }) => {
  return (
    <div
      className={`p-10 border border-[#E4DFD3] rounded-[6px] bg-white text-center flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <p className="text-sm text-[#6B6F6A] max-w-md">{message}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// SKELETON (flat grey blocks)
// -------------------------------------------------------------
export const Skeleton: React.FC<{
  className?: string;
  width?: string;
  height?: string;
}> = ({ className = '', width = 'w-full', height = 'h-4' }) => {
  return (
    <div className={`bg-[#EAE6DD] rounded animate-pulse ${width} ${height} ${className}`} />
  );
};

// -------------------------------------------------------------
// FORM FIELD (label above, inline red error below, required asterisk)
// -------------------------------------------------------------
export const FormField: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, required = false, error, helpText, children, className = '' }) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-[#9E2A2B] font-bold">*</span>}
      </label>
      {children}
      {error && <span className="text-xs text-[#9E2A2B] font-medium">{error}</span>}
      {!error && helpText && <span className="text-xs text-[#6B6F6A]">{helpText}</span>}
    </div>
  );
};

// -------------------------------------------------------------
// BREADCRUMB
// -------------------------------------------------------------
export const Breadcrumb: React.FC<{
  items: Array<{ label: string; onClick?: () => void }>;
  className?: string;
}> = ({ items, className = '' }) => {
  return (
    <nav className={`flex items-center gap-1.5 text-xs text-[#6B6F6A] ${className}`}>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-[#6B6F6A]">/</span>}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="hover:text-[#1F4D3F] hover:underline cursor-pointer transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className={idx === items.length - 1 ? 'text-[#1C1F1D] font-medium' : ''}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// -------------------------------------------------------------
// PAGE HEADER with a "Print" button where relevant
// -------------------------------------------------------------
export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  breadcrumbItems?: Array<{ label: string; onClick?: () => void }>;
  onPrint?: () => void;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, breadcrumbItems, onPrint, actions, className = '' }) => {
  return (
    <div className={`pb-4 border-b border-[#E4DFD3] flex flex-col gap-2 ${className}`}>
      {breadcrumbItems && <Breadcrumb items={breadcrumbItems} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#1C1F1D]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#6B6F6A] mt-0.5 leading-normal">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0 no-print">
          {onPrint && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Printer className="w-4 h-4 text-[#6B6F6A]" />}
              onClick={onPrint}
            >
              Print
            </Button>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// FILE DROPZONE
// -------------------------------------------------------------
export const FileDropzone: React.FC<{
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
}> = ({ onFileSelect, accept = '.csv,.xlsx', className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-[6px] p-8 text-center transition-colors cursor-pointer ${
        isDragging
          ? 'border-[#1F4D3F] bg-[#EAF3ED]/30'
          : 'border-[#E4DFD3] hover:border-[#1F4D3F] bg-white'
      } ${className}`}
    >
      <input
        type="file"
        id="file-dropzone-input"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <label htmlFor="file-dropzone-input" className="cursor-pointer block">
        <Upload className="w-8 h-8 text-[#1F4D3F] mx-auto mb-3 stroke-[1.5]" />
        <p className="text-sm font-medium text-[#1C1F1D]">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-[#6B6F6A] mt-1">
          Supported file formats: CSV, XLSX (maximum 10MB)
        </p>
      </label>
    </div>
  );
};
