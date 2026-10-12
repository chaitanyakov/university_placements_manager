import React, { useState, useMemo } from 'react';
import {
  Drive,
  Student,
  Application,
  ApplicationStage,
  applyDriveFilters,
} from '../../services/placementNoDuesService';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusChip } from '../../components/ui/StatusChip';
import { Drawer } from '../../components/ui/Drawer';
import { Tabs, FormField, PageHeader } from '../../components/ui/FeedbackComponents';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import {
  Plus,
  AlertTriangle,
  Kanban,
  Table as TableIcon,
  Check,
  CheckCircle2,
  Calendar,
  Building,
  MapPin,
  DollarSign,
  Users,
} from 'lucide-react';

import { Department } from '../../services/placementNoDuesService';

interface DrivesPageProps {
  drives: Drive[];
  onUpdateDrives: (drives: Drive[]) => void;
  students: Student[];
  applications: Application[];
  departments?: Department[];
  onUpdateApplications: (apps: Application[]) => void;
  onSelectStudent?: (student: Student) => void;
}

export const DrivesPage: React.FC<DrivesPageProps> = ({
  drives,
  onUpdateDrives,
  students,
  applications,
  departments = [],
  onUpdateApplications,
  onSelectStudent,
}) => {
  const { showToast } = useToast();

  // Selected drive for detail view
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const selectedDrive = useMemo(
    () => drives.find((d) => d.id === selectedDriveId) || null,
    [drives, selectedDriveId]
  );

  // Tabs in drive detail view
  const [activeDetailTab, setActiveDetailTab] = useState('overview');

  // Stage board view mode: kanban vs table
  const [boardViewMode, setBoardViewMode] = useState<'kanban' | 'table'>('kanban');

  // Status Filter tabs along top of drive list
  const [statusTab, setStatusTab] = useState('All');

  // Filters for Drives List
  const [companyFilter, setCompanyFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // New Drive Drawer State
  const [isNewDriveOpen, setIsNewDriveOpen] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDepts, setNewDepts] = useState<string[]>([]);
  const [newBatches, setNewBatches] = useState<string[]>(['2025']);
  const [newMinCgpa, setNewMinCgpa] = useState('7.5');
  const [newMaxBacklogs, setNewMaxBacklogs] = useState('0');
  const [newDeadline, setNewDeadline] = useState('2026-11-30');
  const [newStages, setNewStages] = useState<string[]>([
    'Registration',
    'Assessment',
    'Interview',
    'Offer',
  ]);
  const [stageInput, setStageInput] = useState('');
  const [newLocation, setNewLocation] = useState('Bengaluru');
  const [newPackage, setNewPackage] = useState('12.0');
  const [newStatus, setNewStatus] = useState<Drive['status']>('Open');

  // Cancel Drive Confirm Dialog
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Manual Add Student to Drive Modal
  const [isAddStudentManualOpen, setIsAddStudentManualOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');

  // Bulk Outcomes selection
  const [selectedOutcomeStudentIds, setSelectedOutcomeStudentIds] = useState<string[]>([]);
  const [bulkPackageInput, setBulkPackageInput] = useState('');

  // Compute status counts for top filter tabs
  const statusCounts = useMemo(() => {
    return {
      All: drives.length,
      Planned: drives.filter((d) => d.status === 'Planned').length,
      Open: drives.filter((d) => d.status === 'Open').length,
      'In Progress': drives.filter((d) => d.status === 'In Progress').length,
      Completed: drives.filter((d) => d.status === 'Completed').length,
      Cancelled: drives.filter((d) => d.status === 'Cancelled').length,
    };
  }, [drives]);

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
      id: 'company',
      label: 'Company',
      value: companyFilter,
      options: [
        { label: 'All Companies', value: 'All' },
        ...allCompanies.map((c) => ({ label: c, value: c })),
      ],
    },
    {
      id: 'department',
      label: 'Eligible Dept',
      value: deptFilter,
      disabled: allDepartments.length === 0,
      options: [
        { label: allDepartments.length === 0 ? 'No departments yet' : 'All Departments', value: 'All' },
        ...allDepartments.map((d) => ({ label: d, value: d })),
      ],
    },
    {
      id: 'batch',
      label: 'Eligible Batch',
      value: batchFilter,
      options: [
        { label: 'All Batches', value: 'All' },
        ...allBatches.map((b) => ({ label: `Batch ${b}`, value: b })),
      ],
    },
  ];

  const handleFilterChange = (id: string, val: string) => {
    if (id === 'company') setCompanyFilter(val);
    if (id === 'department') setDeptFilter(val);
    if (id === 'batch') setBatchFilter(val);
  };

  const handleResetFilters = () => {
    setCompanyFilter('All');
    setDeptFilter('All');
    setBatchFilter('All');
    setSearchQuery('');
    setStatusTab('All');
  };

  // Filtered drives list
  const filteredDrives = useMemo(() => {
    return applyDriveFilters(drives, {
      company: companyFilter,
      department: deptFilter,
      batch: batchFilter,
      driveStatus: statusTab !== 'All' ? statusTab : undefined,
      search: searchQuery,
    });
  }, [drives, companyFilter, deptFilter, batchFilter, statusTab, searchQuery]);

  // List View Columns
  const driveColumns: Column<Drive>[] = [
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      render: (d) => (
        <div>
          <span className="font-semibold text-[#1C1F1D]">{d.company}</span>
          <span className="text-[11px] text-[#6B6F6A] block">{d.role}</span>
        </div>
      ),
    },
    {
      key: 'eligibleDepartments',
      header: 'Eligible Depts',
      render: (d) => (
        <span className="text-xs text-[#6B6F6A] truncate max-w-[180px] block" title={d.eligibleDepartments.join(', ')}>
          {d.eligibleDepartments.length === allDepartments.length
            ? 'All Departments'
            : d.eligibleDepartments.map((dept) => dept.replace(' Engineering', '').replace('Information Technology', 'IT')).join(', ')}
        </span>
      ),
    },
    {
      key: 'eligibleBatches',
      header: 'Batches',
      render: (d) => <span className="tabular-nums">{d.eligibleBatches.join(', ')}</span>,
    },
    {
      key: 'deadline',
      header: 'Deadline',
      sortable: true,
      render: (d) => <span className="tabular-nums">{d.deadline}</span>,
    },
    {
      key: 'packageLpa',
      header: 'Package',
      sortable: true,
      align: 'right',
      render: (d) => <span className="font-medium tabular-nums">₹{d.packageLpa} LPA</span>,
    },
    {
      key: 'location',
      header: 'Location',
      render: (d) => <span className="truncate max-w-[120px] block">{d.location}</span>,
    },
    {
      key: 'registeredStudentIds',
      header: 'Registered',
      sortable: true,
      align: 'right',
      render: (d) => <span className="tabular-nums font-semibold">{d.registeredStudentIds.length}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (d) => <StatusChip status={d.status} size="sm" />,
    },
  ];

  // -------------------------------------------------------------
  // DRIVE DETAIL LOGIC
  // -------------------------------------------------------------
  const driveApplications = useMemo(() => {
    if (!selectedDrive) return [];
    return applications.filter((a) => a.driveId === selectedDrive.id);
  }, [applications, selectedDrive]);

  // Registered students evaluated with criteria check
  const registeredStudentsWithCriteria = useMemo(() => {
    if (!selectedDrive) return [];
    return selectedDrive.registeredStudentIds.map((stuId) => {
      const student = students.find((s) => s.id === stuId);
      if (!student) return null;

      const failsDept = !selectedDrive.eligibleDepartments.includes(student.department);
      const failsCgpa = student.cgpa < selectedDrive.minCgpa;
      const failsBacklogs = student.activeBacklogs > selectedDrive.maxBacklogs;
      const meetsCriteria = !failsDept && !failsCgpa && !failsBacklogs;

      let reason = 'Meets criteria';
      if (failsDept) reason = 'Department not eligible';
      else if (failsCgpa) reason = `Fails CGPA (${student.cgpa} < ${selectedDrive.minCgpa})`;
      else if (failsBacklogs) reason = `Fails backlogs (${student.activeBacklogs} active)`;

      const existingApp = driveApplications.find((a) => a.studentId === student.id);

      return {
        student,
        meetsCriteria,
        reason,
        application: existingApp,
      };
    }).filter(Boolean) as Array<{
      student: Student;
      meetsCriteria: boolean;
      reason: string;
      application?: Application;
    }>;
  }, [selectedDrive, students, driveApplications]);

  // Stage move handler
  const handleMoveStage = (appId: string, newStage: ApplicationStage) => {
    const updated = applications.map((a) => {
      if (a.id === appId) {
        return {
          ...a,
          stage: newStage,
          updatedAt: new Date().toISOString().split('T')[0],
          stageHistory: [
            ...a.stageHistory,
            { stage: newStage, timestamp: new Date().toISOString().split('T')[0] },
          ],
        };
      }
      return a;
    });
    onUpdateApplications(updated);
    showToast({
      type: 'success',
      message: `Moved application to stage: ${newStage}`,
    });
  };

  // Cancel drive handler
  const handleCancelDrive = () => {
    if (!selectedDrive) return;
    const updatedDrives = drives.map((d) =>
      d.id === selectedDrive.id ? { ...d, status: 'Cancelled' as const } : d
    );
    onUpdateDrives(updatedDrives);
    setIsCancelConfirmOpen(false);
    showToast({
      type: 'info',
      message: `Drive for ${selectedDrive.company} cancelled. Applications excluded from placement statistics.`,
    });
  };

  // Add Student Manually to Drive
  const handleAddStudentManually = () => {
    if (!selectedDrive || !manualStudentId) return;
    if (selectedDrive.registeredStudentIds.includes(manualStudentId)) {
      showToast({ type: 'error', message: 'Student is already registered in this drive.' });
      return;
    }

    const updatedDrive: Drive = {
      ...selectedDrive,
      registeredStudentIds: [...selectedDrive.registeredStudentIds, manualStudentId],
    };
    onUpdateDrives(drives.map((d) => (d.id === updatedDrive.id ? updatedDrive : d)));

    // Create application entry
    const newApp: Application = {
      id: `app-${Date.now()}`,
      studentId: manualStudentId,
      driveId: selectedDrive.id,
      company: selectedDrive.company,
      role: selectedDrive.role,
      stage: 'Registered',
      stageHistory: [{ stage: 'Registered', timestamp: new Date().toISOString().split('T')[0] }],
      isOfferPublished: false,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    onUpdateApplications([newApp, ...applications]);

    setIsAddStudentManualOpen(false);
    setManualStudentId('');
    showToast({ type: 'success', message: 'Student added manually to drive.' });
  };

  // Bulk outcomes
  const handleBulkMarkStage = (targetStage: ApplicationStage) => {
    if (selectedOutcomeStudentIds.length === 0 || !selectedDrive) return;

    const pkgNum = parseFloat(bulkPackageInput) || selectedDrive.packageLpa;
    const today = new Date().toISOString().split('T')[0];

    const updated = applications.map((a) => {
      if (a.driveId === selectedDrive.id && selectedOutcomeStudentIds.includes(a.studentId)) {
        return {
          ...a,
          stage: targetStage,
          packageLpa: targetStage === 'Offer' || targetStage === 'Selected' ? pkgNum : a.packageLpa,
          updatedAt: today,
          stageHistory: [...a.stageHistory, { stage: targetStage, timestamp: today }],
        };
      }
      return a;
    });

    onUpdateApplications(updated);
    showToast({
      type: 'success',
      message: `Updated ${selectedOutcomeStudentIds.length} students to ${targetStage}`,
    });
    setSelectedOutcomeStudentIds([]);
  };

  // Toggle Publish Offer
  const handleTogglePublish = (appId: string, currentPublished: boolean) => {
    const updated = applications.map((a) =>
      a.id === appId ? { ...a, isOfferPublished: !currentPublished } : a
    );
    onUpdateApplications(updated);
    showToast({
      type: 'success',
      message: !currentPublished ? 'Offer published to student portal' : 'Offer unpublished from student portal',
    });
  };

  // Create New Drive Submit
  const handleCreateNewDrive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newRole.trim()) {
      showToast({ type: 'error', message: 'Company and Role are required.' });
      return;
    }

    const createdDrive: Drive = {
      id: `drv-${Date.now()}`,
      company: newCompany.trim(),
      role: newRole.trim(),
      description: newDesc.trim() || `${newRole} recruitment at ${newCompany}`,
      eligibleDepartments: newDepts,
      eligibleBatches: newBatches,
      minCgpa: parseFloat(newMinCgpa) || 7.0,
      maxBacklogs: parseInt(newMaxBacklogs, 10) || 0,
      skills: ['Problem Solving', 'Core Engineering'],
      deadline: newDeadline,
      stages: newStages,
      location: newLocation.trim() || 'On-campus',
      packageLpa: parseFloat(newPackage) || 0,
      status: newStatus,
      registeredStudentIds: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    onUpdateDrives([createdDrive, ...drives]);
    setIsNewDriveOpen(false);
    showToast({
      type: 'success',
      message: `Created recruitment drive for ${createdDrive.company} (${createdDrive.role})`,
    });

    // Reset
    setNewCompany('');
    setNewRole('');
    setNewDesc('');
  };

  return (
    <div className="space-y-6">
      {/* If a drive is selected, show DRIVE DETAIL VIEW */}
      {selectedDrive ? (
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="bg-white border border-[#E4DFD3] rounded-[6px] p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#E4DFD3]">
              <div>
                <button
                  onClick={() => setSelectedDriveId(null)}
                  className="text-xs text-[#1F4D3F] hover:underline mb-1 inline-flex items-center gap-1 cursor-pointer"
                >
                  ← Back to all recruitment drives
                </button>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-serif text-2xl font-medium text-[#1C1F1D]">
                    {selectedDrive.company}
                  </h1>
                  <span className="text-[#6B6F6A]">/</span>
                  <span className="text-lg text-[#6B6F6A] font-medium">{selectedDrive.role}</span>
                  <StatusChip status={selectedDrive.status} />
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {selectedDrive.status !== 'Cancelled' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsCancelConfirmOpen(true)}
                  >
                    Cancel drive
                  </Button>
                )}
              </div>
            </div>

            {/* Cancelled Banner if cancelled */}
            {selectedDrive.status === 'Cancelled' && (
              <div className="mt-4 p-3 bg-[#FCECEE] border border-[#F6C6CA] rounded-[4px] text-xs text-[#9E2A2B] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">
                  This drive is cancelled. Its applications are excluded from placement statistics.
                </span>
              </div>
            )}

            {/* Drive Info Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
                  Package (LPA)
                </span>
                <span className="font-serif text-lg font-medium text-[#1C1F1D] tabular-nums">
                  ₹{selectedDrive.packageLpa} LPA
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
                  Deadline
                </span>
                <span className="font-medium text-[#1C1F1D] tabular-nums">
                  {selectedDrive.deadline}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
                  Min CGPA / Backlogs
                </span>
                <span className="font-medium text-[#1C1F1D] tabular-nums">
                  {selectedDrive.minCgpa} CGPA · Max {selectedDrive.maxBacklogs} backlogs
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
                  Location
                </span>
                <span className="font-medium text-[#1C1F1D]">{selectedDrive.location}</span>
              </div>
            </div>
          </div>

          {/* Drive Detail Tabs */}
          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              {
                id: 'registered',
                label: 'Registered Students',
                count: selectedDrive.registeredStudentIds.length,
              },
              { id: 'board', label: 'Stage Board' },
              { id: 'outcomes', label: 'Outcomes & Offers' },
            ]}
            activeTab={activeDetailTab}
            onChange={setActiveDetailTab}
          />

          {/* TAB 1: OVERVIEW */}
          {activeDetailTab === 'overview' && (
            <Card className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-medium text-[#1C1F1D]">Job Description</h3>
                <p className="text-xs text-[#6B6F6A] mt-1 leading-relaxed">
                  {selectedDrive.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E4DFD3] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-[#1C1F1D] block mb-1">
                    Eligible Departments:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedDrive.eligibleDepartments.map((dept) => (
                      <span
                        key={dept}
                        className="bg-[#FAF8F3] border border-[#E4DFD3] text-[#1C1F1D] px-2 py-0.5 rounded text-[11px]"
                      >
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-[#1C1F1D] block mb-1">
                    Eligible Batches:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedDrive.eligibleBatches.map((b) => (
                      <span
                        key={b}
                        className="bg-[#FAF8F3] border border-[#E4DFD3] text-[#1C1F1D] px-2 py-0.5 rounded text-[11px]"
                      >
                        Batch {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E4DFD3] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#1C1F1D] block">Drive Status:</span>
                  <p className="text-[11px] text-[#6B6F6A]">
                    Update recruitment progress lifecycle
                  </p>
                </div>
                <select
                  value={selectedDrive.status}
                  onChange={(e) => {
                    const status = e.target.value as Drive['status'];
                    const updated = drives.map((d) =>
                      d.id === selectedDrive.id ? { ...d, status } : d
                    );
                    onUpdateDrives(updated);
                    showToast({
                      type: 'success',
                      message: `Drive status updated to: ${status}`,
                    });
                  }}
                  className="h-8 px-3 text-xs bg-white border border-[#E4DFD3] rounded cursor-pointer"
                >
                  <option value="Planned">Planned</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </Card>
          )}

          {/* TAB 2: REGISTERED STUDENTS */}
          {activeDetailTab === 'registered' && (
            <Card padding="none" className="space-y-0">
              <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
                    Registered Students ({registeredStudentsWithCriteria.length})
                  </h3>
                  <p className="text-xs text-[#6B6F6A]">
                    Criteria: min {selectedDrive.minCgpa} CGPA, max {selectedDrive.maxBacklogs} backlogs
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setIsAddStudentManualOpen(true)}
                >
                  Add student manually
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Roll No</th>
                      <th className="px-4 py-2.5 font-semibold">Name</th>
                      <th className="px-4 py-2.5 font-semibold">Department</th>
                      <th className="px-4 py-2.5 font-semibold text-right">CGPA</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Backlogs</th>
                      <th className="px-4 py-2.5 font-semibold">Criteria Verification</th>
                      <th className="px-4 py-2.5 font-semibold">Current Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD3]">
                    {registeredStudentsWithCriteria.map(({ student, meetsCriteria, reason, application }) => (
                      <tr
                        key={student.id}
                        className="hover:bg-[#FAF8F3] h-10 cursor-pointer"
                        onClick={() => onSelectStudent && onSelectStudent(student)}
                      >
                        <td className="px-4 py-2 font-mono font-medium text-[#1C1F1D]">
                          {student.rollNo}
                        </td>
                        <td className="px-4 py-2 font-medium text-[#1C1F1D]">{student.name}</td>
                        <td className="px-4 py-2 text-[#6B6F6A]">{student.department}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#1C1F1D]">
                          {student.cgpa}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#1C1F1D]">
                          {student.activeBacklogs}
                        </td>
                        <td className="px-4 py-2">
                          <StatusChip
                            status={meetsCriteria ? 'Eligible' : 'Not Eligible'}
                            label={reason}
                            size="sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <StatusChip
                            status={application?.stage || 'Registered'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 3: STAGE BOARD (Kanban vs Table View) */}
          {activeDetailTab === 'board' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#6B6F6A]">
                  Move student applications through recruitment stages
                </p>
                <div className="flex items-center gap-1 bg-white border border-[#E4DFD3] rounded-[4px] p-0.5">
                  <button
                    onClick={() => setBoardViewMode('kanban')}
                    className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 cursor-pointer ${
                      boardViewMode === 'kanban'
                        ? 'bg-[#1F4D3F] text-white'
                        : 'text-[#6B6F6A] hover:text-[#1C1F1D]'
                    }`}
                  >
                    <Kanban className="w-3.5 h-3.5" />
                    <span>Kanban</span>
                  </button>
                  <button
                    onClick={() => setBoardViewMode('table')}
                    className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 cursor-pointer ${
                      boardViewMode === 'table'
                        ? 'bg-[#1F4D3F] text-white'
                        : 'text-[#6B6F6A] hover:text-[#1C1F1D]'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Table View</span>
                  </button>
                </div>
              </div>

              {boardViewMode === 'kanban' ? (
                /* KANBAN BOARD */
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 overflow-x-auto pb-4">
                  {[
                    'Registered',
                    'Shortlisted',
                    'Assessment',
                    'Interview',
                    'Offer',
                  ].map((stageName) => {
                    const stageApps = driveApplications.filter((a) => a.stage === stageName);

                    return (
                      <div
                        key={stageName}
                        className="bg-[#FCFBF8] border border-[#E4DFD3] rounded-[6px] p-3 flex flex-col min-w-[220px]"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3] mb-3">
                          <span className="font-semibold text-xs text-[#1C1F1D]">
                            {stageName}
                          </span>
                          <span className="text-[11px] font-bold text-[#1F4D3F] bg-[#EAF3ED] px-1.5 py-0.2 rounded tabular-nums">
                            {stageApps.length}
                          </span>
                        </div>

                        <div className="space-y-2 flex-1 min-h-[200px]">
                          {stageApps.map((app) => {
                            const student = students.find((s) => s.id === app.studentId);
                            if (!student) return null;

                            return (
                              <div
                                key={app.id}
                                className="p-3 bg-white border border-[#E4DFD3] rounded-[4px] shadow-none space-y-2"
                              >
                                <div>
                                  <p className="font-medium text-xs text-[#1C1F1D]">
                                    {student.name}
                                  </p>
                                  <p className="text-[11px] text-[#6B6F6A] font-mono">
                                    {student.rollNo} · {student.department.replace(' Engineering', '').replace('Information Technology', 'IT')}
                                  </p>
                                </div>

                                <div className="pt-2 border-t border-[#F0EEE9] flex items-center justify-between">
                                  <select
                                    value={app.stage}
                                    onChange={(e) =>
                                      handleMoveStage(app.id, e.target.value as ApplicationStage)
                                    }
                                    className="h-6 text-[11px] bg-[#FAF8F3] border border-[#E4DFD3] rounded px-1.5 text-[#1C1F1D] cursor-pointer"
                                  >
                                    <option value="Registered">Registered</option>
                                    <option value="Shortlisted">Shortlisted</option>
                                    <option value="Assessment">Assessment</option>
                                    <option value="Interview">Interview</option>
                                    <option value="Selected">Selected</option>
                                    <option value="Offer">Offer</option>
                                    <option value="Joined">Joined</option>
                                    <option value="Rejected">Rejected</option>
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ACCESSIBLE TABLE VIEW */
                <Card padding="none" className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Student</th>
                          <th className="px-4 py-2.5 font-semibold">Roll No</th>
                          <th className="px-4 py-2.5 font-semibold">Department</th>
                          <th className="px-4 py-2.5 font-semibold">Current Stage</th>
                          <th className="px-4 py-2.5 font-semibold">Move To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4DFD3]">
                        {driveApplications.map((app) => {
                          const student = students.find((s) => s.id === app.studentId);
                          return (
                            <tr key={app.id} className="hover:bg-[#FAF8F3] h-10">
                              <td className="px-4 py-2 font-medium text-[#1C1F1D]">
                                {student?.name}
                              </td>
                              <td className="px-4 py-2 font-mono text-[#6B6F6A]">
                                {student?.rollNo}
                              </td>
                              <td className="px-4 py-2 text-[#6B6F6A]">
                                {student?.department}
                              </td>
                              <td className="px-4 py-2">
                                <StatusChip status={app.stage} size="sm" />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={app.stage}
                                  onChange={(e) =>
                                    handleMoveStage(app.id, e.target.value as ApplicationStage)
                                  }
                                  className="h-7 text-xs bg-white border border-[#E4DFD3] rounded px-2"
                                >
                                  <option value="Registered">Registered</option>
                                  <option value="Shortlisted">Shortlisted</option>
                                  <option value="Assessment">Assessment</option>
                                  <option value="Interview">Interview</option>
                                  <option value="Selected">Selected</option>
                                  <option value="Offer">Offer</option>
                                  <option value="Joined">Joined</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 4: OUTCOMES & OFFERS */}
          {activeDetailTab === 'outcomes' && (
            <div className="space-y-4">
              {/* Bulk Outcomes Action Bar */}
              <div className="p-4 bg-white border border-[#E4DFD3] rounded-[6px] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#1C1F1D]">
                    {selectedOutcomeStudentIds.length} students selected
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#6B6F6A]">Offer Package:</span>
                    <input
                      type="number"
                      step="0.5"
                      value={bulkPackageInput}
                      onChange={(e) => setBulkPackageInput(e.target.value)}
                      placeholder={`${selectedDrive.packageLpa} LPA`}
                      className="w-24 h-8 px-2 text-xs bg-[#FAF8F3] border border-[#E4DFD3] rounded text-[#1C1F1D]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={selectedOutcomeStudentIds.length === 0}
                    onClick={() => handleBulkMarkStage('Selected')}
                  >
                    Mark Selected
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={selectedOutcomeStudentIds.length === 0}
                    onClick={() => handleBulkMarkStage('Offer')}
                  >
                    Mark Offer Received
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedOutcomeStudentIds.length === 0}
                    onClick={() => handleBulkMarkStage('Rejected')}
                  >
                    Mark Rejected
                  </Button>
                </div>
              </div>

              {/* Outcomes Table with Publish Toggle */}
              <Card padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] uppercase tracking-[0.06em]">
                      <tr>
                        <th className="w-10 px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={
                              driveApplications.length > 0 &&
                              selectedOutcomeStudentIds.length === driveApplications.length
                            }
                            onChange={(e) => {
                              setSelectedOutcomeStudentIds(
                                e.target.checked ? driveApplications.map((a) => a.studentId) : []
                              );
                            }}
                            className="rounded text-[#1F4D3F]"
                          />
                        </th>
                        <th className="px-4 py-2.5 font-semibold">Student</th>
                        <th className="px-4 py-2.5 font-semibold">Stage</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Package</th>
                        <th className="px-4 py-2.5 font-semibold text-center">Publish to Student</th>
                        <th className="px-4 py-2.5 font-semibold">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFD3]">
                      {driveApplications.map((app) => {
                        const student = students.find((s) => s.id === app.studentId);
                        const isChecked = selectedOutcomeStudentIds.includes(app.studentId);

                        return (
                          <tr key={app.id} className="hover:bg-[#FAF8F3] h-10">
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setSelectedOutcomeStudentIds((prev) =>
                                    e.target.checked
                                      ? [...prev, app.studentId]
                                      : prev.filter((id) => id !== app.studentId)
                                  );
                                }}
                                className="rounded text-[#1F4D3F]"
                              />
                            </td>
                            <td className="px-4 py-2 font-medium text-[#1C1F1D]">
                              {student?.name}
                              <span className="text-[11px] text-[#6B6F6A] block font-mono">
                                {student?.rollNo} · {student?.department}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <StatusChip status={app.stage} size="sm" />
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#1F4D3F]">
                              {app.packageLpa ? `₹${app.packageLpa} LPA` : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={app.isOfferPublished}
                                  onChange={() =>
                                    handleTogglePublish(app.id, app.isOfferPublished)
                                  }
                                  className="rounded text-[#1F4D3F]"
                                />
                                <span className="text-xs text-[#6B6F6A]">
                                  {app.isOfferPublished ? 'Published' : 'Hidden'}
                                </span>
                              </label>
                            </td>
                            <td className="px-4 py-2 text-[#6B6F6A] tabular-nums">
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
          )}

          {/* Confirm Cancel Drive Dialog */}
          <ConfirmDialog
            isOpen={isCancelConfirmOpen}
            onClose={() => setIsCancelConfirmOpen(false)}
            onConfirm={handleCancelDrive}
            title={`Cancel ${selectedDrive.company} Recruitment Drive?`}
            consequences="Applications under this drive will no longer count as placements. Students will be marked as cancelled."
            confirmLabel="Cancel Drive"
            isDestructive={true}
          />

          {/* Manual Add Student Modal */}
          {isAddStudentManualOpen && (
            <Drawer
              isOpen={isAddStudentManualOpen}
              onClose={() => setIsAddStudentManualOpen(false)}
              title="Add Student Manually"
              subtitle={`Enroll an eligible student directly into ${selectedDrive.company} drive`}
              width="md"
              footer={
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAddStudentManualOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!manualStudentId}
                    onClick={handleAddStudentManually}
                  >
                    Add to Drive
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <FormField label="Select Student from Roster" required>
                  <select
                    value={manualStudentId}
                    onChange={(e) => setManualStudentId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
                  >
                    <option value="">-- Choose student --</option>
                    {students
                      .filter(
                        (s) => !selectedDrive.registeredStudentIds.includes(s.id)
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.rollNo}) - {s.department} (CGPA: {s.cgpa})
                        </option>
                      ))}
                  </select>
                </FormField>
              </div>
            </Drawer>
          )}
        </div>
      ) : (
        /* ============================================================= */
        /* DRIVES LIST VIEW */
        /* ============================================================= */
        <div className="space-y-6">
          <PageHeader
            title="Recruitment Drives"
            subtitle="Coordinate institutional placement drives, company qualification rounds, and candidate offers."
            actions={
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsNewDriveOpen(true)}
              >
                New drive
              </Button>
            }
          />

          {/* Status filter tabs along the top */}
          <div className="bg-white border border-[#E4DFD3] rounded-[6px] overflow-hidden">
            <Tabs
              tabs={[
                { id: 'All', label: 'All Drives', count: statusCounts.All },
                { id: 'Planned', label: 'Planned', count: statusCounts.Planned },
                { id: 'Open', label: 'Open', count: statusCounts.Open },
                { id: 'In Progress', label: 'In Progress', count: statusCounts['In Progress'] },
                { id: 'Completed', label: 'Completed', count: statusCounts.Completed },
                { id: 'Cancelled', label: 'Cancelled', count: statusCounts.Cancelled },
              ]}
              activeTab={statusTab}
              onChange={setStatusTab}
            />
          </div>

          {/* Filter Bar */}
          <FilterBar
            fields={filterFields}
            onFilterChange={handleFilterChange}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search drives by company or role..."
            onReset={handleResetFilters}
          />

          {/* DataTable of Drives */}
          <DataTable
            columns={driveColumns}
            data={filteredDrives}
            keyField="id"
            onRowClick={(d) => setSelectedDriveId(d.id)}
            exportFilename="apex_recruitment_drives"
            emptyMessage="No recruitment drives match the selected filters."
            rowDimmed={(d) => d.status === 'Cancelled'}
            rowTooltip={(d) =>
              d.status === 'Cancelled'
                ? 'This drive is cancelled. Its applications are excluded from placement statistics.'
                : undefined
            }
          />
        </div>
      )}

      {/* ============================================================= */}
      {/* DRAWER: NEW RECRUITMENT DRIVE */}
      {/* ============================================================= */}
      <Drawer
        isOpen={isNewDriveOpen}
        onClose={() => setIsNewDriveOpen(false)}
        title="Schedule New Recruitment Drive"
        subtitle="Set up drive qualifications, stages, eligible departments, and dates."
        width="xl"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsNewDriveOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateNewDrive}>
              Publish Drive
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateNewDrive} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Company Name" required>
              <input
                type="text"
                required
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Goldman Sachs"
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Job Role / Title" required>
              <input
                type="text"
                required
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="e.g. Quantitative Analyst"
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>
          </div>

          <FormField label="Role Summary / Description">
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Outline role expectations and responsibilities..."
              className="p-2.5 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
            />
          </FormField>

          {/* Eligible Departments Multi-select Chips */}
          <FormField label="Eligible Departments (Multi-select)">
            {allDepartments.length === 0 ? (
              <p className="text-xs text-[#6B6F6A] p-2.5 bg-[#FAF8F3] border border-[#E4DFD3] rounded">
                No departments yet. Import students to create departments.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-2 bg-[#FAF8F3] border border-[#E4DFD3] rounded">
                {allDepartments.map((dept) => {
                  const isSelected = newDepts.includes(dept);
                  return (
                    <button
                      type="button"
                      key={dept}
                      onClick={() => {
                        setNewDepts((prev) =>
                          isSelected ? prev.filter((d) => d !== dept) : [...prev, dept]
                        );
                      }}
                      className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-[#1F4D3F] text-white border-[#1F4D3F]'
                          : 'bg-white text-[#6B6F6A] border-[#E4DFD3] hover:text-[#1C1F1D]'
                      }`}
                    >
                      {dept}
                    </button>
                  );
                })}
              </div>
            )}
          </FormField>

          {/* Eligible Batches Multi-select */}
          <FormField label="Eligible Batches">
            <div className="flex gap-2">
              {allBatches.map((b) => {
                const isSelected = newBatches.includes(b);
                return (
                  <button
                    type="button"
                    key={b}
                    onClick={() => {
                      setNewBatches((prev) =>
                        isSelected ? prev.filter((item) => item !== b) : [...prev, b]
                      );
                    }}
                    className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-[#1F4D3F] text-white border-[#1F4D3F]'
                        : 'bg-white text-[#6B6F6A] border-[#E4DFD3]'
                    }`}
                  >
                    Batch {b}
                  </button>
                );
              })}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Minimum CGPA Cutoff">
              <input
                type="number"
                step="0.1"
                value={newMinCgpa}
                onChange={(e) => setNewMinCgpa(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
              />
            </FormField>

            <FormField label="Maximum Active Backlogs">
              <input
                type="number"
                value={newMaxBacklogs}
                onChange={(e) => setNewMaxBacklogs(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Deadline" required>
              <input
                type="date"
                required
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
              />
            </FormField>

            <FormField label="Package (LPA)">
              <input
                type="number"
                step="0.5"
                value={newPackage}
                onChange={(e) => setNewPackage(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
              />
            </FormField>

            <FormField label="Status">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
              >
                <option value="Planned">Planned</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </FormField>
          </div>

          <FormField label="Work Location">
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="e.g. Bengaluru / Hyderabad"
              className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded"
            />
          </FormField>
        </form>
      </Drawer>
    </div>
  );
};
