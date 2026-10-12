import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Forbidden403Props {
  onGoToDashboard: () => void;
}

export const Forbidden403: React.FC<Forbidden403Props> = ({ onGoToDashboard }) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
      <div className="bg-white border border-[#E4DFD3] rounded-[6px] p-8 sm:p-10 max-w-md w-full">
        <div className="w-12 h-12 bg-[#FCECEE] text-[#9E2A2B] rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h1 className="font-serif text-2xl font-medium text-[#1C1F1D]">
          403: You don't have access to this page
        </h1>
        <p className="text-xs sm:text-sm text-[#6B6F6A] mt-2 mb-6 leading-relaxed">
          This section is restricted to the University Placement In-Charge and department administrators.
        </p>
        <Button variant="primary" size="md" onClick={onGoToDashboard} className="w-full">
          Go to my dashboard
        </Button>
      </div>
    </div>
  );
};
