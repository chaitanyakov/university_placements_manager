import React, { useState } from 'react';
import { Card, SectionHeader } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FeedbackComponents';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { RotateCcw, ShieldCheck, Database, School } from 'lucide-react';

interface SettingsPageProps {
  onResetDemoData: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onResetDemoData }) => {
  const { showToast } = useToast();
  const [univName, setUnivName] = useState('HireSight');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [activeBatch, setActiveBatch] = useState('2025');
  const [contactEmail, setContactEmail] = useState('placement.officer@apex.edu');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showToast({
      type: 'success',
      message: 'Institutional settings saved.',
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <SectionHeader
        title="Portal Administration & Settings"
        description="Institutional configurations, graduation session parameters, and database controls."
      />

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <Card padding="md" className="space-y-4">
          <h3 className="font-serif text-base font-medium text-[#1C1F1D] border-b border-[#E4DFD3] pb-2 flex items-center gap-2">
            <School className="w-4 h-4 text-[#1F4D3F]" />
            <span>Institutional Identity & Academic Term</span>
          </h3>

          <FormField label="University Full Title" required>
            <input
              type="text"
              value={univName}
              onChange={(e) => setUnivName(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Current Academic Session">
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Primary Graduating Batch">
              <input
                type="text"
                value={activeBatch}
                onChange={(e) => setActiveBatch(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>
          </div>

          <FormField label="Placement Office Official Contact Email">
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
            />
          </FormField>

          <div className="pt-2">
            <Button type="submit" variant="primary" size="sm">
              Save Institutional Settings
            </Button>
          </div>
        </Card>
      </form>

      {/* Database Reset & Demo Data Controls */}
      <Card padding="md" className="space-y-4 border-[#F6C6CA]">
        <h3 className="font-serif text-base font-medium text-[#9E2A2B] border-b border-[#F6C6CA] pb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#9E2A2B]" />
          <span>Demo Data & Environment Reset</span>
        </h3>

        <p className="text-xs text-[#6B6F6A] leading-relaxed">
          Reset all students, drives, applications, and clearance records back to the default certified seed data. Useful for resetting test runs.
        </p>

        <Button
          variant="destructive"
          size="sm"
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={() => setIsResetConfirmOpen(true)}
        >
          Reset to Factory Demo Data
        </Button>
      </Card>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          onResetDemoData();
          setIsResetConfirmOpen(false);
          showToast({
            type: 'info',
            message: 'Portal database reset to default demo dataset.',
          });
        }}
        title="Reset All Portal Data?"
        consequences="All imported students, updated applications, custom drives, and clearance notes will be replaced with initial default university records."
        confirmLabel="Reset Everything"
        isDestructive={true}
      />
    </div>
  );
};
