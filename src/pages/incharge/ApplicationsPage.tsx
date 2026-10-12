import React, { useState, useMemo } from 'react';
import {
  Application,
  ApplicationStage,
  Student,
  Drive,
  getValidOffers,
  isApplicationValidOffer,
} from '../../services/placementNoDuesService';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusChip } from '../../components/ui/StatusChip';
import { Drawer } from '../../components/ui/Drawer';
import { Tooltip, PageHeader } from '../../components/ui/FeedbackComponents';
import { useToast } from '../../components/ui/Toast';
import { History, Clock, ArrowRight } from 'lucide-react';

import { Department } from '../../services/placementNoDuesService';

interface ApplicationsPageProps {
  applications: Application[];
  onUpdateApplications: (apps: Application[]) => void;
  students: Student[];
  drives: Drive[];
  departments?: Department[];
  onSelectStudent?: (student: Student) => void;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  applications,
  onUpdateApplications,
  students,
  drives,
  departments = [],
  onSelectStudent,
}) => {
  const { showToast } = useToast();

  // Filters
  const [deptFilter, setDeptFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [driveStatusFilter, setDriveStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Timeline History Drawer
  const [historyDrawerApp, setHistoryDrawerApp] = useState<Application | null>(null);

  // Undo state storage
  const [undoSnapshot, setUndoSnapshot] = useState<{
    appId: string;
    previousStage: ApplicationStage;
  } | null>(null);

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
  const allCompanies = useMemo(
    () => Array.from(new Set(drives.map((d) => d.company))).sort(),
    [drives]
  );

  const filterFields: FilterField[] = [
    {
      id: 'dept',
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
      id: 'company',
      label: 'Company',
      value: companyFilter,
      options: [
        { label: 'All Companies', value: 'All' },
        ...allCompanies.map((c) => ({ label: c, value: c })),
      ],
    },
    {
      id: 'stage',
      label: 'Stage',
      value: stageFilter,
      options: [
        { label: 'All Stages', value: 'All' },
        { label: 'Registered', value: 'Registered' },
        { label: 'Shortlisted', value: 'Shortlisted' },
        { label: 'Assessment', value: 'Assessment' },
        { label: 'Interview', value: 'Interview' },
        { label: 'Selected', value: 'Selected' },
        { label: 'Offer', value: 'Offer' },
        { label: 'Joined', value: 'Joined' },
        { label: 'Rejected', value: 'Rejected' },
        { label: 'Withdrawn', value: 'Withdrawn' },
      ],
    },
    {
      id: 'driveStatus',
      label: 'Drive Status',
      value: driveStatusFilter,
      options: [
        { label: 'All Statuses', value: 'All' },
        { label: 'Open', value: 'Open' },
        { label: 'In Progress', value: 'In Progress' },
        { label: 'Completed', value: 'Completed' },
        { label: 'Cancelled', value: 'Cancelled' },
      ],
    },
  ];

  const handleFilterChange = (id: string, val: string) => {
    if (id === 'dept') setDeptFilter(val);
    if (id === 'batch') setBatchFilter(val);
    if (id === 'company') setCompanyFilter(val);
    if (id === 'stage') setStageFilter(val);
    if (id === 'driveStatus') setDriveStatusFilter(val);
  };

  const handleResetFilters = () => {
    setDeptFilter('All');
    setBatchFilter('All');
    setCompanyFilter('All');
    setStageFilter('All');
    setDriveStatusFilter('All');
    setSearchQuery('');
  };

  // Map of studentId -> Valid Offers Count & list of companies
  const multipleOffersMap = useMemo(() => {
    const validOffers = getValidOffers(applications, drives);
    const map = new Map<string, Application[]>();
    validOffers.forEach((o) => {
      const arr = map.get(o.studentId) || [];
      arr.push(o);
      map.set(o.studentId, arr);
    });
    return map;
  }, [applications, drives]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const student = students.find((s) => s.id === app.studentId);
      const drive = drives.find((d) => d.id === app.driveId);

      if (deptFilter !== 'All' && student?.department !== deptFilter) return false;
      if (batchFilter !== 'All' && student?.batch !== batchFilter) return false;
      if (companyFilter !== 'All' && app.company !== companyFilter) return false;
      if (stageFilter !== 'All' && app.stage !== stageFilter) return false;
      if (driveStatusFilter !== 'All' && drive?.status !== driveStatusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mName = student?.name.toLowerCase().includes(q);
        const mRoll = student?.rollNo.toLowerCase().includes(q);
        const mCo = app.company.toLowerCase().includes(q);
        const mRole = app.role.toLowerCase().includes(q);
        if (!mName && !mRoll && !mCo && !mRole) return false;
      }

      return true;
    });
  }, [
    applications,
    students,
    drives,
    deptFilter,
    batchFilter,
    companyFilter,
    stageFilter,
    driveStatusFilter,
    searchQuery,
  ]);

  // Inline Stage Change with 5-second Undo action
  const handleStageChange = (appId: string, newStage: ApplicationStage) => {
    const targetApp = applications.find((a) => a.id === appId);
    if (!targetApp) return;

    const previousStage = targetApp.stage;
    const today = new Date().toISOString().split('T')[0];

    const updated = applications.map((a) => {
      if (a.id === appId) {
        return {
          ...a,
          stage: newStage,
          updatedAt: today,
          stageHistory: [...a.stageHistory, { stage: newStage, timestamp: today }],
        };
      }
      return a;
    });

    onUpdateApplications(updated);
    setUndoSnapshot({ appId, previousStage });

    showToast({
      type: 'success',
      message: `Stage updated to ${newStage}`,
      duration: 5000,
      action: {
        label: 'Undo (5s)',
        onClick: () => {
          const reverted = applications.map((a) => {
            if (a.id === appId) {
              return {
                ...a,
                stage: previousStage,
                stageHistory: a.stageHistory.slice(0, -1),
              };
            }
            return a;
          });
          onUpdateApplications(reverted);
          showToast({ type: 'info', message: `Stage reverted back to ${previousStage}` });
        },
      },
    });
  };

  // Table Columns
  const columns: Column<Application>[] = [
    {
      key: 'student',
      header: 'Student',
      sortable: true,
      sortValue: (app) => students.find((s) => s.id === app.studentId)?.name || '',
      render: (app) => {
        const student = students.find((s) => s.id === app.studentId);
        const validOffers = multipleOffersMap.get(app.studentId) || [];
        const hasMultipleOffers = validOffers.length > 1;

        return (
          <div className="flex items-center gap-2">
            <div>
              <span className="font-medium text-[#1C1F1D]">{student?.name}</span>
              <span className="text-[11px] text-[#6B6F6A] block font-mono">
                {student?.rollNo}
              </span>
            </div>
            {hasMultipleOffers && (
              <Tooltip
                content={`Holding ${validOffers.length} valid offers: ${validOffers
                  .map((o) => `${o.company} (₹${o.packageLpa || '—'} L)`)
                  .join(', ')}`}
              >
                <span className="text-[10px] font-semibold bg-[#E7F5F5] text-[#13595B] border border-[#C3E4E4] px-1.5 py-0.2 rounded cursor-help">
                  {validOffers.length} offers
                </span>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      key: 'department',
      header: 'Dept & Batch',
      render: (app) => {
        const student = students.find((s) => s.id === app.studentId);
        return (
          <span className="text-xs text-[#6B6F6A]">
            {student?.department.replace(' Engineering', '').replace('Information Technology', 'IT')} · '{student?.batch.slice(-2)}
          </span>
        );
      },
    },
    {
      key: 'company',
      header: 'Company & Role',
      sortable: true,
      render: (app) => {
        const drive = drives.find((d) => d.id === app.driveId);
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#1C1F1D]">{app.company}</span>
              {drive?.status === 'Cancelled' && (
                <span className="text-[10px] text-[#9E2A2B] bg-[#FCECEE] px-1 py-0.2 rounded">
                  Drive Cancelled
                </span>
              )}
            </div>
            <span className="text-[11px] text-[#6B6F6A] block">{app.role}</span>
          </div>
        );
      },
    },
    {
      key: 'stage',
      header: 'Stage',
      sortable: true,
      render: (app) => {
        return (
          <div className="flex items-center gap-2">
            <select
              value={app.stage}
              onChange={(e) =>
                handleStageChange(app.id, e.target.value as ApplicationStage)
              }
              className="h-7 text-xs bg-white border border-[#E4DFD3] rounded px-1.5 text-[#1C1F1D] cursor-pointer hover:border-[#1F4D3F] focus:outline-none"
            >
              <option value="Registered">Registered</option>
              <option value="Eligibility Verified">Eligibility Verified</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Assessment">Assessment</option>
              <option value="Interview">Interview</option>
              <option value="Selected">Selected</option>
              <option value="Offer">Offer</option>
              <option value="Joined">Joined</option>
              <option value="Rejected">Rejected</option>
              <option value="Withdrawn">Withdrawn</option>
            </select>
            <StatusChip status={app.stage} size="sm" />
          </div>
        );
      },
    },
    {
      key: 'packageLpa',
      header: 'Package',
      align: 'right',
      sortable: true,
      render: (app) => (
        <span className="tabular-nums font-medium text-[#1C1F1D]">
          {app.packageLpa ? `₹${app.packageLpa} LPA` : '—'}
        </span>
      ),
    },
    {
      key: 'isOfferPublished',
      header: 'Published',
      align: 'center',
      render: (app) => (
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            app.isOfferPublished
              ? 'bg-[#EAF3ED] text-[#1E5631]'
              : 'bg-[#F0EEE9] text-[#6B6F6A]'
          }`}
        >
          {app.isOfferPublished ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      align: 'right',
      render: (app) => <span className="tabular-nums text-[#6B6F6A]">{app.updatedAt}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications Tracker"
        subtitle="Real-time multi-drive recruitment tracker with inline stage updates, offer publishing, and multiple-offer detection."
      />

      {/* Filter Bar */}
      <FilterBar
        fields={filterFields}
        onFilterChange={handleFilterChange}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by student name, roll no, company, role..."
        onReset={handleResetFilters}
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredApplications}
        keyField="id"
        pageSize={15}
        exportFilename="apex_applications_tracker"
        rowActions={(app) => (
          <button
            onClick={() => setHistoryDrawerApp(app)}
            className="p-1.5 text-[#6B6F6A] hover:text-[#1F4D3F] hover:bg-[#FAF8F3] rounded cursor-pointer transition-colors"
            title="View stage history timeline"
          >
            <History className="w-4 h-4" />
          </button>
        )}
        rowDimmed={(app) => {
          const drive = drives.find((d) => d.id === app.driveId);
          return (
            app.stage === 'Rejected' ||
            app.stage === 'Withdrawn' ||
            drive?.status === 'Cancelled'
          );
        }}
        rowTooltip={(app) => {
          const drive = drives.find((d) => d.id === app.driveId);
          if (drive?.status === 'Cancelled') {
            return 'Drive is cancelled: excluded from placement statistics.';
          }
          if (app.stage === 'Rejected' || app.stage === 'Withdrawn') {
            return 'Not counted as placement (withdrawn/rejected).';
          }
          return undefined;
        }}
        emptyMessage={students.length === 0 ? "No students yet" : "No applications match the filter criteria."}
      />

      {/* ============================================================= */}
      {/* DRAWER: APPLICATION STAGE HISTORY TIMELINE */}
      {/* ============================================================= */}
      {historyDrawerApp && (
        <Drawer
          isOpen={!!historyDrawerApp}
          onClose={() => setHistoryDrawerApp(null)}
          title="Application History"
          subtitle={`${historyDrawerApp.company} · ${historyDrawerApp.role}`}
          width="md"
        >
          {(() => {
            const student = students.find((s) => s.id === historyDrawerApp.studentId);
            const drive = drives.find((d) => d.id === historyDrawerApp.driveId);

            return (
              <div className="space-y-6">
                {/* Candidate Summary Card */}
                <div className="p-3.5 bg-[#FAF8F3] border border-[#E4DFD3] rounded-[6px]">
                  <p className="text-xs font-semibold text-[#1C1F1D]">{student?.name}</p>
                  <p className="text-[11px] text-[#6B6F6A] font-mono mt-0.5">
                    {student?.rollNo} · {student?.department} · CGPA {student?.cgpa}
                  </p>
                  {historyDrawerApp.packageLpa && (
                    <p className="text-xs font-bold text-[#1E5631] mt-2">
                      Offer: ₹{historyDrawerApp.packageLpa} LPA
                    </p>
                  )}
                </div>

                {/* Vertical Stage Timeline */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] mb-3">
                    Stage Progression Timeline
                  </h4>

                  <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#E4DFD3]">
                    {historyDrawerApp.stageHistory.map((step, idx) => {
                      const isLatest = idx === historyDrawerApp.stageHistory.length - 1;

                      return (
                        <div key={idx} className="flex items-start gap-3 relative pl-6">
                          <div
                            className={`w-4 h-4 rounded-full border-2 absolute left-[3px] top-0.5 bg-white ${
                              isLatest
                                ? 'border-[#1F4D3F] bg-[#1F4D3F]'
                                : 'border-[#6B6F6A]'
                            }`}
                          />
                          <div className="flex-1 bg-white border border-[#E4DFD3] rounded-[4px] p-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[#1C1F1D]">
                                {step.stage}
                              </span>
                              <span className="text-[11px] text-[#6B6F6A] tabular-nums flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {step.timestamp}
                              </span>
                            </div>
                            {step.notes && (
                              <p className="text-[11px] text-[#6B6F6A] mt-1 italic">
                                {step.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {drive?.status === 'Cancelled' && (
                  <div className="p-3 bg-[#FCECEE] border border-[#F6C6CA] rounded text-xs text-[#9E2A2B]">
                    Notice: This drive is cancelled. This application does not count towards placement statistics.
                  </div>
                )}
              </div>
            );
          })()}
        </Drawer>
      )}
    </div>
  );
};
