import React, { useState } from 'react';
import { Student } from '../../services/placementNoDuesService';
import { Card, SectionHeader } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FeedbackComponents';
import { Button } from '../../components/ui/Button';
import { StatusChip } from '../../components/ui/StatusChip';
import { useToast } from '../../components/ui/Toast';
import { Lock, Check } from 'lucide-react';

interface StudentProfilePageProps {
  student: Student;
}

export const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ student }) => {
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast({
      type: 'success',
      message: 'Password changed successfully.',
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <SectionHeader
        title="Student Profile"
        description="Official enrolled academic details and portal security settings."
      />

      {/* Read-Only Academic Details */}
      <Card padding="md" className="space-y-4">
        <h3 className="font-serif text-base font-medium text-[#1C1F1D] border-b border-[#E4DFD3] pb-2">
          Enrolled Academic Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Candidate Name
            </span>
            <span className="font-medium text-[#1C1F1D] text-sm mt-0.5 block">
              {student.name}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Roll Number
            </span>
            <span className="font-mono font-medium text-[#1C1F1D] text-sm mt-0.5 block">
              {student.rollNo}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              University Email
            </span>
            <span className="font-mono text-[#1C1F1D] text-sm mt-0.5 block">
              {student.email}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Contact Phone
            </span>
            <span className="text-[#1C1F1D] text-sm mt-0.5 block">
              {student.phone || '+91 98112 34500'}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Department
            </span>
            <span className="text-[#1C1F1D] text-sm mt-0.5 block">
              {student.department}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Program & Cohort
            </span>
            <span className="text-[#1C1F1D] text-sm mt-0.5 block">
              {student.program} · Batch {student.batch} (Year {student.year})
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Cumulative CGPA
            </span>
            <span className="font-serif text-lg font-medium text-[#1C1F1D] mt-0.5 block tabular-nums">
              {student.cgpa} / 10.0
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Placement Eligibility
            </span>
            <div className="mt-1">
              <StatusChip
                status={student.isEligible ? 'Eligible' : 'Not Eligible'}
                label={student.isEligible ? 'Meets criteria (0 backlogs)' : 'Disqualified'}
                size="sm"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#F0EEE9]">
          <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block mb-1.5">
            Technical Competencies / Skills:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {student.skills.map((skill) => (
              <span
                key={skill}
                className="bg-[#FAF8F3] border border-[#E4DFD3] text-[#1C1F1D] text-xs px-2.5 py-0.5 rounded"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Change Password Form */}
      <Card padding="md" className="space-y-4">
        <h3 className="font-serif text-base font-medium text-[#1C1F1D] border-b border-[#E4DFD3] pb-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#1F4D3F]" />
          <span>Security & Password Management</span>
        </h3>

        {passwordError && (
          <div className="p-3 bg-[#FCECEE] border border-[#F6C6CA] rounded text-xs text-[#9E2A2B]">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <FormField label="Current Password" required>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
            />
          </FormField>

          <FormField label="New Password" required helpText="Minimum 6 characters">
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
            />
          </FormField>

          <FormField label="Confirm New Password" required>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
            />
          </FormField>

          <Button type="submit" variant="primary" size="md">
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
};
