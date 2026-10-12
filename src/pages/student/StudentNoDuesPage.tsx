import React, { useMemo } from 'react';
import {
  Student,
  ClearanceCategory,
  ClearanceRecord,
  getStudentNoDuesStatus,
} from '../../services/placementNoDuesService';
import { StatusChip } from '../../components/ui/StatusChip';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/FeedbackComponents';
import { Printer, CheckCircle2, AlertTriangle, Clock, Info } from 'lucide-react';

interface StudentNoDuesPageProps {
  student: Student;
  categories: ClearanceCategory[];
  clearances: ClearanceRecord[];
  onPrintStatement: () => void;
}

export const StudentNoDuesPage: React.FC<StudentNoDuesPageProps> = ({
  student,
  categories,
  clearances,
  onPrintStatement,
}) => {
  const clearanceSummary = useMemo(() => {
    return getStudentNoDuesStatus(student.id, categories, clearances);
  }, [student, categories, clearances]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.order - b.order),
    [categories]
  );

  const pendingCount = activeCategories.length - clearanceSummary.clearedCount;
  const isCleared = clearanceSummary.status === 'Cleared';
  const isRejected = clearanceSummary.status === 'Rejected / Action Required';

  // Determine top banner text & styling
  let bannerBg = 'bg-[#FDF6E2] border-[#F3E3B5] text-[#8C5E09]';
  let bannerIcon = <Clock className="w-5 h-5 shrink-0" />;
  let bannerTitle = `No-Dues: Incomplete, ${pendingCount} items pending`;
  let bannerDesc = 'Clearance is in progress across departments. Outstanding items must be resolved prior to graduation.';

  if (isCleared) {
    bannerBg = 'bg-[#EAF3ED] border-[#CDE3D3] text-[#1E5631]';
    bannerIcon = <CheckCircle2 className="w-5 h-5 shrink-0" />;
    bannerTitle = 'No-Dues: Cleared';
    bannerDesc = 'All departmental requirements have been certified. Your official graduation statement is ready.';
  } else if (isRejected) {
    bannerBg = 'bg-[#FCECEE] border-[#F6C6CA] text-[#9E2A2B]';
    bannerIcon = <AlertTriangle className="w-5 h-5 shrink-0" />;
    bannerTitle = `Action required: ${clearanceSummary.rejectedCategories.length || 1} item rejected`;
    bannerDesc = 'Outstanding dues or fines recorded. Contact the department counter to resolve immediately.';
  }

  return (
    <div className="space-y-6">
      {/* 1. Full-width Soft Color Banner */}
      <div className={`p-4 sm:p-5 border rounded-[6px] flex items-start gap-3.5 ${bannerBg}`}>
        <div className="mt-0.5">{bannerIcon}</div>
        <div className="flex-1">
          <h2 className="font-serif text-lg font-medium leading-tight">
            {bannerTitle}
          </h2>
          <p className="text-xs mt-1 opacity-90 leading-relaxed">
            {bannerDesc}
          </p>
        </div>
        <div className="shrink-0 no-print">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={onPrintStatement}
          >
            Download / Print Statement
          </Button>
        </div>
      </div>

      {/* 2. Progress Bar */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#1C1F1D]">
            Overall Clearance Progress:
          </span>
          <span className="font-serif text-sm font-medium text-[#1C1F1D] tabular-nums">
            {clearanceSummary.clearedCount} of {clearanceSummary.totalActive} cleared
          </span>
        </div>
        <ProgressBar
          value={clearanceSummary.clearedCount}
          max={clearanceSummary.totalActive}
        />
      </Card>

      {/* 3. Pending Requirements Box (if any outstanding items) */}
      {clearanceSummary.pendingRequirements.length > 0 && (
        <Card padding="md" className="border-[#F3E3B5] bg-[#FAF8F3]">
          <h3 className="font-serif text-base font-medium text-[#1C1F1D] flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[#8C5E09]" />
            <span>Outstanding Action Items:</span>
          </h3>
          <p className="text-xs text-[#6B6F6A] mb-3">
            Please complete the following requirements with the respective campus departments:
          </p>
          <ul className="space-y-2">
            {clearanceSummary.pendingRequirements.map((req, idx) => (
              <li
                key={idx}
                className="text-xs p-2.5 bg-white border border-[#E4DFD3] rounded-[4px] text-[#1C1F1D] flex items-start gap-2"
              >
                <span className="font-bold text-[#8C5E09]">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 4. Vertical Checklist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
          <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
            Departmental Clearance Checklist
          </h3>
          <span className="text-xs text-[#6B6F6A]">
            {activeCategories.length} categories
          </span>
        </div>

        <div className="space-y-2.5">
          {activeCategories.map((cat) => {
            const rec = clearanceSummary.recordsMap.get(cat.id);
            const status = rec?.status || 'Pending';

            return (
              <div
                key={cat.id}
                className="bg-white border border-[#E4DFD3] rounded-[6px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-none"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-[#1C1F1D]">
                      {cat.name}
                    </span>
                    {cat.isMandatory && (
                      <span className="text-[10px] text-[#6B6F6A] bg-[#FAF8F3] border border-[#E4DFD3] px-1.5 py-0.2 rounded">
                        Mandatory
                      </span>
                    )}
                  </div>
                  {rec?.remarks && (
                    <p className="text-xs text-[#6B6F6A] mt-1 leading-relaxed">
                      {rec.remarks}
                    </p>
                  )}
                  {rec?.pendingRequirements && rec.pendingRequirements.length > 0 && (
                    <div className="mt-2 text-xs text-[#9E2A2B] space-y-1">
                      {rec.pendingRequirements.map((r, i) => (
                        <p key={i}>• {r}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col sm:items-end justify-between items-center gap-1 shrink-0">
                  <StatusChip status={status} />
                  <span className="text-[11px] text-[#6B6F6A] tabular-nums mt-1">
                    Updated: {rec?.updatedAt || '2026-10-10'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clear notice: Clearances are approved by the respective departments */}
      <div className="p-3 bg-[#FAF8F3] border border-[#E4DFD3] rounded-[6px] text-xs text-[#6B6F6A] flex items-center gap-2">
        <Info className="w-4 h-4 text-[#1F4D3F] shrink-0" />
        <span>
          Clearances are approved by the respective university departments. Students cannot directly submit approvals online.
        </span>
      </div>
    </div>
  );
};
