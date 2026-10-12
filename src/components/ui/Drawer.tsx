import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let widthClass = 'max-w-lg';
  if (width === 'md') widthClass = 'max-w-md';
  if (width === 'xl') widthClass = 'max-w-xl';
  if (width === '2xl') widthClass = 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1F1D]/40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div
          role="dialog"
          aria-modal="true"
          className={`w-screen ${widthClass} bg-white border-l border-[#E4DFD3] shadow-xl flex flex-col`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium text-[#1C1F1D]">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-[#6B6F6A] mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[4px] text-[#6B6F6A] hover:text-[#1C1F1D] hover:bg-[#FAF8F3] transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 px-6 py-5 overflow-y-auto">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-end gap-2.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
