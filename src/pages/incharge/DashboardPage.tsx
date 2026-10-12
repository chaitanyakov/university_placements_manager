import React, { useState, useMemo } from 'react';
import {
  Student,
  Drive,
  Application,
  ClearanceCategory,
  ClearanceRecord,
  applyStudentFilters,
  applyDriveFilters,
  getRegisteredAndEligibleStudents,
  getValidOffers,
  getTotalOffers,
  getUniquePlacedStudents,
  getUniquePlacedCount,
  getPlacementPercentage,
  getPackageStats,
  getStudentNoDuesStatus,
  isApplicationValidOffer,
} from '../../services/placementNoDuesService';
import { StatCard } from '../../components/ui/StatCard';
import { Card, SectionHeader } from '../../components/ui/Card';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusChip } from '../../components/ui/StatusChip';
import { Tooltip, ProgressBar } from '../../components/ui/FeedbackComponents';
import {
  DeptPlacementBarChart,
  CompanyGroupedBarChart,
  BatchTrendLineChart,
  ApplicationFunnelChart,
  DeptClearanceStackedChart,
} from '../../components/dashboard/PlacementCharts';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Department } from '../../services/placementNoDuesService';

interface DashboardPageProps {
  students: Student[];
  drives: Drive[];
  applications: Application[];
  categories: ClearanceCategory[];
  clearances: ClearanceRecord[];
  departments?: Department[];
  onNavigate: (page: string, filterParams?: any) => void;
  onSelectStudent?: (student: Student) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  students,
  drives,
  applications,
  categories,
  clearances,
  departments = [],
  onNavigate,
  onSelectStudent,
}) => {
  // Empty State: when there are no students
  if (students.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E4DFD3] rounded-[8px] p-12 text-center max-w-lg mx-auto my-12 space-y-4">
          <p className="text-base text-[#1C1F1D] font-medium">
            Import students to see placement analytics
          </p>
          <div>
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('import-students')}
            >
              Import students
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Global Filter State
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [driveStatusFilter, setDriveStatusFilter] = useState('All');

  // Filter definitions live from departments collection
  const allDepartments = useMemo(() => {
    if (departments && departments.length > 0) {
      return departments.map((d) => d.name);
    }
    return [];
  }, [departments]);

  const allBatches = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.batch))).sort();
  }, [students]);

  const allCompanies = useMemo(() => {
    return Array.from(new Set(drives.map((d) => d.company))).sort();
  }, [drives]);

  const filterFields: FilterField[] = [
    {
      id: 'department',
      label: 'Department',
      value: departmentFilter,
      disabled: allDepartments.length === 0,
      options: [
        { label: allDepartments.length === 0 ? 'No departments yet' : 'All Departments', value: 'All' },
        ...allDepartments.map((d) => ({ label: d, value: d })),
      ],
    },
    {
      id: 'batch',
      label: 'Graduation Batch',
      value: batchFilter,
      options: [
        { label: 'All Batches', value: 'All' },
        ...allBatches.map((b) => ({ label: `Batch ${b}`, value: b })),
      ],
    },
    {
      id: 'company',
      label: 'Company',
      value: companyFilter,
      options: [
        { label: 'All Companies', value: 'All' },
        ...allCompanies.map((c) => ({ label: c, value: c })),
      ],
    },
    {
      id: 'driveStatus',
      label: 'Drive Status',
      value: driveStatusFilter,
      options: [
        { label: 'All Statuses', value: 'All' },
        { label: 'Planned', value: 'Planned' },
        { label: 'Open', value: 'Open' },
        { label: 'In Progress', value: 'In Progress' },
        { label: 'Completed', value: 'Completed' },
        { label: 'Cancelled', value: 'Cancelled' },
      ],
    },
  ];

  const handleFilterChange = (id: string, value: string) => {
    if (id === 'department') setDepartmentFilter(value);
    if (id === 'batch') setBatchFilter(value);
    if (id === 'company') setCompanyFilter(value);
    if (id === 'driveStatus') setDriveStatusFilter(value);
  };

  const handleResetFilters = () => {
    setDepartmentFilter('All');
    setBatchFilter('All');
    setCompanyFilter('All');
    setDriveStatusFilter('All');
  };

  // -------------------------------------------------------------
  // Filtered Datasets
  // -------------------------------------------------------------
  const filteredStudents = useMemo(() => {
    return applyStudentFilters(students, {
      department: departmentFilter,
      batch: batchFilter,
    });
  }, [students, departmentFilter, batchFilter]);

  const filteredDrives = useMemo(() => {
    return applyDriveFilters(drives, {
      department: departmentFilter,
      batch: batchFilter,
      company: companyFilter,
      driveStatus: driveStatusFilter,
    });
  }, [drives, departmentFilter, batchFilter, companyFilter, driveStatusFilter]);

  const filteredStudentIds = useMemo(
    () => new Set(filteredStudents.map((s) => s.id)),
    [filteredStudents]
  );
  const filteredDriveIds = useMemo(
    () => new Set(filteredDrives.map((d) => d.id)),
    [filteredDrives]
  );

  const filteredApplications = useMemo(() => {
    return applications.filter(
      (app) => filteredStudentIds.has(app.studentId) && filteredDriveIds.has(app.driveId)
    );
  }, [applications, filteredStudentIds, filteredDriveIds]);

  // -------------------------------------------------------------
  // Strict Placement Calculations
  // -------------------------------------------------------------
  const totalRegistered = filteredStudents.filter((s) => s.isRegistered).length;
  const eligibleStudents = getRegisteredAndEligibleStudents(filteredStudents);
  const eligibleCount = eligibleStudents.length;

  const participatingCount = useMemo(() => {
    const studentIdsInApps = new Set(filteredApplications.map((a) => a.studentId));
    return filteredStudents.filter((s) => studentIdsInApps.has(s.id)).length;
  }, [filteredStudents, filteredApplications]);

  const uniquePlaced = getUniquePlacedCount(filteredApplications, filteredDrives);
  const totalOffers = getTotalOffers(filteredApplications, filteredDrives);
  const notYetPlacedCount = Math.max(0, eligibleCount - uniquePlaced);
  const placementPct = getPlacementPercentage(filteredStudents, filteredApplications, filteredDrives);

  const packageStats = getPackageStats(filteredApplications, filteredDrives);

  // -------------------------------------------------------------
  // Chart 1: Department-wise placement %
  // -------------------------------------------------------------
  const deptPlacementData = useMemo(() => {
    const depts = departmentFilter === 'All' ? allDepartments : [departmentFilter];
    return depts.map((dept) => {
      const deptStudents = filteredStudents.filter((s) => s.department === dept);
      const deptApps = filteredApplications.filter((a) => {
        const stu = students.find((s) => s.id === a.studentId);
        return stu?.department === dept;
      });
      const eligible = getRegisteredAndEligibleStudents(deptStudents).length;
      const placed = getUniquePlacedCount(deptApps, filteredDrives);
      const pct = eligible > 0 ? Math.round((placed / eligible) * 1000) / 10 : 0;

      // Abbreviate long department names
      const short = dept
        .replace('Computer Science & Engineering', 'CSE')
        .replace('Electronics & Communication', 'ECE')
        .replace('Information Technology', 'IT')
        .replace('Mechanical Engineering', 'ME')
        .replace('Electrical & Electronics', 'EEE');

      return {
        department: dept,
        shortName: short,
        totalStudents: deptStudents.length,
        eligible,
        placed,
        percentage: pct,
      };
    });
  }, [allDepartments, departmentFilter, filteredStudents, filteredApplications, students, filteredDrives]);

  // -------------------------------------------------------------
  // Chart 2: Company-wise selections vs offers
  // -------------------------------------------------------------
  const companyChartData = useMemo(() => {
    const compMap = new Map<string, { selections: number; offers: number }>();
    filteredDrives
      .filter((d) => d.status !== 'Cancelled')
      .forEach((d) => {
        if (!compMap.has(d.company)) {
          compMap.set(d.company, { selections: 0, offers: 0 });
        }
      });

    filteredApplications.forEach((app) => {
      const drive = drives.find((d) => d.id === app.driveId);
      if (!drive || drive.status === 'Cancelled') return;

      const curr = compMap.get(drive.company) || { selections: 0, offers: 0 };
      if (app.stage === 'Selected' || app.stage === 'Offer' || app.stage === 'Joined') {
        curr.selections++;
      }
      if (app.stage === 'Offer' || app.stage === 'Joined') {
        curr.offers++;
      }
      compMap.set(drive.company, curr);
    });

    return Array.from(compMap.entries()).map(([company, stats]) => ({
      company,
      selections: stats.selections,
      offers: stats.offers,
    }));
  }, [filteredDrives, filteredApplications, drives]);

  // -------------------------------------------------------------
  // Chart 3: Batch Trends
  // -------------------------------------------------------------
  const batchTrendData = useMemo(() => {
    return allBatches.map((batch) => {
      const batchStudents = students.filter((s) => s.batch === batch);
      const batchApps = applications.filter((a) => {
        const s = students.find((st) => st.id === a.studentId);
        return s?.batch === batch;
      });
      const pct = getPlacementPercentage(batchStudents, batchApps, drives);
      return {
        batch,
        placementPercentage: pct,
        totalStudents: batchStudents.length,
      };
    });
  }, [allBatches, students, applications, drives]);

  // -------------------------------------------------------------
  // Chart 4: Funnel Stages
  // -------------------------------------------------------------
  const funnelData = useMemo(() => {
    // Only non-cancelled drives
    const validApps = filteredApplications.filter((a) => {
      const d = drives.find((drv) => drv.id === a.driveId);
      return d && d.status !== 'Cancelled';
    });

    const registered = validApps.length;
    const shortlisted = validApps.filter((a) =>
      ['Shortlisted', 'Assessment', 'Interview', 'Selected', 'Offer', 'Joined'].includes(a.stage)
    ).length;
    const selected = validApps.filter((a) =>
      ['Selected', 'Offer', 'Joined'].includes(a.stage)
    ).length;
    const offer = validApps.filter((a) => ['Offer', 'Joined'].includes(a.stage)).length;
    const joined = validApps.filter((a) => a.stage === 'Joined').length;

    return [
      { stage: 'Registered', count: registered },
      { stage: 'Shortlisted', count: shortlisted },
      { stage: 'Selected', count: selected },
      { stage: 'Offer Received', count: offer },
      { stage: 'Joined', count: joined },
    ];
  }, [filteredApplications, drives]);

  // -------------------------------------------------------------
  // Section B: No-Dues Calculations
  // -------------------------------------------------------------
  const studentClearanceStatuses = useMemo(() => {
    return filteredStudents.map((s) => {
      const res = getStudentNoDuesStatus(s.id, categories, clearances);
      return {
        student: s,
        ...res,
      };
    });
  }, [filteredStudents, categories, clearances]);

  const fullyClearedCount = studentClearanceStatuses.filter(
    (c) => c.status === 'Cleared'
  ).length;
  const pendingClearanceCount = studentClearanceStatuses.filter(
    (c) => c.status === 'Pending' || c.status === 'Incomplete'
  ).length;
  const rejectedClearanceCount = studentClearanceStatuses.filter(
    (c) => c.status === 'Rejected / Action Required'
  ).length;
  const overallClearancePct =
    filteredStudents.length > 0
      ? Math.round((fullyClearedCount / filteredStudents.length) * 1000) / 10
      : 0;

  // Chart 5: Dept Clearance Stacked Data
  const deptClearanceChartData = useMemo(() => {
    const depts = departmentFilter === 'All' ? allDepartments : [departmentFilter];
    return depts.map((dept) => {
      const deptList = studentClearanceStatuses.filter((s) => s.student.department === dept);
      const total = deptList.length;
      const cleared = deptList.filter((s) => s.status === 'Cleared').length;
      const pending = deptList.filter((s) => s.status === 'Pending' || s.status === 'Incomplete').length;
      const rejected = deptList.filter((s) => s.status === 'Rejected / Action Required').length;

      const short = dept
        .replace('Computer Science & Engineering', 'CSE')
        .replace('Electronics & Communication', 'ECE')
        .replace('Information Technology', 'IT')
        .replace('Mechanical Engineering', 'ME')
        .replace('Electrical & Electronics', 'EEE');

      return {
        department: dept,
        shortName: short,
        total,
        cleared,
        pending,
        rejected,
      };
    });
  }, [allDepartments, departmentFilter, studentClearanceStatuses]);

  // Department x Batch progress table
  const deptBatchClearanceRows = useMemo(() => {
    const rows: Array<{
      dept: string;
      batch: string;
      total: number;
      cleared: number;
      pending: number;
      rejected: number;
      pct: number;
    }> = [];

    const depts = departmentFilter === 'All' ? allDepartments : [departmentFilter];
    const batches = batchFilter === 'All' ? allBatches : [batchFilter];

    depts.forEach((dept) => {
      batches.forEach((batch) => {
        const cohort = studentClearanceStatuses.filter(
          (s) => s.student.department === dept && s.student.batch === batch
        );
        if (cohort.length === 0) return;

        const cleared = cohort.filter((s) => s.status === 'Cleared').length;
        const pending = cohort.filter((s) => s.status === 'Pending' || s.status === 'Incomplete').length;
        const rejected = cohort.filter((s) => s.status === 'Rejected / Action Required').length;
        const pct = Math.round((cleared / cohort.length) * 100);

        rows.push({
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

    return rows;
  }, [allDepartments, allBatches, departmentFilter, batchFilter, studentClearanceStatuses]);

  // Quick List: Rejected Clearances
  const rejectedStudentsList = useMemo(() => {
    return studentClearanceStatuses
      .filter((s) => s.status === 'Rejected / Action Required')
      .slice(0, 5);
  }, [studentClearanceStatuses]);

  // Quick List: Multiple Offers
  const multipleOffersList = useMemo(() => {
    const validOffers = getValidOffers(filteredApplications, filteredDrives);
    const offerMap = new Map<string, Application[]>();

    validOffers.forEach((o) => {
      const arr = offerMap.get(o.studentId) || [];
      arr.push(o);
      offerMap.set(o.studentId, arr);
    });

    const result: Array<{ student: Student; offers: Application[] }> = [];
    offerMap.forEach((apps, studentId) => {
      if (apps.length > 1) {
        const student = students.find((s) => s.id === studentId);
        if (student) {
          result.push({ student, offers: apps });
        }
      }
    });

    return result;
  }, [filteredApplications, filteredDrives, students]);

  // Quick List: Unplaced students
  const unplacedStudentsList = useMemo(() => {
    const placedStudents = getUniquePlacedStudents(
      filteredApplications,
      filteredDrives,
      filteredStudents
    );
    const placedIds = new Set(placedStudents.map((s) => s.id));
    return filteredStudents
      .filter((s) => s.isRegistered && s.isEligible && !placedIds.has(s.id))
      .slice(0, 6);
  }, [filteredApplications, filteredDrives, filteredStudents]);

  // Recently updated applications (last 8)
  const recentApplications = useMemo(() => {
    return [...filteredApplications]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);
  }, [filteredApplications]);

  return (
    <div className="space-y-8">
      {/* Top Global Filter Bar */}
      <div>
        <FilterBar
          fields={filterFields}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          activeCount={
            (departmentFilter !== 'All' ? 1 : 0) +
            (batchFilter !== 'All' ? 1 : 0) +
            (companyFilter !== 'All' ? 1 : 0) +
            (driveStatusFilter !== 'All' ? 1 : 0)
          }
        />
      </div>

      {/* ============================================================= */}
      {/* SECTION A: PLACEMENT PERFORMANCE */}
      {/* ============================================================= */}
      <section className="space-y-6">
        <SectionHeader
          title="Placement Performance"
          description="Institutional campus recruitment velocity, cohort placement conversion, and compensation statistics."
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B6F6A]">Cohort Conversion:</span>
              <span className="font-serif text-lg font-medium text-[#1F4D3F] tabular-nums">
                {placementPct}%
              </span>
            </div>
          }
        />

        {/* Row 1: 6 StatCards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <StatCard
            label="Total Registered"
            value={totalRegistered}
            caption="Registered on placement portal"
            onClick={() => onNavigate('students')}
          />
          <StatCard
            label="Eligible Students"
            value={eligibleCount}
            caption="Registered & clear of backlogs"
            onClick={() => onNavigate('students')}
          />
          <StatCard
            label="In Drives"
            value={participatingCount}
            caption="Applied to ≥1 active drive"
            onClick={() => onNavigate('applications')}
          />
          <StatCard
            label="Unique Placed"
            value={uniquePlaced}
            caption="Distinct placed students"
            highlight={true}
            onClick={() => onNavigate('reports', { reportId: 'student-history' })}
          />
          <StatCard
            label="Total Offers"
            value={totalOffers}
            caption="All valid offers across students"
            onClick={() => onNavigate('applications')}
          />
          <StatCard
            label="Not Yet Placed"
            value={notYetPlacedCount}
            caption="Eligible awaiting placement"
            onClick={() => onNavigate('reports', { reportId: 'unplaced-list' })}
          />
        </div>

        {/* Row 2: Highest Package & Average Package */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B6F6A]">
                Highest Package
              </span>
              <span className="text-xs text-[#1E5631] font-medium bg-[#EAF3ED] px-2 py-0.5 rounded">
                Verified Offer
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-serif text-3xl font-medium text-[#1C1F1D] tabular-nums">
                {packageStats.highest > 0 ? `₹${packageStats.highest.toFixed(1)} LPA` : 'No data'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#6B6F6A] border-t border-[#F0EEE9] pt-2">
              Highest confirmed compensation in current filtered selection
            </p>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B6F6A]">
                Average Package
              </span>
              <span className="text-xs text-[#6B6F6A] font-medium">
                {packageStats.countWithPackage} valid offers with package
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-serif text-3xl font-medium text-[#1C1F1D] tabular-nums">
                {packageStats.average > 0 ? `₹${packageStats.average.toFixed(1)} LPA` : 'No data'}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#6B6F6A] border-t border-[#F0EEE9] pt-2">
              {packageStats.countWithPackage > 0
                ? `Based on ${packageStats.countWithPackage} offers with package data`
                : 'No package data available'}
            </p>
          </Card>
        </div>

        {/* 4 Flat Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Department-wise placement % */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                Department-wise Placement %
              </h3>
              <span className="text-xs text-[#6B6F6A]">Unique Placed / Eligible</span>
            </div>
            <DeptPlacementBarChart data={deptPlacementData.filter((d) => (d.totalStudents ?? 0) > 0)} />
          </Card>

          {/* Chart 2: Company-wise selections vs offers */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                Company-wise Selections vs Offers
              </h3>
              <span className="text-xs text-[#6B6F6A]">Non-cancelled drives</span>
            </div>
            <CompanyGroupedBarChart data={companyChartData} />
          </Card>

          {/* Chart 3: Placement trend across batches */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                Placement Trend Across Batches
              </h3>
              <span className="text-xs text-[#6B6F6A]">Cohort Comparison</span>
            </div>
            <BatchTrendLineChart data={batchTrendData} />
          </Card>

          {/* Chart 4: Application stage funnel */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                Application Stage Funnel
              </h3>
              <span className="text-xs text-[#6B6F6A]">Recruitment Pipeline</span>
            </div>
            <ApplicationFunnelChart data={funnelData} />
          </Card>
        </div>

        {/* Tables & Quick Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Comparison Table (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <Card padding="none" className="overflow-hidden">
              <div className="p-4 border-b border-[#E4DFD3] flex items-center justify-between bg-[#FCFBF8]">
                <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                  Department Comparison
                </h3>
                <button
                  onClick={() => onNavigate('reports', { reportId: 'dept-stats' })}
                  className="text-xs text-[#1F4D3F] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Detailed report</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Department</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Eligible</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Placed</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Offers</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Placed %</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Avg Package</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {deptPlacementData.map((dept) => {
                      // Calculate average package for dept
                      const deptValidApps = filteredApplications.filter((a) => {
                        const st = students.find((s) => s.id === a.studentId);
                        return (
                          st?.department === dept.department &&
                          isApplicationValidOffer(a, filteredDrives)
                        );
                      });
                      const deptPkg = getPackageStats(deptValidApps, filteredDrives);

                      return (
                        <tr key={dept.department} className="hover:bg-[#FAF8F3] h-10">
                          <td className="px-4 py-2 font-medium text-[#1C1F1D]">
                            {dept.department}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">
                            {dept.eligible}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1F4D3F]">
                            {dept.placed}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">
                            {deptValidApps.length}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1C1F1D]">
                            {dept.percentage}%
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">
                            {deptPkg.average > 0 ? `₹${deptPkg.average} L` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Recently Updated Applications (last 8) */}
            <Card padding="none" className="overflow-hidden">
              <div className="p-4 border-b border-[#E4DFD3] flex items-center justify-between bg-[#FCFBF8]">
                <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                  Recently Updated Applications
                </h3>
                <button
                  onClick={() => onNavigate('applications')}
                  className="text-xs text-[#1F4D3F] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>View all tracker</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Student</th>
                      <th className="px-4 py-2.5 font-semibold">Company & Role</th>
                      <th className="px-4 py-2.5 font-semibold">Current Stage</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Package</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {recentApplications.map((app) => {
                      const student = students.find((s) => s.id === app.studentId);
                      return (
                        <tr key={app.id} className="hover:bg-[#FAF8F3] h-10">
                          <td className="px-4 py-2 font-medium text-[#1C1F1D]">
                            {student?.name || 'Student'}
                            <span className="text-[#6B6F6A] text-[11px] block font-mono">
                              {student?.rollNo}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-[#1C1F1D]">
                            <span className="font-medium">{app.company}</span>
                            <span className="text-[#6B6F6A] text-[11px] block">{app.role}</span>
                          </td>
                          <td className="px-4 py-2">
                            <StatusChip status={app.stage} size="sm" />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">
                            {app.packageLpa ? `₹${app.packageLpa} LPA` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#6B6F6A]">
                            {app.updatedAt}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Quick Lists (1 col) */}
          <div className="space-y-6">
            {/* Multiple Offers List */}
            <Card padding="none">
              <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
                <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
                  Students with Multiple Offers ({multipleOffersList.length})
                </h3>
              </div>
              <div className="divide-y divide-[#E4DFD3]">
                {multipleOffersList.length === 0 ? (
                  <div className="p-4 text-xs text-[#6B6F6A] text-center">
                    No students currently hold multiple offers.
                  </div>
                ) : (
                  multipleOffersList.map(({ student, offers }) => {
                    const companiesList = offers.map((o) => `${o.company} (₹${o.packageLpa || '—'} LPA)`).join(', ');
                    return (
                      <div
                        key={student.id}
                        className="p-3.5 hover:bg-[#FAF8F3] transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-medium text-[#1C1F1D]">{student.name}</p>
                          <p className="text-[11px] text-[#6B6F6A]">
                            {student.rollNo} · {student.department}
                          </p>
                        </div>
                        <Tooltip content={companiesList}>
                          <span className="text-xs font-semibold bg-[#E7F5F5] text-[#13595B] border border-[#C3E4E4] px-2 py-0.5 rounded cursor-help">
                            {offers.length} offers
                          </span>
                        </Tooltip>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Unplaced Students Quick List */}
            <Card padding="none">
              <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
                <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
                  Unplaced Eligible Students
                </h3>
                <button
                  onClick={() => onNavigate('reports', { reportId: 'unplaced-list' })}
                  className="text-xs text-[#1F4D3F] hover:underline font-medium cursor-pointer"
                >
                  View all
                </button>
              </div>
              <div className="divide-y divide-[#E4DFD3]">
                {unplacedStudentsList.length === 0 ? (
                  <div className="p-4 text-xs text-[#6B6F6A] text-center">
                    All eligible students are placed!
                  </div>
                ) : (
                  unplacedStudentsList.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => onSelectStudent && onSelectStudent(st)}
                      className="p-3 hover:bg-[#FAF8F3] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-medium text-[#1C1F1D]">{st.name}</p>
                        <p className="text-[11px] text-[#6B6F6A]">
                          {st.rollNo} · CGPA {st.cgpa}
                        </p>
                      </div>
                      <StatusChip status="Unplaced" size="sm" />
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION B: NO-DUES COMPLETION */}
      {/* ============================================================= */}
      <section className="space-y-6 pt-4 border-t-2 border-[#E4DFD3]">
        <SectionHeader
          title="No-Dues Completion"
          description="Graduation clearance status across Library, Laboratory, Department, Placement Office, and Accounts."
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B6F6A]">Overall Clearance:</span>
              <span className="font-serif text-lg font-medium text-[#1E5631] tabular-nums">
                {overallClearancePct}%
              </span>
            </div>
          }
        />

        {/* KPI Row (4 StatCards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Fully Cleared"
            value={fullyClearedCount}
            caption="All mandatory clearances satisfied"
            highlight={true}
            onClick={() => onNavigate('clearance-grid', { filterStatus: 'Cleared' })}
          />
          <StatCard
            label="Pending Incomplete"
            value={pendingClearanceCount}
            caption="Awaiting verification or returns"
            onClick={() => onNavigate('clearance-grid', { filterStatus: 'Pending' })}
          />
          <StatCard
            label="Rejected / Action Required"
            value={rejectedClearanceCount}
            caption="Outstanding dues or penalties"
            onClick={() => onNavigate('clearance-grid', { filterStatus: 'Rejected' })}
          />
          <StatCard
            label="Overall Completion"
            value={`${overallClearancePct}%`}
            caption={`${fullyClearedCount} of ${filteredStudents.length} students cleared`}
            onClick={() => onNavigate('clearance-grid')}
          />
        </div>

        {/* Stacked Chart + Dept x Batch Table + Rejected List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Clearance Stacked Chart */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                Department Clearance Breakdown
              </h3>
              <span className="text-xs text-[#6B6F6A]">Cleared vs Pending vs Rejected</span>
            </div>
            <DeptClearanceStackedChart data={deptClearanceChartData.filter((d) => d.total > 0)} />
          </Card>

          {/* Students with Rejected Clearances List */}
          <Card padding="none">
            <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
                  Students with Rejected Clearances ({rejectedClearanceCount})
                </h3>
                <p className="text-xs text-[#6B6F6A] mt-0.5">
                  Action required by student before clearance statement can be issued
                </p>
              </div>
            </div>
            <div className="divide-y divide-[#E4DFD3] max-h-72 overflow-y-auto">
              {rejectedStudentsList.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6B6F6A]">
                  No clearance rejections currently recorded.
                </div>
              ) : (
                rejectedStudentsList.map((item) => (
                  <div key={item.student.id} className="p-3.5 hover:bg-[#FAF8F3]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#1C1F1D]">
                          {item.student.name} ({item.student.rollNo})
                        </p>
                        <p className="text-[11px] text-[#6B6F6A]">
                          {item.student.department} · Batch {item.student.batch}
                        </p>
                      </div>
                      <StatusChip status="Rejected / Action Required" size="sm" />
                    </div>
                    <div className="mt-2 text-xs text-[#9E2A2B] bg-[#FCECEE] p-2 rounded border border-[#F6C6CA]">
                      <span className="font-medium">Category:</span> {item.rejectedCategories.join(', ') || 'Dues'}
                      {item.pendingRequirements.length > 0 && (
                        <p className="mt-1 text-[11px] text-[#1C1F1D]">
                          {item.pendingRequirements[0]}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Department x Batch Progress Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
            <h3 className="font-serif text-base font-medium text-[#1C1F1D]">
              Department × Batch Clearance Progress
            </h3>
            <button
              onClick={() => onNavigate('clearance-grid')}
              className="text-xs text-[#1F4D3F] hover:underline font-medium cursor-pointer"
            >
              Open Clearance Grid
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">Batch</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Students</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Cleared</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Pending</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Rejected</th>
                  <th className="px-4 py-2.5 font-semibold w-48">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFD3]">
                {deptBatchClearanceRows.map((row) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
};
