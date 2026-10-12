import React, { useState, useMemo } from 'react';
import {
  Student,
  ClearanceCategory,
  ClearanceRecord,
  getStudentNoDuesStatus,
} from '../../services/placementNoDuesService';
import { StatusChip } from '../../components/ui/StatusChip';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/FeedbackComponents';
import { Printer, Search, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

interface StatementsPageProps {
  students: Student[];
  categories: ClearanceCategory[];
  clearances: ClearanceRecord[];
  initialStudentId?: string | null;
}

export const StatementsPage: React.FC<StatementsPageProps> = ({
  students,
  categories,
  clearances,
  initialStudentId,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ''
  );
  const [searchStudentTerm, setSearchStudentTerm] = useState('');

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0],
    [students, selectedStudentId]
  );

  const clearanceSummary = useMemo(() => {
    if (!selectedStudent) return null;
    return getStudentNoDuesStatus(selectedStudent.id, categories, clearances);
  }, [selectedStudent, categories, clearances]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.order - b.order),
    [categories]
  );

  const filteredStudents = useMemo(() => {
    if (!searchStudentTerm.trim()) return students;
    const q = searchStudentTerm.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [students, searchStudentTerm]);

  const handlePrint = () => {
    window.print();
  };

  const isCleared = clearanceSummary?.status === 'Cleared';
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Page Header (Hidden on Print) */}
      <div className="no-print">
        <PageHeader
          title="No-Dues Statements"
          subtitle="Generate, preview, and print verifiable institutional graduation clearance certificates."
          onPrint={handlePrint}
        />
      </div>

      {/* Student Selector Toolbar (Hidden on Print) */}
      <div className="bg-white border border-[#E4DFD3] rounded-[6px] p-4 no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <label className="text-[11px] uppercase font-semibold tracking-wider text-[#6B6F6A] block mb-1">
            Select Student:
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B6F6A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedStudent?.id}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-xs bg-[#FAF8F3] hover:bg-white border border-[#E4DFD3] rounded text-[#1C1F1D] focus:outline-none focus:border-[#1F4D3F] cursor-pointer"
            >
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rollNo} — {s.name} ({s.department}) · Batch {s.batch}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print / Download PDF
          </Button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* OFFICIAL PRINTABLE NO-DUES STATEMENT SHEET (A4 Editorial Style) */}
      {/* ============================================================= */}
      {selectedStudent && clearanceSummary && (
        <div className="bg-white border border-[#E4DFD3] rounded-[6px] p-8 sm:p-12 max-w-4xl mx-auto shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:shadow-none print-page">
          {/* Institutional Letterhead */}
          <div className="border-b-2 border-[#1C1F1D] pb-5 mb-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#6B6F6A] mb-1">
              Apex Institute of Science & Technology
            </p>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-[#1C1F1D]">
              Apex University
            </h1>
            <p className="text-xs text-[#6B6F6A] mt-1">
              Office of Placement & Departmental Clearances · Deemed-to-be University
            </p>
            <div className="inline-block mt-3 px-3 py-1 bg-[#FAF8F3] border border-[#E4DFD3] text-xs font-serif font-medium uppercase tracking-widest text-[#1C1F1D]">
              Official No-Dues Clearance Statement
            </div>
          </div>

          {/* Incomplete Banner if not fully cleared */}
          {!isCleared && (
            <div className="mb-6 p-4 bg-[#FCECEE] border border-[#F6C6CA] rounded-[4px] text-xs text-[#9E2A2B]">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>INCOMPLETE CLEARANCE — PROVISIONAL CERTIFICATE</span>
              </div>
              <p className="mt-1 leading-relaxed">
                This document is a provisional record. Graduation clearance is incomplete due to outstanding department requirements.
              </p>
              {clearanceSummary.pendingRequirements.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#F6C6CA]/60 space-y-1">
                  <span className="font-semibold uppercase text-[10px] tracking-wider block">
                    Outstanding Items:
                  </span>
                  {clearanceSummary.pendingRequirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span>•</span>
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isCleared && (
            <div className="mb-6 p-3.5 bg-[#EAF3ED] border border-[#CDE3D3] rounded-[4px] text-xs text-[#1E5631] flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                All institutional departments and facilities have certified zero dues for this candidate.
              </span>
            </div>
          )}

          {/* Student Candidate Details Block */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-[#FAF8F3] border border-[#E4DFD3] rounded-[4px] text-xs mb-6">
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                Roll Number
              </span>
              <span className="font-mono font-bold text-sm text-[#1C1F1D]">
                {selectedStudent.rollNo}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                Candidate Name
              </span>
              <span className="font-medium text-sm text-[#1C1F1D]">
                {selectedStudent.name}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                Graduation Batch
              </span>
              <span className="font-medium text-sm text-[#1C1F1D]">
                Batch {selectedStudent.batch}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                Academic Program
              </span>
              <span className="font-medium text-[#1C1F1D]">
                {selectedStudent.program} · Year {selectedStudent.year}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                Department
              </span>
              <span className="font-medium text-[#1C1F1D]">
                {selectedStudent.department}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                Statement Date
              </span>
              <span className="font-medium text-[#1C1F1D] tabular-nums">
                {currentDate}
              </span>
            </div>
          </div>

          {/* Bordered Clearance Table */}
          <div className="border border-[#E4DFD3] rounded-[4px] overflow-hidden mb-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold w-12 text-center">#</th>
                  <th className="px-4 py-2.5 font-semibold">Clearance Category</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Remarks / Requirements</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Date</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Verified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFD3]">
                {activeCategories.map((cat, idx) => {
                  const rec = clearanceSummary.recordsMap.get(cat.id);
                  const status = rec?.status || 'Pending';

                  return (
                    <tr key={cat.id} className="h-10">
                      <td className="px-4 py-2 text-center text-[#6B6F6A] font-mono">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2 font-medium text-[#1C1F1D]">
                        {cat.name}
                        {cat.isMandatory && (
                          <span className="text-[10px] text-[#6B6F6A] font-normal block">
                            (Mandatory)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <StatusChip status={status} size="sm" />
                      </td>
                      <td className="px-4 py-2 text-[#6B6F6A] max-w-xs">
                        {rec?.remarks || 'No dues recorded.'}
                        {rec?.pendingRequirements && rec.pendingRequirements.length > 0 && (
                          <span className="block text-[#9E2A2B] text-[11px] mt-0.5">
                            Req: {rec.pendingRequirements.join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">
                        {rec?.updatedAt || '2026-10-10'}
                      </td>
                      <td className="px-4 py-2 text-right text-[#6B6F6A]">
                        {rec?.updatedBy || 'Office of Registrar'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Overall Clearance Result Statement */}
          <div className="p-4 bg-[#FAF8F3] border border-[#E4DFD3] rounded-[4px] flex items-center justify-between text-xs mb-10">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A] block">
                Final Assessment:
              </span>
              <p className="font-serif text-base font-medium text-[#1C1F1D] mt-0.5">
                Overall Clearance Status: <span className="uppercase">{clearanceSummary.status}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#6B6F6A] tabular-nums block">
                {clearanceSummary.clearedCount} of {clearanceSummary.totalActive} categories cleared
              </span>
            </div>
          </div>

          {/* Signature Lines */}
          <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs text-[#1C1F1D]">
            <div className="border-t border-[#1C1F1D] pt-2">
              <p className="font-semibold">Placement In-Charge</p>
              <p className="text-[11px] text-[#6B6F6A]">Dr. V. Ramanathan</p>
              <p className="text-[10px] text-[#6B6F6A]">Apex University</p>
            </div>

            <div className="border-t border-[#1C1F1D] pt-2">
              <p className="font-semibold">Head of Department</p>
              <p className="text-[11px] text-[#6B6F6A]">{selectedStudent.department}</p>
              <p className="text-[10px] text-[#6B6F6A]">Apex University</p>
            </div>
          </div>

          {/* Verification Code Footer */}
          <div className="mt-12 pt-4 border-t border-[#E4DFD3] flex items-center justify-between text-[10px] text-[#6B6F6A] font-mono">
            <span>Doc Ref: APEX-ND-{selectedStudent.rollNo}-{selectedStudent.batch}</span>
            <span>Generated: {currentDate}</span>
          </div>
        </div>
      )}
    </div>
  );
};
