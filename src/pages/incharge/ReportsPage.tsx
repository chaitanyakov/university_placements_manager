import React, { useState, useMemo } from 'react';
import {
  Student,
  Drive,
  Application,
  ClearanceCategory,
  ClearanceRecord,
  isApplicationValidOffer,
  getValidOffers,
  getRegisteredAndEligibleStudents,
  getUniquePlacedStudents,
  getPlacementPercentage,
  getPackageStats,
  getStudentNoDuesStatus,
  exportToCSV,
} from '../../services/placementNoDuesService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusChip } from '../../components/ui/StatusChip';
import { PageHeader } from '../../components/ui/FeedbackComponents';
import {
  BarChart,
  Building2,
  Users,
  UserX,
  Clock,
  FileCheck,
  FileSpreadsheet,
  ArrowRight,
  Download,
  Printer,
} from 'lucide-react';

interface ReportsPageProps {
  students: Student[];
  drives: Drive[];
  applications: Application[];
  categories: ClearanceCategory[];
  clearances: ClearanceRecord[];
  onNavigateToStatements: (studentId?: string) => void;
  initialReportId?: string;
}

type ReportType =
  | 'hub'
  | 'dept-stats'
  | 'company-outcomes'
  | 'student-history'
  | 'unplaced-list'
  | 'pending-nodues'
  | 'batch-summary';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  students,
  drives,
  applications,
  categories,
  clearances,
  onNavigateToStatements,
  initialReportId,
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>(
    (initialReportId as ReportType) || 'hub'
  );

  // Filters for reports
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState('All');

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const allDepartments = useMemo(
    () => Array.from(new Set(students.map((s) => s.department))).sort(),
    [students]
  );
  const allBatches = useMemo(
    () => Array.from(new Set(students.map((s) => s.batch))).sort(),
    [students]
  );
  const allCompanies = useMemo(
    () => Array.from(new Set(drives.map((d) => d.company))).sort(),
    [drives]
  );

  const filterFields: FilterField[] = [
    {
      id: 'department',
      label: 'Department',
      value: selectedDept,
      options: [
        { label: 'All Departments', value: 'All' },
        ...allDepartments.map((d) => ({ label: d, value: d })),
      ],
    },
    {
      id: 'batch',
      label: 'Batch',
      value: selectedBatch,
      options: [
        { label: 'All Batches', value: 'All' },
        ...allBatches.map((b) => ({ label: `Batch ${b}`, value: b })),
      ],
    },
    {
      id: 'company',
      label: 'Company',
      value: selectedCompany,
      options: [
        { label: 'All Companies', value: 'All' },
        ...allCompanies.map((c) => ({ label: c, value: c })),
      ],
    },
  ];

  const handleFilterChange = (id: string, val: string) => {
    if (id === 'department') setSelectedDept(val);
    if (id === 'batch') setSelectedBatch(val);
    if (id === 'company') setSelectedCompany(val);
  };

  const handleResetFilters = () => {
    setSelectedDept('All');
    setSelectedBatch('All');
    setSelectedCompany('All');
  };

  const filterSummaryString = `Generated on ${currentDate} · Filters: Department=${selectedDept}, Batch=${selectedBatch}, Company=${selectedCompany}`;

  // -------------------------------------------------------------
  // REPORT 1: Department-wise placement statistics
  // -------------------------------------------------------------
  const deptStatsData = useMemo(() => {
    const depts = selectedDept === 'All' ? allDepartments : [selectedDept];
    return depts.map((dept) => {
      const deptStudents = students.filter(
        (s) => s.department === dept && (selectedBatch === 'All' || s.batch === selectedBatch)
      );
      const eligible = getRegisteredAndEligibleStudents(deptStudents).length;
      const deptApps = applications.filter((a) => {
        const st = students.find((s) => s.id === a.studentId);
        return (
          st?.department === dept && (selectedBatch === 'All' || st.batch === selectedBatch)
        );
      });
      const placed = getUniquePlacedStudents(deptApps, drives, deptStudents).length;
      const validOffers = getValidOffers(deptApps, drives);
      const pkg = getPackageStats(deptApps, drives);
      const pct = eligible > 0 ? Math.round((placed / eligible) * 1000) / 10 : 0;

      return {
        department: dept,
        registered: deptStudents.length,
        eligible,
        placed,
        offers: validOffers.length,
        placedPct: `${pct}%`,
        highestPkg: pkg.highest > 0 ? `₹${pkg.highest} LPA` : '—',
        avgPkg: pkg.average > 0 ? `₹${pkg.average} LPA` : '—',
      };
    });
  }, [allDepartments, selectedDept, selectedBatch, students, applications, drives]);

  // -------------------------------------------------------------
  // REPORT 2: Company-wise recruitment outcomes
  // -------------------------------------------------------------
  const companyOutcomesData = useMemo(() => {
    const comps = selectedCompany === 'All' ? allCompanies : [selectedCompany];
    return comps.map((comp) => {
      const compDrives = drives.filter(
        (d) => d.company === comp && d.status !== 'Cancelled'
      );
      const compApps = applications.filter((a) => a.company === comp);
      const registered = compApps.length;
      const shortlisted = compApps.filter((a) =>
        ['Shortlisted', 'Assessment', 'Interview', 'Selected', 'Offer', 'Joined'].includes(a.stage)
      ).length;
      const offers = compApps.filter((a) => ['Offer', 'Joined'].includes(a.stage)).length;
      const joined = compApps.filter((a) => a.stage === 'Joined').length;
      const pkg = compDrives[0]?.packageLpa || 0;

      return {
        company: comp,
        role: compDrives.map((d) => d.role).join(', ') || 'Recruitment Role',
        package: pkg > 0 ? `₹${pkg} LPA` : '—',
        registered,
        shortlisted,
        offers,
        joined,
      };
    });
  }, [allCompanies, selectedCompany, drives, applications]);

  // -------------------------------------------------------------
  // REPORT 3: Student-wise placement history
  // -------------------------------------------------------------
  const studentHistoryData = useMemo(() => {
    return applications
      .filter((app) => {
        const st = students.find((s) => s.id === app.studentId);
        if (selectedDept !== 'All' && st?.department !== selectedDept) return false;
        if (selectedBatch !== 'All' && st?.batch !== selectedBatch) return false;
        if (selectedCompany !== 'All' && app.company !== selectedCompany) return false;
        return true;
      })
      .map((app) => {
        const st = students.find((s) => s.id === app.studentId);
        return {
          rollNo: st?.rollNo || '',
          name: st?.name || '',
          department: st?.department || '',
          batch: st?.batch || '',
          company: app.company,
          role: app.role,
          stage: app.stage,
          package: app.packageLpa ? `₹${app.packageLpa} LPA` : '—',
          date: app.updatedAt,
        };
      });
  }, [applications, students, selectedDept, selectedBatch, selectedCompany]);

  // -------------------------------------------------------------
  // REPORT 4: Unplaced student list
  // -------------------------------------------------------------
  const unplacedListData = useMemo(() => {
    const validOffers = getValidOffers(applications, drives);
    const placedIds = new Set(validOffers.map((o) => o.studentId));

    return students
      .filter((s) => {
        if (!s.isRegistered || !s.isEligible) return false;
        if (placedIds.has(s.id)) return false;
        if (selectedDept !== 'All' && s.department !== selectedDept) return false;
        if (selectedBatch !== 'All' && s.batch !== selectedBatch) return false;
        return true;
      })
      .map((s) => ({
        rollNo: s.rollNo,
        name: s.name,
        department: s.department,
        batch: s.batch,
        cgpa: s.cgpa,
        backlogs: s.activeBacklogs,
        email: s.email,
        phone: s.phone || '—',
      }));
  }, [students, applications, drives, selectedDept, selectedBatch]);

  // -------------------------------------------------------------
  // REPORT 5: Department-wise pending no-dues list
  // -------------------------------------------------------------
  const pendingNoDuesData = useMemo(() => {
    return students
      .map((s) => {
        const summary = getStudentNoDuesStatus(s.id, categories, clearances);
        return { student: s, summary };
      })
      .filter(({ student, summary }) => {
        if (summary.status === 'Cleared') return false;
        if (selectedDept !== 'All' && student.department !== selectedDept) return false;
        if (selectedBatch !== 'All' && student.batch !== selectedBatch) return false;
        return true;
      })
      .map(({ student, summary }) => ({
        rollNo: student.rollNo,
        name: student.name,
        department: student.department,
        batch: student.batch,
        overallStatus: summary.status,
        clearedCount: `${summary.clearedCount} of ${summary.totalActive}`,
        pendingItems: summary.pendingRequirements.join('; ') || 'Pending verification',
      }));
  }, [students, categories, clearances, selectedDept, selectedBatch]);

  // -------------------------------------------------------------
  // REPORT 7: Final placement summary for a selected batch
  // -------------------------------------------------------------
  const batchSummaryStats = useMemo(() => {
    const targetBatch = selectedBatch === 'All' ? '2025' : selectedBatch;
    const batchStudents = students.filter((s) => s.batch === targetBatch);
    const eligible = getRegisteredAndEligibleStudents(batchStudents);
    const batchApps = applications.filter((a) => {
      const st = students.find((s) => s.id === a.studentId);
      return st?.batch === targetBatch;
    });

    const validOffers = getValidOffers(batchApps, drives);
    const placed = getUniquePlacedStudents(batchApps, drives, batchStudents);
    const pct = getPlacementPercentage(batchStudents, batchApps, drives);
    const pkg = getPackageStats(batchApps, drives);

    return {
      batch: targetBatch,
      totalStudents: batchStudents.length,
      eligibleCount: eligible.length,
      placedCount: placed.length,
      totalOffers: validOffers.length,
      placementPercentage: pct,
      highestPackage: pkg.highest,
      averagePackage: pkg.average,
    };
  }, [selectedBatch, students, applications, drives]);

  // Exports
  const handleExportCSV = (filename: string, data: Record<string, any>[]) => {
    exportToCSV(filename, data);
  };

  const handleExportExcel = (filename: string, data: Record<string, any>[]) => {
    // Generates cleanly delimited Excel-compatible dataset
    exportToCSV(`${filename}_excel`, data);
  };

  // -------------------------------------------------------------
  // REPORT CARDS CONFIG FOR HUB VIEW
  // -------------------------------------------------------------
  const reportCards = [
    {
      id: 'dept-stats',
      title: 'Department-wise Placement Statistics',
      description: 'Departmental breakdown of registered candidates, placement conversion %, and package averages.',
      icon: <BarChart className="w-4 h-4 stroke-[1.5]" />,
    },
    {
      id: 'company-outcomes',
      title: 'Company-wise Recruitment Outcomes',
      description: 'Recruiting organization metrics: candidate registrations, shortlists, offers released, and joining rates.',
      icon: <Building2 className="w-4 h-4 stroke-[1.5]" />,
    },
    {
      id: 'student-history',
      title: 'Student-wise Placement History',
      description: 'Full audit history of candidate applications across drives with stages and dates.',
      icon: <Users className="w-4 h-4 stroke-[1.5]" />,
    },
    {
      id: 'unplaced-list',
      title: 'Unplaced Student List',
      description: 'Directory of registered and eligible students currently seeking placement opportunities.',
      icon: <UserX className="w-4 h-4 stroke-[1.5]" />,
    },
    {
      id: 'pending-nodues',
      title: 'Department-wise Pending No-Dues List',
      description: 'Students with outstanding graduation dues, categorized by department and requirements.',
      icon: <Clock className="w-4 h-4 stroke-[1.5]" />,
    },
    {
      id: 'statements-link',
      title: 'Student-wise No-Dues Statement',
      description: 'Direct generator for individual verifiable graduation clearance certificates.',
      icon: <FileCheck className="w-4 h-4 stroke-[1.5]" />,
      action: () => onNavigateToStatements(),
    },
    {
      id: 'batch-summary',
      title: 'Final Placement Summary for Selected Batch',
      description: 'Comprehensive institutional graduating cohort placement outcome summary.',
      icon: <FileSpreadsheet className="w-4 h-4 stroke-[1.5]" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* HUB VIEW: CARD GRID */}
      {activeReport === 'hub' ? (
        <div className="space-y-6">
          <PageHeader
            title="Institutional Reports Hub"
            subtitle="Curated official audit reports for placement accreditation, company recruitment outcomes, and matriculation clearances."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportCards.map((rc) => (
              <div
                key={rc.id}
                onClick={
                  rc.action ? rc.action : () => setActiveReport(rc.id as ReportType)
                }
                className="bg-white border border-[#E4DFD3] rounded-[6px] p-5 hover:border-[#1F4D3F] hover:bg-[#FAF8F3] transition-colors cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-[4px] bg-[#FAF8F3] border border-[#E4DFD3] flex items-center justify-center text-[#1F4D3F] mb-3 group-hover:bg-white">
                    {rc.icon}
                  </div>
                  <h3 className="font-serif text-base font-medium text-[#1C1F1D] group-hover:text-[#1F4D3F] transition-colors">
                    {rc.title}
                  </h3>
                  <p className="text-xs text-[#6B6F6A] mt-1.5 leading-relaxed">
                    {rc.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#F2EFE9] flex items-center justify-between text-xs font-semibold text-[#1F4D3F]">
                  <span>Open report</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* INDIVIDUAL REPORT VIEW */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E4DFD3]">
            <div>
              <button
                onClick={() => setActiveReport('hub')}
                className="text-xs text-[#1F4D3F] hover:underline mb-1 inline-flex items-center gap-1 cursor-pointer no-print"
              >
                ← Back to reports hub
              </button>
              <h1 className="font-serif text-2xl font-medium text-[#1C1F1D]">
                {reportCards.find((r) => r.id === activeReport)?.title}
              </h1>
              <p className="text-xs text-[#6B6F6A] mt-0.5">{filterSummaryString}</p>
            </div>

            <div className="flex items-center gap-2 no-print shrink-0">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => window.print()}
              >
                Print
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (activeReport === 'dept-stats') handleExportCSV('apex_dept_stats', deptStatsData);
                  if (activeReport === 'company-outcomes') handleExportCSV('apex_company_outcomes', companyOutcomesData);
                  if (activeReport === 'student-history') handleExportCSV('apex_student_history', studentHistoryData);
                  if (activeReport === 'unplaced-list') handleExportCSV('apex_unplaced_students', unplacedListData);
                  if (activeReport === 'pending-nodues') handleExportCSV('apex_pending_nodues', pendingNoDuesData);
                }}
              >
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (activeReport === 'dept-stats') handleExportExcel('apex_dept_stats', deptStatsData);
                  if (activeReport === 'company-outcomes') handleExportExcel('apex_company_outcomes', companyOutcomesData);
                  if (activeReport === 'student-history') handleExportExcel('apex_student_history', studentHistoryData);
                  if (activeReport === 'unplaced-list') handleExportExcel('apex_unplaced_students', unplacedListData);
                  if (activeReport === 'pending-nodues') handleExportExcel('apex_pending_nodues', pendingNoDuesData);
                }}
              >
                Export Excel
              </Button>
            </div>
          </div>

          {/* Report Filter Bar */}
          <div className="no-print">
            <FilterBar
              fields={filterFields}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
            />
          </div>

          {/* ========================================================= */}
          {/* REPORT 1: Department Statistics */}
          {/* ========================================================= */}
          {activeReport === 'dept-stats' && (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Department</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Registered</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Eligible</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Placed (Unique)</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Total Offers</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Placed %</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Highest Pkg</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Average Pkg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {deptStatsData.map((row) => (
                      <tr key={row.department} className="hover:bg-[#FAF8F3] h-10">
                        <td className="px-4 py-2 font-medium text-[#1C1F1D]">{row.department}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.registered}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.eligible}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1F4D3F]">{row.placed}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.offers}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1C1F1D]">{row.placedPct}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#1C1F1D]">{row.highestPkg}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.avgPkg}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary Row */}
                  <tfoot className="bg-[#FAF8F3] border-t-2 border-[#E4DFD3] font-semibold text-[#1C1F1D]">
                    <tr className="h-10">
                      <td className="px-4 py-2">Total / Institution Overall</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {deptStatsData.reduce((s, r) => s + r.registered, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {deptStatsData.reduce((s, r) => s + r.eligible, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#1F4D3F]">
                        {deptStatsData.reduce((s, r) => s + r.placed, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {deptStatsData.reduce((s, r) => s + r.offers, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold">
                        {getPlacementPercentage(students, applications, drives)}%
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">—</td>
                      <td className="px-4 py-2 text-right tabular-nums">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* ========================================================= */}
          {/* REPORT 2: Company Outcomes */}
          {/* ========================================================= */}
          {activeReport === 'company-outcomes' && (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Company</th>
                      <th className="px-4 py-2.5 font-semibold">Role</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Package</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Applications</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Shortlisted</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Offers Given</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {companyOutcomesData.map((row) => (
                      <tr key={row.company} className="hover:bg-[#FAF8F3] h-10">
                        <td className="px-4 py-2 font-medium text-[#1C1F1D]">{row.company}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.role}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1F4D3F]">
                          {row.package}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.registered}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.shortlisted}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1E5631]">{row.offers}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1C1F1D]">{row.joined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ========================================================= */}
          {/* REPORT 3: Student History */}
          {/* ========================================================= */}
          {activeReport === 'student-history' && (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Roll No</th>
                      <th className="px-4 py-2.5 font-semibold">Student Name</th>
                      <th className="px-4 py-2.5 font-semibold">Department</th>
                      <th className="px-4 py-2.5 font-semibold">Batch</th>
                      <th className="px-4 py-2.5 font-semibold">Company</th>
                      <th className="px-4 py-2.5 font-semibold">Role</th>
                      <th className="px-4 py-2.5 font-semibold">Stage</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Package</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {studentHistoryData.map((row, i) => (
                      <tr key={i} className="hover:bg-[#FAF8F3] h-10">
                        <td className="px-4 py-2 font-mono font-medium text-[#1C1F1D]">{row.rollNo}</td>
                        <td className="px-4 py-2 font-medium text-[#1C1F1D]">{row.name}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.department}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.batch}</td>
                        <td className="px-4 py-2 font-medium text-[#1C1F1D]">{row.company}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.role}</td>
                        <td className="px-4 py-2">
                          <StatusChip status={row.stage} size="sm" />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#1F4D3F] font-semibold">{row.package}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ========================================================= */}
          {/* REPORT 4: Unplaced List */}
          {/* ========================================================= */}
          {activeReport === 'unplaced-list' && (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Roll No</th>
                      <th className="px-4 py-2.5 font-semibold">Student Name</th>
                      <th className="px-4 py-2.5 font-semibold">Department</th>
                      <th className="px-4 py-2.5 font-semibold">Batch</th>
                      <th className="px-4 py-2.5 font-semibold text-right">CGPA</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Backlogs</th>
                      <th className="px-4 py-2.5 font-semibold">Email</th>
                      <th className="px-4 py-2.5 font-semibold">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {unplacedListData.map((row) => (
                      <tr key={row.rollNo} className="hover:bg-[#FAF8F3] h-10">
                        <td className="px-4 py-2 font-mono font-medium text-[#1C1F1D]">{row.rollNo}</td>
                        <td className="px-4 py-2 font-medium text-[#1C1F1D]">{row.name}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.department}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.batch}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1C1F1D]">{row.cgpa}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.backlogs}</td>
                        <td className="px-4 py-2 font-mono text-[#6B6F6A]">{row.email}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ========================================================= */}
          {/* REPORT 5: Pending No-Dues List */}
          {/* ========================================================= */}
          {activeReport === 'pending-nodues' && (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Roll No</th>
                      <th className="px-4 py-2.5 font-semibold">Student Name</th>
                      <th className="px-4 py-2.5 font-semibold">Department</th>
                      <th className="px-4 py-2.5 font-semibold">Batch</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Cleared</th>
                      <th className="px-4 py-2.5 font-semibold">Outstanding Dues / Requirements</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {pendingNoDuesData.map((row) => (
                      <tr key={row.rollNo} className="hover:bg-[#FAF8F3] h-10">
                        <td className="px-4 py-2 font-mono font-medium text-[#1C1F1D]">{row.rollNo}</td>
                        <td className="px-4 py-2 font-medium text-[#1C1F1D]">{row.name}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.department}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{row.batch}</td>
                        <td className="px-4 py-2">
                          <StatusChip status={row.overallStatus} size="sm" />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{row.clearedCount}</td>
                        <td className="px-4 py-2 text-[#9E2A2B] text-xs">{row.pendingItems}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ========================================================= */}
          {/* REPORT 7: Final Batch Summary */}
          {/* ========================================================= */}
          {activeReport === 'batch-summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md">
                  <span className="text-[11px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                    Graduating Cohort
                  </span>
                  <span className="font-serif text-3xl font-medium text-[#1C1F1D] tabular-nums mt-1 block">
                    Batch {batchSummaryStats.batch}
                  </span>
                  <p className="text-xs text-[#6B6F6A] mt-1">{batchSummaryStats.totalStudents} total enrolled</p>
                </Card>

                <Card padding="md">
                  <span className="text-[11px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                    Placement Conversion
                  </span>
                  <span className="font-serif text-3xl font-medium text-[#1E5631] tabular-nums mt-1 block">
                    {batchSummaryStats.placementPercentage}%
                  </span>
                  <p className="text-xs text-[#6B6F6A] mt-1">
                    {batchSummaryStats.placedCount} placed of {batchSummaryStats.eligibleCount} eligible
                  </p>
                </Card>

                <Card padding="md">
                  <span className="text-[11px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                    Total Valid Offers
                  </span>
                  <span className="font-serif text-3xl font-medium text-[#1F4D3F] tabular-nums mt-1 block">
                    {batchSummaryStats.totalOffers}
                  </span>
                  <p className="text-xs text-[#6B6F6A] mt-1">Across all drives</p>
                </Card>

                <Card padding="md">
                  <span className="text-[11px] uppercase font-semibold text-[#6B6F6A] tracking-wider block">
                    Average CTC
                  </span>
                  <span className="font-serif text-3xl font-medium text-[#1C1F1D] tabular-nums mt-1 block">
                    ₹{batchSummaryStats.averagePackage} LPA
                  </span>
                  <p className="text-xs text-[#6B6F6A] mt-1">Highest: ₹{batchSummaryStats.highestPackage} LPA</p>
                </Card>
              </div>

              {/* Department breakdown for this batch */}
              <Card padding="none" className="overflow-hidden">
                <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8]">
                  <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
                    Department Breakdown for Batch {batchSummaryStats.batch}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Department</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Enrolled</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Eligible</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Placed</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Offers</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Placed %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFD3]">
                      {allDepartments.map((dept) => {
                        const deptStus = students.filter(
                          (s) => s.department === dept && s.batch === batchSummaryStats.batch
                        );
                        const eligible = getRegisteredAndEligibleStudents(deptStus).length;
                        const deptApps = applications.filter((a) => {
                          const s = students.find((st) => st.id === a.studentId);
                          return s?.department === dept && s?.batch === batchSummaryStats.batch;
                        });
                        const placed = getUniquePlacedStudents(deptApps, drives, deptStus).length;
                        const validOffers = getValidOffers(deptApps, drives).length;
                        const pct = eligible > 0 ? Math.round((placed / eligible) * 1000) / 10 : 0;

                        return (
                          <tr key={dept} className="hover:bg-[#FAF8F3] h-10">
                            <td className="px-4 py-2 font-medium text-[#1C1F1D]">{dept}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{deptStus.length}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{eligible}</td>
                            <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1F4D3F]">{placed}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">{validOffers}</td>
                            <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1C1F1D]">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
