import React, { useState, useMemo } from 'react';
import {
  Student,
  ClearanceCategory,
  ClearanceRecord,
  ClearanceStatus,
  Department,
  getStudentNoDuesStatus,
  exportToCSV,
  grantFullClearanceForStudents,
  updateStudentCategoryClearance,
} from '../../services/placementNoDuesService';
import { StatusChip } from '../../components/ui/StatusChip';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { Drawer } from '../../components/ui/Drawer';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FormField, PageHeader, ProgressBar, Tabs } from '../../components/ui/FeedbackComponents';
import { useToast } from '../../components/ui/Toast';
import {
  Download,
  FileText,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Layers,
  Check,
  Sparkles,
} from 'lucide-react';

interface ClearanceGridPageProps {
  students: Student[];
  categories: ClearanceCategory[];
  clearances: ClearanceRecord[];
  departments?: Department[];
  onUpdateClearances: (records: ClearanceRecord[]) => void;
  onNavigateToStatements: (studentId: string) => void;
  initialFilterStatus?: string;
}

export const ClearanceGridPage: React.FC<ClearanceGridPageProps> = ({
  students,
  categories,
  clearances,
  departments = [],
  onUpdateClearances,
  onNavigateToStatements,
  initialFilterStatus,
}) => {
  const { showToast } = useToast();

  // Primary tab: 'grid' vs 'consolidated' vs 'pending-list'
  const [activeViewTab, setActiveViewTab] = useState<'grid' | 'consolidated' | 'pending-list'>('grid');

  // Filters
  const [deptFilter, setDeptFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [overallStatusFilter, setOverallStatusFilter] = useState(initialFilterStatus || 'All');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection (Grid Tab)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState(categories[0]?.id || '');
  const [bulkStatus, setBulkStatus] = useState<ClearanceStatus>('Cleared');
  const [bulkRemarks, setBulkRemarks] = useState('Bulk clearance approval granted.');

  // Selection & Confirmation (Outstanding Dues List Tab)
  const [selectedPendingStudentIds, setSelectedPendingStudentIds] = useState<string[]>([]);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [isConfirmClearSelectedOpen, setIsConfirmClearSelectedOpen] = useState(false);

  // Cell Edit Drawer
  const [editingCell, setEditingCell] = useState<{
    student: Student;
    category: ClearanceCategory;
    record: ClearanceRecord;
  } | null>(null);

  const [cellStatus, setCellStatus] = useState<ClearanceStatus>('Cleared');
  const [cellRemarks, setCellRemarks] = useState('');
  const [cellReqs, setCellReqs] = useState<string[]>([]);
  const [newReqInput, setNewReqInput] = useState('');

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.order - b.order),
    [categories]
  );

  const allDepartments = useMemo(() => {
    if (departments && departments.length > 0) {
      return departments.map((d) => d.name);
    }
    return [];
  }, [departments]);
  const allBatches = useMemo(
    () => Array.from(new Set(students.map((s) => s.batch))).sort(),
    [students]
  );

  const filterFields: FilterField[] = [
    {
      id: 'department',
      label: 'Department',
      value: deptFilter,
      disabled: allDepartments.length === 0,
      options: [
        { label: allDepartments.length === 0 ? 'No departments yet' : 'All Departments', value: 'All' },
        ...allDepartments.map((d) => ({ label: d, value: d })),
      ],
    },
    {
      id: 'batch',
      label: 'Batch',
      value: batchFilter,
      options: [
        { label: 'All Batches', value: 'All' },
        ...allBatches.map((b) => ({ label: `Batch ${b}`, value: b })),
      ],
    },
    {
      id: 'status',
      label: 'Overall Status',
      value: overallStatusFilter,
      options: [
        { label: 'All Statuses', value: 'All' },
        { label: 'Cleared', value: 'Cleared' },
        { label: 'Pending / Incomplete', value: 'Pending' },
        { label: 'Rejected / Action Required', value: 'Rejected' },
      ],
    },
  ];

  const handleFilterChange = (id: string, val: string) => {
    if (id === 'department') setDeptFilter(val);
    if (id === 'batch') setBatchFilter(val);
    if (id === 'status') setOverallStatusFilter(val);
  };

  const handleResetFilters = () => {
    setDeptFilter('All');
    setBatchFilter('All');
    setOverallStatusFilter('All');
    setSearchQuery('');
  };

  // Precompute status map per student
  const studentClearanceData = useMemo(() => {
    return students.map((s) => {
      const summary = getStudentNoDuesStatus(s.id, categories, clearances);
      return {
        student: s,
        summary,
      };
    });
  }, [students, categories, clearances]);

  // Filtered rows for grid
  const filteredGridRows = useMemo(() => {
    return studentClearanceData.filter(({ student, summary }) => {
      if (deptFilter !== 'All' && student.department !== deptFilter) return false;
      if (batchFilter !== 'All' && student.batch !== batchFilter) return false;

      if (overallStatusFilter !== 'All') {
        if (overallStatusFilter === 'Cleared' && summary.status !== 'Cleared') return false;
        if (
          overallStatusFilter === 'Pending' &&
          summary.status !== 'Pending' &&
          summary.status !== 'Incomplete'
        )
          return false;
        if (
          overallStatusFilter === 'Rejected' &&
          summary.status !== 'Rejected / Action Required'
        )
          return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mRoll = student.rollNo.toLowerCase().includes(q);
        const mName = student.name.toLowerCase().includes(q);
        if (!mRoll && !mName) return false;
      }

      return true;
    });
  }, [studentClearanceData, deptFilter, batchFilter, overallStatusFilter, searchQuery]);

  // Open Cell Edit Drawer
  const handleCellClick = (student: Student, category: ClearanceCategory) => {
    const existing = clearances.find(
      (c) => c.studentId === student.id && c.categoryId === category.id
    );

    const record: ClearanceRecord = existing || {
      id: `rec-${student.id}-${category.id}`,
      studentId: student.id,
      categoryId: category.id,
      status: 'Pending',
      remarks: '',
      pendingRequirements: [],
      updatedAt: new Date().toISOString().split('T')[0],
      updatedBy: 'Placement Section',
    };

    setEditingCell({ student, category, record });
    setCellStatus(record.status);
    setCellRemarks(record.remarks);
    setCellReqs([...record.pendingRequirements]);
    setNewReqInput('');
  };

  // Save Cell Edit
  const handleSaveCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;

    const today = new Date().toISOString().split('T')[0];
    const updatedRecord: ClearanceRecord = {
      ...editingCell.record,
      status: cellStatus,
      remarks: cellRemarks,
      pendingRequirements: cellReqs,
      updatedAt: today,
      updatedBy: 'Placement In-Charge',
    };

    const exists = clearances.some((c) => c.id === updatedRecord.id);
    let nextClearances: ClearanceRecord[];
    if (exists) {
      nextClearances = clearances.map((c) => (c.id === updatedRecord.id ? updatedRecord : c));
    } else {
      nextClearances = [...clearances, updatedRecord];
    }

    onUpdateClearances(nextClearances);
    setEditingCell(null);
    showToast({
      type: 'success',
      message: `Updated ${editingCell.category.name} clearance for ${editingCell.student.name}`,
    });
  };

  // Bulk Set Category Status
  const handleConfirmBulkUpdate = () => {
    if (selectedStudentIds.length === 0) return;
    const today = new Date().toISOString().split('T')[0];

    const recordsMap = new Map(clearances.map((c) => [`${c.studentId}-${c.categoryId}`, c]));

    selectedStudentIds.forEach((stuId) => {
      const key = `${stuId}-${bulkCategoryId}`;
      const rec = recordsMap.get(key);
      if (rec) {
        recordsMap.set(key, {
          ...rec,
          status: bulkStatus,
          remarks: bulkRemarks,
          updatedAt: today,
          updatedBy: 'Placement In-Charge',
        });
      } else {
        recordsMap.set(key, {
          id: `rec-${stuId}-${bulkCategoryId}`,
          studentId: stuId,
          categoryId: bulkCategoryId,
          status: bulkStatus,
          remarks: bulkRemarks,
          pendingRequirements: [],
          updatedAt: today,
          updatedBy: 'Placement In-Charge',
        });
      }
    });

    onUpdateClearances(Array.from(recordsMap.values()));
    setBulkCategoryModalOpen(false);
    setSelectedStudentIds([]);
    showToast({
      type: 'success',
      message: `Updated category status for ${selectedStudentIds.length} students.`,
    });
  };

  // Grant Full Clearance (All Categories) to a Single Student
  const handleGrantFullClearance = (student: Student) => {
    const nextClearances = grantFullClearanceForStudents(
      [student.id],
      categories,
      clearances,
      'Institutional clearance approved by Placement In-Charge.'
    );
    onUpdateClearances(nextClearances);
    setSelectedPendingStudentIds((prev) => prev.filter((id) => id !== student.id));
    showToast({
      type: 'success',
      message: `Granted complete clearance for ${student.name} (${student.rollNo}). All dues resolved.`,
    });
  };

  // Grant Full Clearance to Multiple Students
  const handleGrantBulkFullClearance = (studentIds: string[]) => {
    if (studentIds.length === 0) return;
    const nextClearances = grantFullClearanceForStudents(
      studentIds,
      categories,
      clearances,
      'Bulk institutional clearance approved by Placement In-Charge.'
    );
    onUpdateClearances(nextClearances);
    setSelectedStudentIds([]);
    setSelectedPendingStudentIds([]);
    setIsConfirmClearAllOpen(false);
    setIsConfirmClearSelectedOpen(false);
    showToast({
      type: 'success',
      message: `Granted complete clearance for ${studentIds.length} students.`,
    });
  };

  // Quick Clear Single Category
  const handleQuickClearCategory = (student: Student, category: ClearanceCategory) => {
    const nextClearances = updateStudentCategoryClearance(
      student.id,
      category.id,
      clearances,
      'Cleared',
      `Cleared by Placement In-Charge on ${new Date().toISOString().split('T')[0]}`
    );
    onUpdateClearances(nextClearances);
    showToast({
      type: 'success',
      message: `Cleared ${category.name} due for ${student.name}.`,
    });
  };

  // Export Grid to CSV
  const handleExportGrid = () => {
    if (filteredGridRows.length === 0) return;

    const exportRows = filteredGridRows.map(({ student, summary }) => {
      const row: Record<string, any> = {
        'Roll No': student.rollNo,
        Name: student.name,
        Department: student.department,
        Batch: student.batch,
        'Overall Status': summary.status,
        'Cleared Count': `${summary.clearedCount} of ${summary.totalActive}`,
      };

      activeCategories.forEach((cat) => {
        const rec = summary.recordsMap.get(cat.id);
        row[cat.name] = rec ? rec.status : 'Pending';
      });

      return row;
    });

    exportToCSV('hiresight_nodues_clearance_grid', exportRows);
  };

  // Consolidated Progress Rows (Dept x Batch)
  const consolidatedRows = useMemo(() => {
    const list: Array<{
      dept: string;
      batch: string;
      total: number;
      cleared: number;
      pending: number;
      rejected: number;
      pct: number;
    }> = [];

    const depts = deptFilter === 'All' ? allDepartments : [deptFilter];
    const batches = batchFilter === 'All' ? allBatches : [batchFilter];

    depts.forEach((dept) => {
      batches.forEach((batch) => {
        const cohort = studentClearanceData.filter(
          (s) => s.student.department === dept && s.student.batch === batch
        );
        if (cohort.length === 0) return;

        const cleared = cohort.filter((s) => s.summary.status === 'Cleared').length;
        const pending = cohort.filter(
          (s) => s.summary.status === 'Pending' || s.summary.status === 'Incomplete'
        ).length;
        const rejected = cohort.filter(
          (s) => s.summary.status === 'Rejected / Action Required'
        ).length;
        const pct = Math.round((cleared / cohort.length) * 100);

        list.push({
          dept,
          batch,
          total: cohort.length,
          cleared,
          pending,
          rejected,
          pct,
        });
      });
    });

    return list;
  }, [studentClearanceData, deptFilter, batchFilter, allDepartments, allBatches]);

  // Pending List (Students with incomplete clearance)
  const pendingStudentsList = useMemo(() => {
    return studentClearanceData
      .filter((s) => s.summary.status !== 'Cleared')
      .filter((s) => {
        if (deptFilter !== 'All' && s.student.department !== deptFilter) return false;
        if (batchFilter !== 'All' && s.student.batch !== batchFilter) return false;
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          return (
            s.student.name.toLowerCase().includes(q) ||
            s.student.rollNo.toLowerCase().includes(q) ||
            s.student.department.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [studentClearanceData, deptFilter, batchFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clearance Grid & Statements"
        subtitle="Cross-department matriculation clearance records, batch progress tracking, and formal no-dues statements."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Download className="w-4 h-4 text-[#6B6F6A]" />}
              onClick={handleExportGrid}
            >
              Export Grid (CSV)
            </Button>
          </div>
        }
      />

      {/* Top Tabs */}
      <div className="bg-white border border-[#E4DFD3] rounded-[6px] overflow-hidden">
        <Tabs
          tabs={[
            { id: 'grid', label: 'Clearance Matrix Grid' },
            { id: 'consolidated', label: 'Department × Batch Progress' },
            {
              id: 'pending-list',
              label: 'Outstanding Dues List',
              count: pendingStudentsList.length,
            },
          ]}
          activeTab={activeViewTab}
          onChange={(id) => setActiveViewTab(id as any)}
        />
      </div>

      {/* ============================================================= */}
      {/* VIEW 1: MATRIX CLEARANCE GRID */}
      {/* ============================================================= */}
      {activeViewTab === 'grid' && (
        <div className="space-y-4">
          {/* Filters */}
          <FilterBar
            fields={filterFields}
            onFilterChange={handleFilterChange}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search student by name or roll number..."
            onReset={handleResetFilters}
          />

          {/* Bulk Action Bar */}
          {selectedStudentIds.length > 0 && (
            <div className="p-3 bg-[#FAF8F3] border border-[#1F4D3F] rounded-[6px] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#1F4D3F]">
                {selectedStudentIds.length} candidate(s) selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => handleGrantBulkFullClearance(selectedStudentIds)}
                  className="bg-[#1F4D3F] hover:bg-[#16382E] text-white"
                >
                  Grant Full Clearance ({selectedStudentIds.length} Students)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkCategoryModalOpen(true)}
                >
                  Bulk set specific category...
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-xs text-[#6B6F6A]"
                >
                  Cancel selection
                </Button>
              </div>
            </div>
          )}

          {/* Grid Table Container (Sticky Header and First Column) */}
          <div className="bg-white border border-[#E4DFD3] rounded-[6px] overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] sticky top-0 z-20 uppercase tracking-[0.06em]">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center sticky left-0 bg-[#FAF8F3] z-30 border-r border-[#E4DFD3]">
                      <input
                        type="checkbox"
                        checked={
                          filteredGridRows.length > 0 &&
                          selectedStudentIds.length === filteredGridRows.length
                        }
                        onChange={(e) => {
                          setSelectedStudentIds(
                            e.target.checked ? filteredGridRows.map((r) => r.student.id) : []
                          );
                        }}
                        className="rounded text-[#1F4D3F]"
                      />
                    </th>
                    <th className="px-4 py-2.5 font-semibold sticky left-10 bg-[#FAF8F3] z-30 border-r border-[#E4DFD3] min-w-[200px]">
                      Student Candidate
                    </th>
                    {activeCategories.map((cat) => (
                      <th
                        key={cat.id}
                        className="px-3 py-2.5 font-semibold text-center whitespace-nowrap min-w-[120px]"
                      >
                        {cat.name}
                        {cat.isMandatory && (
                          <span className="text-[9px] text-[#C2501F] block lowercase font-normal">
                            *mandatory
                          </span>
                        )}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-semibold text-right min-w-[160px] sticky right-0 bg-[#FAF8F3] z-30 border-l border-[#E4DFD3]">
                      Overall Clearance
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E4DFD3]">
                  {filteredGridRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeCategories.length + 3}
                        className="py-12 px-4 text-center text-xs text-[#6B6F6A]"
                      >
                        {students.length === 0 ? 'No students yet' : 'No records match the current criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredGridRows.map(({ student, summary }) => {
                      const isSelected = selectedStudentIds.includes(student.id);

                      return (
                        <tr
                          key={student.id}
                          className={`h-[44px] transition-colors group ${
                            isSelected ? 'bg-[#F4F9F5]' : 'hover:bg-[#FAF8F3]'
                          }`}
                        >
                          {/* Select checkbox */}
                          <td className="px-3 py-2 text-center sticky left-0 bg-white group-hover:bg-[#FAF8F3] z-10 border-r border-[#E4DFD3]">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedStudentIds((prev) =>
                                  e.target.checked
                                    ? [...prev, student.id]
                                    : prev.filter((id) => id !== student.id)
                                );
                              }}
                              className="rounded text-[#1F4D3F]"
                            />
                          </td>

                          {/* Sticky Candidate info with Statement link */}
                          <td className="px-4 py-2 sticky left-10 bg-white group-hover:bg-[#FAF8F3] z-10 border-r border-[#E4DFD3]">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-[#1C1F1D]">{student.name}</p>
                                <p className="text-[11px] text-[#6B6F6A] font-mono">
                                  {student.rollNo} · {student.department.replace(' Engineering', '').replace('Information Technology', 'IT')}
                                </p>
                              </div>
                              <button
                                onClick={() => onNavigateToStatements(student.id)}
                                className="text-[11px] text-[#1F4D3F] hover:underline opacity-0 group-hover:opacity-100 transition-opacity font-medium inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                                title="Generate printed statement"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Statement</span>
                              </button>
                            </div>
                          </td>

                          {/* Category cells */}
                          {activeCategories.map((cat) => {
                            const record = summary.recordsMap.get(cat.id);
                            const cellStatus = record ? record.status : 'Pending';

                            return (
                              <td
                                key={cat.id}
                                onClick={() => handleCellClick(student, cat)}
                                className="px-3 py-2 text-center cursor-pointer hover:bg-[#EAF3ED]/40 transition-colors"
                                title={`Click to edit ${cat.name} clearance`}
                              >
                                <StatusChip status={cellStatus} size="sm" />
                              </td>
                            );
                          })}

                          {/* Overall column with thin progress bar */}
                          <td className="px-4 py-2 sticky right-0 bg-white group-hover:bg-[#FAF8F3] z-10 border-l border-[#E4DFD3] text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16">
                                <ProgressBar
                                  value={summary.clearedCount}
                                  max={summary.totalActive}
                                />
                              </div>
                              <StatusChip status={summary.status} size="sm" />
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-0.5">
                              <span className="text-[10px] text-[#6B6F6A] tabular-nums block">
                                {summary.clearedCount} of {summary.totalActive} cleared
                              </span>
                              {summary.status !== 'Cleared' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGrantFullClearance(student);
                                  }}
                                  className="text-[10px] font-medium text-[#1F4D3F] hover:text-[#16382E] inline-flex items-center gap-0.5 hover:underline cursor-pointer bg-[#EAF3ED] px-1.5 py-0.5 rounded border border-[#CDE3D3]"
                                  title="Instantly clear all dues for this student"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Clear All</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW 2: DEPARTMENT X BATCH PROGRESS */}
      {/* ============================================================= */}
      {activeViewTab === 'consolidated' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
            <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
              Consolidated Clearance Rates by Department & Batch
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">Batch</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Total Students</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Cleared</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Pending</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Rejected</th>
                  <th className="px-4 py-2.5 font-semibold w-56">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFD3]">
                {consolidatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-4 text-center text-xs text-[#6B6F6A]">
                      {students.length === 0 ? 'No students yet' : 'No records match the current criteria.'}
                    </td>
                  </tr>
                ) : (
                  consolidatedRows.map((row) => (
                    <tr key={`${row.dept}-${row.batch}`} className="hover:bg-[#FAF8F3] h-10">
                      <td className="px-4 py-2 font-medium text-[#1C1F1D]">{row.dept}</td>
                      <td className="px-4 py-2 text-[#6B6F6A]">Batch {row.batch}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#1C1F1D]">
                        {row.total}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1E5631]">
                        {row.cleared}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#8C5E09]">
                        {row.pending}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#9E2A2B]">
                        {row.rejected}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={row.pct} className="flex-1" />
                          <span className="text-[11px] font-semibold text-[#1C1F1D] tabular-nums shrink-0 w-8 text-right">
                            {row.pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ============================================================= */}
      {/* ============================================================= */}
      {/* VIEW 3: OUTSTANDING DUES LIST */}
      {/* ============================================================= */}
      {activeViewTab === 'pending-list' && (
        <Card padding="none" className="overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
                Students with Pending or Rejected Clearances ({pendingStudentsList.length})
              </h3>
              <p className="text-xs text-[#6B6F6A] mt-0.5">
                Outstanding dues preventing graduation clearance certificate issuance. Select candidates to grant clearance individually or in bulk.
              </p>
            </div>
            {pendingStudentsList.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={() => setIsConfirmClearAllOpen(true)}
                  className="bg-[#1F4D3F] hover:bg-[#16382E] text-white"
                >
                  Clear All ({pendingStudentsList.length}) Students
                </Button>
              </div>
            )}
          </div>

          {/* Subheader: Selection & Search Toolbar */}
          <div className="p-3 border-b border-[#E4DFD3] bg-[#FAF8F3]/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-[#1C1F1D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    pendingStudentsList.length > 0 &&
                    selectedPendingStudentIds.length === pendingStudentsList.length
                  }
                  onChange={(e) => {
                    setSelectedPendingStudentIds(
                      e.target.checked ? pendingStudentsList.map((p) => p.student.id) : []
                    );
                  }}
                  className="rounded text-[#1F4D3F]"
                />
                <span>Select all ({pendingStudentsList.length})</span>
              </label>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search outstanding students..."
                className="h-8 px-2.5 text-xs bg-white border border-[#E4DFD3] rounded text-[#1C1F1D] w-full max-w-xs focus:border-[#1F4D3F]"
              />
            </div>
          </div>

          {/* Floating Action Bar when students are selected */}
          {selectedPendingStudentIds.length > 0 && (
            <div className="p-3 bg-[#EAF3ED] border-b border-[#CDE3D3] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#1E5631]">
                {selectedPendingStudentIds.length} candidate(s) selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => setIsConfirmClearSelectedOpen(true)}
                  className="bg-[#1F4D3F] hover:bg-[#16382E] text-white"
                >
                  Grant Full Clearance to Selected ({selectedPendingStudentIds.length})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedStudentIds(selectedPendingStudentIds);
                    setBulkCategoryModalOpen(true);
                  }}
                >
                  Bulk set specific category...
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPendingStudentIds([])}
                  className="text-xs text-[#6B6F6A]"
                >
                  Deselect all
                </Button>
              </div>
            </div>
          )}

          {/* Student List */}
          <div className="divide-y divide-[#E4DFD3]">
            {pendingStudentsList.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#6B6F6A] space-y-2">
                <div className="w-10 h-10 bg-[#EAF3ED] text-[#1E5631] rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="font-serif text-base font-medium text-[#1C1F1D]">
                  All students have obtained full institutional clearance!
                </p>
                <p className="max-w-md mx-auto text-[#6B6F6A]">
                  Zero outstanding dues recorded across all departments and cohorts. Official No-Dues Statements can now be printed from the Statements page.
                </p>
              </div>
            ) : (
              pendingStudentsList.map(({ student, summary }) => {
                const isPendingSelected = selectedPendingStudentIds.includes(student.id);

                // Gather unresolved categories
                const pendingCats = activeCategories.filter((c) => {
                  const rec = summary.recordsMap.get(c.id);
                  return !rec || (rec.status !== 'Cleared' && rec.status !== 'Not Applicable');
                });

                return (
                  <div
                    key={student.id}
                    className={`p-4 hover:bg-[#FAF8F3] flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                      isPendingSelected ? 'bg-[#F4F9F5]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isPendingSelected}
                        onChange={(e) => {
                          setSelectedPendingStudentIds((prev) =>
                            e.target.checked
                              ? [...prev, student.id]
                              : prev.filter((id) => id !== student.id)
                          );
                        }}
                        className="mt-1 rounded text-[#1F4D3F]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#1C1F1D]">
                            {student.name}
                          </span>
                          <span className="text-[11px] text-[#6B6F6A] font-mono">
                            ({student.rollNo})
                          </span>
                          <StatusChip status={summary.status} size="sm" />
                        </div>
                        <p className="text-xs text-[#6B6F6A] mt-0.5">
                          {student.department} · Batch {student.batch}
                        </p>

                        {/* Interactive Pending category chips */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[11px] text-[#6B6F6A]">Outstanding sections:</span>
                          {pendingCats.map((cat) => {
                            const rec = summary.recordsMap.get(cat.id);
                            return (
                              <div
                                key={cat.id}
                                className={`inline-flex items-center gap-1 text-[10px] pl-2 pr-1 py-0.5 rounded border transition-colors ${
                                  rec?.status === 'Rejected'
                                    ? 'bg-[#FCECEE] text-[#9E2A2B] border-[#F6C6CA]'
                                    : 'bg-[#FDF6E2] text-[#8C5E09] border-[#F3E3B5]'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(student, cat)}
                                  className="hover:underline font-medium cursor-pointer"
                                  title="Click to view details or add notes"
                                >
                                  {cat.name} ({rec?.status || 'Pending'})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickClearCategory(student, cat)}
                                  className="p-0.5 hover:bg-black/10 rounded cursor-pointer ml-0.5"
                                  title={`Instantly clear ${cat.name}`}
                                >
                                  <Check className="w-3 h-3 text-current" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        onClick={() => handleGrantFullClearance(student)}
                        className="bg-[#1F4D3F] hover:bg-[#16382E] text-white"
                        title="Clear all dues for this student in one click"
                      >
                        Clear All Dues
                      </Button>
                      {pendingCats[0] && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCellClick(student, pendingCats[0])}
                        >
                          Edit Details
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<FileText className="w-3.5 h-3.5" />}
                        onClick={() => onNavigateToStatements(student.id)}
                      >
                        Statement
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {/* ============================================================= */}
      {/* DRAWER: EDIT CLEARANCE CELL */}
      {/* ============================================================= */}
      {editingCell && (
        <Drawer
          isOpen={!!editingCell}
          onClose={() => setEditingCell(null)}
          title={`Update ${editingCell.category.name} Clearance`}
          subtitle={`${editingCell.student.name} (${editingCell.student.rollNo}) · ${editingCell.student.department}`}
          width="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-[#1F4D3F]" />}
                onClick={() => {
                  handleGrantFullClearance(editingCell.student);
                  setEditingCell(null);
                }}
              >
                Clear All Categories
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingCell(null)}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveCell}>
                  Save Clearance
                </Button>
              </div>
            </div>
          }
        >
          <form onSubmit={handleSaveCell} className="space-y-4">
            <FormField label="Clearance Status" required>
              <select
                value={cellStatus}
                onChange={(e) => setCellStatus(e.target.value as ClearanceStatus)}
                className="w-full h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              >
                <option value="Pending">Pending</option>
                <option value="Cleared">Cleared</option>
                <option value="Not Applicable">Not Applicable</option>
                <option value="Rejected">Rejected</option>
                <option value="Further action required">Further action required</option>
              </select>
            </FormField>

            <FormField label="Staff Remarks / Observations">
              <textarea
                rows={3}
                value={cellRemarks}
                onChange={(e) => setCellRemarks(e.target.value)}
                placeholder="Enter verification notes or specific due details..."
                className="w-full p-2.5 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            {/* Pending Requirements Checklist for this student */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] block mb-1.5">
                Pending Requirements for Student:
              </label>
              <div className="space-y-1.5 mb-2">
                {cellReqs.map((req, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-[#FAF8F3] border border-[#E4DFD3] rounded text-xs"
                  >
                    <span className="text-[#1C1F1D]">{req}</span>
                    <button
                      type="button"
                      onClick={() => setCellReqs(cellReqs.filter((_, i) => i !== idx))}
                      className="text-[#9E2A2B] hover:underline text-[11px] cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newReqInput}
                  onChange={(e) => setNewReqInput(e.target.value)}
                  placeholder="e.g. Return book #4019 or submit replacement slip"
                  className="flex-1 h-8 px-2.5 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (newReqInput.trim()) {
                      setCellReqs([...cellReqs, newReqInput.trim()]);
                      setNewReqInput('');
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E4DFD3] text-[11px] text-[#6B6F6A] space-y-1">
              <p>Last updated: {editingCell.record.updatedAt}</p>
              <p>Audited by: {editingCell.record.updatedBy}</p>
            </div>
          </form>
        </Drawer>
      )}

      {/* ============================================================= */}
      {/* BULK UPDATE CATEGORY CONFIRM DIALOG */}
      {/* ============================================================= */}
      {bulkCategoryModalOpen && (
        <Drawer
          isOpen={bulkCategoryModalOpen}
          onClose={() => setBulkCategoryModalOpen(false)}
          title="Bulk Set Category Status"
          subtitle={`Applying updates to ${selectedStudentIds.length} selected candidate rows`}
          width="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkCategoryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmBulkUpdate}>
                Apply to {selectedStudentIds.length} Students
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label="Clearance Category" required>
              <select
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Target Status" required>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as ClearanceStatus)}
                className="w-full h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
              >
                <option value="Cleared">Cleared</option>
                <option value="Pending">Pending</option>
                <option value="Not Applicable">Not Applicable</option>
                <option value="Rejected">Rejected</option>
              </select>
            </FormField>

            <FormField label="Remarks">
              <textarea
                rows={2}
                value={bulkRemarks}
                onChange={(e) => setBulkRemarks(e.target.value)}
                className="w-full p-2 text-xs bg-white border border-[#E4DFD3] rounded"
              />
            </FormField>
          </div>
        </Drawer>
      )}

      {/* CONFIRM: CLEAR ALL OUTSTANDING STUDENTS */}
      {isConfirmClearAllOpen && (
        <ConfirmDialog
          isOpen={isConfirmClearAllOpen}
          onClose={() => setIsConfirmClearAllOpen(false)}
          onConfirm={() =>
            handleGrantBulkFullClearance(pendingStudentsList.map((p) => p.student.id))
          }
          title={`Grant Full Clearance to ALL ${pendingStudentsList.length} Students?`}
          message={`This will approve institutional clearance for all ${pendingStudentsList.length} outstanding candidate(s). All active categories will be set to Cleared, and official graduation certificates can be generated immediately.`}
          confirmLabel={`Yes, Clear All ${pendingStudentsList.length} Students`}
          variant="primary"
        />
      )}

      {/* CONFIRM: CLEAR SELECTED OUTSTANDING STUDENTS */}
      {isConfirmClearSelectedOpen && (
        <ConfirmDialog
          isOpen={isConfirmClearSelectedOpen}
          onClose={() => setIsConfirmClearSelectedOpen(false)}
          onConfirm={() => handleGrantBulkFullClearance(selectedPendingStudentIds)}
          title={`Grant Full Clearance to ${selectedPendingStudentIds.length} Selected Students?`}
          message={`This will mark all active clearance categories as Cleared for the ${selectedPendingStudentIds.length} selected candidate(s).`}
          confirmLabel={`Confirm & Clear ${selectedPendingStudentIds.length} Students`}
          variant="primary"
        />
      )}
    </div>
  );
};
