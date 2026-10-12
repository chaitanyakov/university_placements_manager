import React, { useState, useMemo } from 'react';
import {
  Student,
  Application,
  ClearanceCategory,
  ClearanceRecord,
  applyStudentFilters,
  getStudentNoDuesStatus,
  isApplicationValidOffer,
  Drive,
  portalStorage,
} from '../../services/placementNoDuesService';
import { sendPasswordReset, toggleUserActiveStatus } from '../../services/firebaseAuthService';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { Button } from '../../components/ui/Button';
import { StatusChip } from '../../components/ui/StatusChip';
import { Drawer } from '../../components/ui/Drawer';
import { Tabs } from '../../components/ui/FeedbackComponents';
import { FormField } from '../../components/ui/FeedbackComponents';
import { useToast } from '../../components/ui/Toast';
import { PageHeader } from '../../components/ui/FeedbackComponents';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { UserPlus, CheckCircle, FileText, ExternalLink, Trash2, Mail, KeyRound, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

interface StudentsPageProps {
  students: Student[];
  onUpdateStudents: (updated: Student[]) => void;
  onDeleteStudents?: (studentIds: string[]) => void;
  applications: Application[];
  drives: Drive[];
  categories: ClearanceCategory[];
  clearances: ClearanceRecord[];
  initialSelectedStudent?: Student | null;
  onNavigateToStatements?: (studentId: string) => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  students,
  onUpdateStudents,
  onDeleteStudents,
  applications,
  drives,
  categories,
  clearances,
  initialSelectedStudent,
  onNavigateToStatements,
}) => {
  const { showToast } = useToast();

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [regFilter, setRegFilter] = useState('All');
  const [eligFilter, setEligFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Drawer states
  const [profileDrawerStudent, setProfileDrawerStudent] = useState<Student | null>(
    initialSelectedStudent || null
  );
  const [activeProfileTab, setActiveProfileTab] = useState('details');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

  // New Student Form State
  const [newRollNo, setNewRollNo] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDept, setNewDept] = useState('Computer Science & Engineering');
  const [newProgram, setNewProgram] = useState('B.Tech');
  const [newYear, setNewYear] = useState('4');
  const [newSection, setNewSection] = useState('A');
  const [newBatch, setNewBatch] = useState('2025');
  const [newCgpa, setNewCgpa] = useState('8.0');
  const [newBacklogs, setNewBacklogs] = useState('0');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter options
  const allDepartments = useMemo(
    () => Array.from(new Set(students.map((s) => s.department))).sort(),
    [students]
  );
  const allBatches = useMemo(
    () => Array.from(new Set(students.map((s) => s.batch))).sort(),
    [students]
  );

  const filterFields: FilterField[] = [
    {
      id: 'department',
      label: 'Department',
      value: departmentFilter,
      options: [
        { label: 'All Departments', value: 'All' },
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
      id: 'registration',
      label: 'Registration',
      value: regFilter,
      options: [
        { label: 'All', value: 'All' },
        { label: 'Registered', value: 'Registered' },
        { label: 'Unregistered', value: 'Unregistered' },
      ],
    },
    {
      id: 'eligibility',
      label: 'Eligibility',
      value: eligFilter,
      options: [
        { label: 'All', value: 'All' },
        { label: 'Eligible', value: 'Eligible' },
        { label: 'Not Eligible', value: 'Not Eligible' },
      ],
    },
  ];

  const handleFilterChange = (id: string, val: string) => {
    if (id === 'department') setDepartmentFilter(val);
    if (id === 'batch') setBatchFilter(val);
    if (id === 'registration') setRegFilter(val);
    if (id === 'eligibility') setEligFilter(val);
  };

  const handleResetFilters = () => {
    setDepartmentFilter('All');
    setBatchFilter('All');
    setRegFilter('All');
    setEligFilter('All');
    setSearchQuery('');
  };

  const filteredStudents = useMemo(() => {
    return applyStudentFilters(students, {
      department: departmentFilter,
      batch: batchFilter,
      registrationStatus: regFilter,
      eligibilityStatus: eligFilter,
      search: searchQuery,
    });
  }, [students, departmentFilter, batchFilter, regFilter, eligFilter, searchQuery]);

  // Bulk Actions
  const handleBulkMarkRegistered = () => {
    if (selectedIds.length === 0) return;
    const updated = students.map((s) => {
      if (selectedIds.includes(s.id)) {
        return { ...s, isRegistered: true };
      }
      return s;
    });
    onUpdateStudents(updated);
    showToast({
      type: 'success',
      message: `Marked ${selectedIds.length} students as Registered`,
    });
    setSelectedIds([]);
  };

  const handleBulkMarkEligible = () => {
    if (selectedIds.length === 0) return;
    const updated = students.map((s) => {
      if (selectedIds.includes(s.id)) {
        return { ...s, isEligible: true };
      }
      return s;
    });
    onUpdateStudents(updated);
    showToast({
      type: 'success',
      message: `Marked ${selectedIds.length} students as Eligible`,
    });
    setSelectedIds([]);
  };

  // Delete States and Actions
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [studentIdsToDelete, setStudentIdsToDelete] = useState<string[]>([]);

  const handleConfirmDelete = () => {
    if (studentIdsToDelete.length === 0) return;

    if (onDeleteStudents) {
      onDeleteStudents(studentIdsToDelete);
    } else {
      const deleteSet = new Set(studentIdsToDelete);
      onUpdateStudents(students.filter((s) => !deleteSet.has(s.id)));
    }

    const deletedCount = studentIdsToDelete.length;
    const deletedName = students.find((s) => s.id === studentIdsToDelete[0])?.name;

    setSelectedIds((prev) => prev.filter((id) => !studentIdsToDelete.includes(id)));

    if (profileDrawerStudent && studentIdsToDelete.includes(profileDrawerStudent.id)) {
      setProfileDrawerStudent(null);
    }

    setIsDeleteConfirmOpen(false);
    setStudentIdsToDelete([]);

    showToast({
      type: 'success',
      message:
        deletedCount === 1
          ? `Permanently deleted ${deletedName || 'student'} and all associated progress, applications, and clearance records.`
          : `Permanently deleted ${deletedCount} students and all associated progress.`,
    });
  };

  // Password reset & Account active states
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  const handleToggleAccountActive = async () => {
    if (!profileDrawerStudent) return;
    const currentDoc = portalStorage.getUserDocByEmail(profileDrawerStudent.email);
    const newActive = !(currentDoc ? currentDoc.active !== false : true);
    const uid = currentDoc ? currentDoc.uid : profileDrawerStudent.id;
    await toggleUserActiveStatus(uid, newActive);
    showToast({
      type: 'success',
      message: newActive
        ? `Account activated for ${profileDrawerStudent.name}. Login access enabled.`
        : `Account deactivated for ${profileDrawerStudent.name}. Login access disabled.`,
    });
    // Trigger re-render of profile drawer student
    setProfileDrawerStudent({ ...profileDrawerStudent });
  };

  const handleSendResetEmail = async () => {
    if (!profileDrawerStudent) return;
    setIsSendingResetEmail(true);
    try {
      const msg = await sendPasswordReset(profileDrawerStudent.email);
      showToast({
        type: 'success',
        message: msg,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        message: err?.message || 'Failed to send password reset email.',
      });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  // Add Student Validation & Submit
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!newRollNo.trim()) {
      errors.rollNo = 'Roll number is required.';
    } else {
      const exists = students.some(
        (s) => s.rollNo.toLowerCase() === newRollNo.trim().toLowerCase()
      );
      if (exists) {
        errors.rollNo = `Roll number "${newRollNo}" already exists in the roster.`;
      }
    }

    if (!newName.trim()) errors.name = 'Full name is required.';
    if (!newEmail.trim()) {
      errors.email = 'University email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      errors.email = 'Please provide a valid email format (e.g. name@apex.edu).';
    }

    const yearNum = parseInt(newYear, 10);
    if (isNaN(yearNum) || yearNum < 1 || yearNum > 5) {
      errors.year = 'Year must be a number between 1 and 5.';
    }

    const cgpaNum = parseFloat(newCgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
      errors.cgpa = 'CGPA must be between 0.0 and 10.0.';
    }

    const backlogNum = parseInt(newBacklogs, 10);
    if (isNaN(backlogNum) || backlogNum < 0) {
      errors.backlogs = 'Backlogs cannot be negative.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const newStudent: Student = {
      id: `stu-${Date.now()}`,
      rollNo: newRollNo.trim().toUpperCase(),
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      department: newDept,
      program: newProgram,
      year: yearNum,
      section: newSection.trim().toUpperCase() || 'A',
      batch: newBatch.trim(),
      cgpa: cgpaNum,
      activeBacklogs: backlogNum,
      isRegistered: true,
      isEligible: backlogNum === 0 && cgpaNum >= 6.0,
      placementStatus: 'Unplaced',
      skills: ['General Aptitude', 'Communication'],
    };

    onUpdateStudents([newStudent, ...students]);
    showToast({
      type: 'success',
      message: `Enrolled student ${newStudent.name} (${newStudent.rollNo})`,
    });

    setIsAddStudentOpen(false);
    // Reset form
    setNewRollNo('');
    setNewName('');
    setNewEmail('');
    setNewCgpa('8.0');
    setNewBacklogs('0');
    setFormErrors({});
  };

  // Update Student from Profile Drawer
  const handleUpdateStudentDetails = (updated: Student) => {
    const list = students.map((s) => (s.id === updated.id ? updated : s));
    onUpdateStudents(list);
    setProfileDrawerStudent(updated);
    showToast({
      type: 'success',
      message: 'Student details updated successfully.',
    });
  };

  // Table Columns
  const columns: Column<Student>[] = [
    {
      key: 'rollNo',
      header: 'Roll No',
      sortable: true,
      width: '110px',
      render: (s) => <span className="font-mono font-medium">{s.rollNo}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (s) => (
        <div>
          <span className="font-medium text-[#1C1F1D]">{s.name}</span>
          <span className="text-[11px] text-[#6B6F6A] block font-mono">{s.email}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      render: (s) => (
        <span className="truncate max-w-[180px] block" title={s.department}>
          {s.department}
        </span>
      ),
    },
    {
      key: 'program',
      header: 'Program',
      sortable: true,
      width: '80px',
    },
    {
      key: 'year',
      header: 'Year',
      sortable: true,
      align: 'right',
      width: '60px',
      render: (s) => `${s.year}th`,
    },
    {
      key: 'section',
      header: 'Sec',
      align: 'center',
      width: '50px',
    },
    {
      key: 'batch',
      header: 'Batch',
      sortable: true,
      width: '70px',
    },
    {
      key: 'isRegistered',
      header: 'Registration',
      sortable: true,
      render: (s) => (
        <StatusChip
          status={s.isRegistered ? 'Registered' : 'Not Applicable'}
          label={s.isRegistered ? 'Registered' : 'Unregistered'}
          size="sm"
        />
      ),
    },
    {
      key: 'isEligible',
      header: 'Eligibility',
      sortable: true,
      render: (s) => (
        <StatusChip
          status={s.isEligible ? 'Eligible' : 'Not Eligible'}
          label={s.isEligible ? 'Eligible' : `Ineligible (${s.activeBacklogs} backlogs)`}
          size="sm"
        />
      ),
    },
    {
      key: 'placementStatus',
      header: 'Placement',
      sortable: true,
      render: (s) => <StatusChip status={s.placementStatus} size="sm" />,
    },
  ];

  // Applications for currently opened student
  const studentApplications = useMemo(() => {
    if (!profileDrawerStudent) return [];
    return applications.filter((a) => a.studentId === profileDrawerStudent.id);
  }, [profileDrawerStudent, applications]);

  // Valid offers for opened student
  const studentOffers = useMemo(() => {
    if (!profileDrawerStudent) return [];
    return studentApplications.filter((a) => isApplicationValidOffer(a, drives));
  }, [studentApplications, drives, profileDrawerStudent]);

  // No dues info for opened student
  const studentClearanceInfo = useMemo(() => {
    if (!profileDrawerStudent) return null;
    return getStudentNoDuesStatus(profileDrawerStudent.id, categories, clearances);
  }, [profileDrawerStudent, categories, clearances]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students Directory"
        subtitle="Manage student enrollment, eligibility criteria, recruitment progress, and graduation clearances."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => setIsAddStudentOpen(true)}
          >
            Add student
          </Button>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        fields={filterFields}
        onFilterChange={handleFilterChange}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name, roll no, or email..."
        onReset={handleResetFilters}
      />

      {/* Bulk Action Bar (appears when rows selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-[#FAF8F3] border border-[#1F4D3F] p-3 rounded-[6px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-[#1F4D3F]">
              {selectedIds.length} {selectedIds.length === 1 ? 'student' : 'students'} selected:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCircle className="w-3.5 h-3.5 text-[#1E5631]" />}
              onClick={handleBulkMarkRegistered}
            >
              Mark as registered
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCircle className="w-3.5 h-3.5 text-[#1E5631]" />}
              onClick={handleBulkMarkEligible}
            >
              Mark as eligible
            </Button>
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => {
                setStudentIdsToDelete([...selectedIds]);
                setIsDeleteConfirmOpen(true);
              }}
            >
              Delete selected ({selectedIds.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-xs text-[#6B6F6A]"
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {/* Students Data Table */}
      <DataTable
        columns={columns}
        data={filteredStudents}
        keyField="id"
        selectable={true}
        selectedIds={selectedIds}
        onSelectRow={(id) => {
          setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
          );
        }}
        onSelectAll={(allIds) => setSelectedIds(allIds)}
        onRowClick={(st) => setProfileDrawerStudent(st)}
        rowActions={(s) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={`Delete ${s.name} and all progress`}
              onClick={(e) => {
                e.stopPropagation();
                setStudentIdsToDelete([s.id]);
                setIsDeleteConfirmOpen(true);
              }}
              className="p-1.5 text-[#6B6F6A] hover:text-[#9E2A2B] hover:bg-[#FCECEE] rounded-[4px] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        exportFilename="apex_students_roster"
        pageSize={15}
        emptyMessage="No students match the current filters."
      />

      {/* ============================================================= */}
      {/* RIGHT-SIDE DRAWER: STUDENT PROFILE */}
      {/* ============================================================= */}
      {profileDrawerStudent && (
        <Drawer
          isOpen={!!profileDrawerStudent}
          onClose={() => setProfileDrawerStudent(null)}
          title={profileDrawerStudent.name}
          subtitle={`${profileDrawerStudent.rollNo} · ${profileDrawerStudent.department} · Batch ${profileDrawerStudent.batch}`}
          width="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {onNavigateToStatements && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<FileText className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onNavigateToStatements(profileDrawerStudent.id);
                      setProfileDrawerStudent(null);
                    }}
                  >
                    View Statement
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setStudentIdsToDelete([profileDrawerStudent.id]);
                    setIsDeleteConfirmOpen(true);
                  }}
                >
                  Delete Student
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setProfileDrawerStudent(null)}
              >
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <Tabs
              tabs={[
                { id: 'details', label: 'Details' },
                { id: 'applications', label: 'Applications', count: studentApplications.length },
                { id: 'offers', label: 'Offers', count: studentOffers.length },
                { id: 'nodues', label: 'No-Dues' },
              ]}
              activeTab={activeProfileTab}
              onChange={setActiveProfileTab}
            />

            {/* TAB 1: DETAILS (Editable) */}
            {activeProfileTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Roll Number">
                    <input
                      type="text"
                      disabled
                      value={profileDrawerStudent.rollNo}
                      className="h-9 px-3 text-xs bg-[#FAF8F3] border border-[#E4DFD3] rounded text-[#6B6F6A]"
                    />
                  </FormField>
                  <FormField label="Full Name">
                    <input
                      type="text"
                      value={profileDrawerStudent.name}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          name: e.target.value,
                        })
                      }
                      className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                    />
                  </FormField>
                </div>

                <FormField label="University Email">
                  <input
                    type="email"
                    value={profileDrawerStudent.email}
                    onChange={(e) =>
                      setProfileDrawerStudent({
                        ...profileDrawerStudent,
                        email: e.target.value,
                      })
                    }
                    className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Department">
                    <select
                      value={profileDrawerStudent.department}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          department: e.target.value,
                        })
                      }
                      className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                    >
                      {allDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Batch">
                    <input
                      type="text"
                      value={profileDrawerStudent.batch}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          batch: e.target.value,
                        })
                      }
                      className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <FormField label="CGPA">
                    <input
                      type="number"
                      step="0.01"
                      value={profileDrawerStudent.cgpa}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          cgpa: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                    />
                  </FormField>

                  <FormField label="Backlogs">
                    <input
                      type="number"
                      value={profileDrawerStudent.activeBacklogs}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          activeBacklogs: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                    />
                  </FormField>

                  <FormField label="Placement Status">
                    <select
                      value={profileDrawerStudent.placementStatus}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          placementStatus: e.target.value as any,
                        })
                      }
                      className="h-9 px-2 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
                    >
                      <option value="Unplaced">Unplaced</option>
                      <option value="Shortlisted">Shortlisted</option>
                      <option value="Selected">Selected</option>
                      <option value="Offer Received">Offer Received</option>
                      <option value="Placed">Placed</option>
                      <option value="Joined">Joined</option>
                    </select>
                  </FormField>
                </div>

                <div className="pt-2 flex items-center gap-6">
                  <label className="flex items-center gap-2 text-xs text-[#1C1F1D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileDrawerStudent.isRegistered}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          isRegistered: e.target.checked,
                        })
                      }
                      className="rounded text-[#1F4D3F]"
                    />
                    <span>Registered on Portal</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-[#1C1F1D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileDrawerStudent.isEligible}
                      onChange={(e) =>
                        setProfileDrawerStudent({
                          ...profileDrawerStudent,
                          isEligible: e.target.checked,
                        })
                      }
                      className="rounded text-[#1F4D3F]"
                    />
                    <span>Meets Eligibility Criteria</span>
                  </label>
                </div>

                <div className="pt-4 border-t border-[#E4DFD3] flex items-center justify-between">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUpdateStudentDetails(profileDrawerStudent)}
                  >
                    Save Changes
                  </Button>
                </div>

                {/* Account Security & Access Controls */}
                <div className="mt-6 pt-4 border-t border-[#E4DFD3] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B6F6A]">
                      Account Access & Authentication
                    </span>
                    {(() => {
                      const userDoc = portalStorage.getUserDocByEmail(profileDrawerStudent.email);
                      const isActive = userDoc ? userDoc.active !== false : true;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.06em] ${
                            isActive
                              ? 'bg-[#E8F3EE] text-[#1F4D3F] border border-[#C6E2D5]'
                              : 'bg-[#FCECEE] text-[#9E2A2B] border border-[#F6C6CA]'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <ShieldCheck className="w-3 h-3 text-[#1F4D3F]" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3 h-3 text-[#9E2A2B]" />
                              <span>Disabled</span>
                            </>
                          )}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="bg-[#FAF8F3] border border-[#E4DFD3] rounded-[6px] p-3.5 space-y-3.5">
                    {/* Activate / Deactivate Toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#1C1F1D]">
                          Activate / Deactivate account
                        </p>
                        <p className="text-[11px] text-[#6B6F6A] mt-0.5">
                          {(() => {
                            const userDoc = portalStorage.getUserDocByEmail(profileDrawerStudent.email);
                            const isActive = userDoc ? userDoc.active !== false : true;
                            return isActive
                              ? 'Student can sign in to the portal and check placements.'
                              : 'Student login is disabled. Sign-in attempts will be blocked.';
                          })()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleAccountActive}
                        className={`h-8 px-3 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer select-none ${
                          (() => {
                            const userDoc = portalStorage.getUserDocByEmail(profileDrawerStudent.email);
                            const isActive = userDoc ? userDoc.active !== false : true;
                            return isActive
                              ? 'bg-white border-[#E4DFD3] text-[#9E2A2B] hover:bg-[#FCECEE] hover:border-[#F6C6CA]'
                              : 'bg-[#1F4D3F] text-white border-[#1F4D3F] hover:bg-[#173C31]';
                          })()
                        }`}
                      >
                        {(() => {
                          const userDoc = portalStorage.getUserDocByEmail(profileDrawerStudent.email);
                          const isActive = userDoc ? userDoc.active !== false : true;
                          return isActive ? 'Deactivate account' : 'Activate account';
                        })()}
                      </button>
                    </div>

                    {/* Send Password Reset Email Button */}
                    <div className="pt-3 border-t border-[#E4DFD3] flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#1C1F1D]">
                          Password recovery
                        </p>
                        <p className="text-[11px] text-[#6B6F6A] mt-0.5">
                          Send a Firebase reset email to {profileDrawerStudent.email}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSendingResetEmail}
                        onClick={handleSendResetEmail}
                        leftIcon={
                          isSendingResetEmail ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Mail className="w-3.5 h-3.5 text-[#1F4D3F]" />
                          )
                        }
                      >
                        {isSendingResetEmail ? 'Sending...' : 'Send password reset email'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Danger Zone: Complete deletion */}
                <div className="mt-8 pt-4 border-t border-[#E4DFD3]">
                  <div className="p-3.5 border border-[#F3D5D7] bg-[#FCF5F5] rounded-[6px] space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-[#9E2A2B] uppercase tracking-[0.06em]">
                          Danger Zone
                        </span>
                        <p className="text-xs text-[#1C1F1D] font-medium mt-0.5">
                          Permanently delete this student and erase all progress
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setStudentIdsToDelete([profileDrawerStudent.id]);
                          setIsDeleteConfirmOpen(true);
                        }}
                      >
                        Delete Student
                      </Button>
                    </div>
                    <p className="text-[11px] text-[#6B6F6A] leading-relaxed">
                      Permanently removes <strong>{profileDrawerStudent.name}</strong> ({profileDrawerStudent.rollNo}) from the university registry. This completely erases all their recruitment progress: {studentApplications.length} drive applications, interview stage histories, confirmed offers, and all department clearance / no-dues records.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: APPLICATIONS */}
            {activeProfileTab === 'applications' && (
              <div className="space-y-3">
                {studentApplications.length === 0 ? (
                  <p className="text-xs text-[#6B6F6A] py-6 text-center">
                    No active applications submitted by this student.
                  </p>
                ) : (
                  studentApplications.map((app) => (
                    <div
                      key={app.id}
                      className="p-3.5 border border-[#E4DFD3] rounded-[6px] bg-white space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-xs text-[#1C1F1D]">{app.company}</p>
                          <p className="text-[11px] text-[#6B6F6A]">{app.role}</p>
                        </div>
                        <StatusChip status={app.stage} size="sm" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6B6F6A] border-t border-[#F0EEE9] pt-2">
                        <span>Updated: {app.updatedAt}</span>
                        {app.packageLpa && (
                          <span className="font-medium text-[#1E5631]">
                            ₹{app.packageLpa} LPA
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: OFFERS */}
            {activeProfileTab === 'offers' && (
              <div className="space-y-3">
                {studentOffers.length === 0 ? (
                  <p className="text-xs text-[#6B6F6A] py-6 text-center">
                    No valid offers confirmed yet.
                  </p>
                ) : (
                  studentOffers.map((o) => (
                    <div
                      key={o.id}
                      className="p-3.5 border border-[#CDE3D3] bg-[#EAF3ED]/30 rounded-[6px] flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#1C1F1D]">{o.company}</p>
                        <p className="text-[11px] text-[#6B6F6A]">{o.role}</p>
                        <p className="text-[11px] text-[#1E5631] font-bold mt-1">
                          {o.packageLpa ? `₹${o.packageLpa} LPA` : 'Offer package pending confirmation'}
                        </p>
                      </div>
                      <StatusChip status={o.stage} size="sm" />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 4: NO-DUES */}
            {activeProfileTab === 'nodues' && (
              <div className="space-y-4">
                {studentClearanceInfo && (
                  <div className="p-3.5 border border-[#E4DFD3] rounded-[6px] bg-[#FAF8F3] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#1C1F1D]">
                        Overall Status: {studentClearanceInfo.status}
                      </p>
                      <p className="text-[11px] text-[#6B6F6A]">
                        {studentClearanceInfo.clearedCount} of{' '}
                        {studentClearanceInfo.totalActive} active categories cleared
                      </p>
                    </div>
                    <StatusChip status={studentClearanceInfo.status} size="sm" />
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A]">
                    Department Clearances:
                  </p>
                  {categories.map((cat) => {
                    const rec = studentClearanceInfo?.recordsMap.get(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className="p-3 border border-[#E4DFD3] rounded-[6px] bg-white flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-medium text-[#1C1F1D] flex items-center gap-1.5">
                            <span>{cat.name}</span>
                            {cat.isMandatory && (
                              <span className="text-[10px] text-[#6B6F6A] bg-[#F0EEE9] px-1 py-0.2 rounded">
                                Mandatory
                              </span>
                            )}
                          </p>
                          {rec?.remarks && (
                            <p className="text-[11px] text-[#6B6F6A] mt-0.5">{rec.remarks}</p>
                          )}
                        </div>
                        <StatusChip status={rec?.status || 'Pending'} size="sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* ============================================================= */}
      {/* ADD STUDENT DRAWER */}
      {/* ============================================================= */}
      <Drawer
        isOpen={isAddStudentOpen}
        onClose={() => {
          setIsAddStudentOpen(false);
          setFormErrors({});
        }}
        title="Enroll New Student"
        subtitle="Add a student record to the university placement and clearance registry."
        width="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsAddStudentOpen(false);
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddStudent}>
              Enroll Student
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Roll Number" required error={formErrors.rollNo}>
              <input
                type="text"
                required
                value={newRollNo}
                onChange={(e) => setNewRollNo(e.target.value)}
                placeholder="e.g. 21CS099"
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Full Name" required error={formErrors.name}>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Maya Krishnan"
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>
          </div>

          <FormField label="University Email" required error={formErrors.email}>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. maya.krishnan@apex.edu"
              className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department" required>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              >
                {allDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Graduation Batch" required>
              <input
                type="text"
                value={newBatch}
                onChange={(e) => setNewBatch(e.target.value)}
                placeholder="e.g. 2025"
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Year" required error={formErrors.year}>
              <input
                type="number"
                min="1"
                max="5"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Section">
              <input
                type="text"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder="A"
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Program">
              <input
                type="text"
                value={newProgram}
                onChange={(e) => setNewProgram(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Current CGPA" required error={formErrors.cgpa}>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={newCgpa}
                onChange={(e) => setNewCgpa(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Active Backlogs" error={formErrors.backlogs}>
              <input
                type="number"
                min="0"
                value={newBacklogs}
                onChange={(e) => setNewBacklogs(e.target.value)}
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>
          </div>
        </form>
      </Drawer>

      {/* ============================================================= */}
      {/* CONFIRM DELETE DIALOG */}
      {/* ============================================================= */}
      {isDeleteConfirmOpen && (
        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => {
            setIsDeleteConfirmOpen(false);
            setStudentIdsToDelete([]);
          }}
          onConfirm={handleConfirmDelete}
          title={
            studentIdsToDelete.length === 1
              ? `Delete Student: ${
                  students.find((s) => s.id === studentIdsToDelete[0])?.name || 'Student'
                }`
              : `Delete ${studentIdsToDelete.length} Students`
          }
          confirmLabel={
            studentIdsToDelete.length === 1
              ? 'Delete Student & All Progress'
              : `Delete ${studentIdsToDelete.length} Students`
          }
          cancelLabel="Cancel"
          isDestructive={true}
          consequences={
            studentIdsToDelete.length === 1 ? (
              <div className="space-y-2 text-xs text-[#1C1F1D]">
                <p>
                  Are you sure you want to permanently delete{' '}
                  <strong>
                    {students.find((s) => s.id === studentIdsToDelete[0])?.name}
                  </strong>{' '}
                  (
                  <span className="font-mono">
                    {students.find((s) => s.id === studentIdsToDelete[0])?.rollNo}
                  </span>
                  )?
                </p>
                <p className="text-[#6B6F6A]">
                  This action is permanent and cannot be undone. It will completely erase:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[#6B6F6A]">
                  <li>The student’s registry record, profile, and credentials</li>
                  <li>All recruitment drive applications, assessments, and interview progressions</li>
                  <li>All confirmed offers, package metrics, and placement statistics</li>
                  <li>All department clearance checklist records and no-dues verification statuses</li>
                  <li>Enrollment records across all recruitment drives</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-[#1C1F1D]">
                <p>
                  Are you sure you want to permanently delete{' '}
                  <strong>{studentIdsToDelete.length} selected students</strong>?
                </p>
                <p className="text-[#6B6F6A]">
                  This will permanently wipe their student accounts, all drive applications, interview progress, offer records, and department no-dues clearance statuses. This action cannot be undone.
                </p>
              </div>
            )
          }
        />
      )}
    </div>
  );
};
