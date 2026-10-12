/**
 * Apex University Placement & Department No-Dues Portal
 * Complete Frontend Implementation
 */

import React, { useState, useEffect } from 'react';
import {
  Student,
  Drive,
  Application,
  ClearanceCategory,
  ClearanceRecord,
  AuthUser,
  portalStorage,
} from './services/placementNoDuesService';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/auth/LoginPage';
import { Forbidden403 } from './pages/auth/Forbidden403';

// In-Charge Pages
import { DashboardPage } from './pages/incharge/DashboardPage';
import { StudentsPage } from './pages/incharge/StudentsPage';
import { ImportStudentsPage } from './pages/incharge/ImportStudentsPage';
import { DrivesPage } from './pages/incharge/DrivesPage';
import { ApplicationsPage } from './pages/incharge/ApplicationsPage';
import { ChecklistSetupPage } from './pages/incharge/ChecklistSetupPage';
import { ClearanceGridPage } from './pages/incharge/ClearanceGridPage';
import { StatementsPage } from './pages/incharge/StatementsPage';
import { ReportsPage } from './pages/incharge/ReportsPage';
import { SettingsPage } from './pages/incharge/SettingsPage';

// Student Pages
import { StudentPlacementPage } from './pages/student/StudentPlacementPage';
import { StudentNoDuesPage } from './pages/student/StudentNoDuesPage';
import { StudentProfilePage } from './pages/student/StudentProfilePage';

export default function App() {
  // Current logged in user (or null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return portalStorage.getCurrentUser();
  });

  // Portal State
  const [students, setStudents] = useState<Student[]>(() => portalStorage.getStudents());
  const [drives, setDrives] = useState<Drive[]>(() => portalStorage.getDrives());
  const [applications, setApplications] = useState<Application[]>(() =>
    portalStorage.getApplications()
  );
  const [categories, setCategories] = useState<ClearanceCategory[]>(() =>
    portalStorage.getCategories()
  );
  const [clearances, setClearances] = useState<ClearanceRecord[]>(() =>
    portalStorage.getClearances()
  );

  // Active Navigation Page
  const [currentPage, setCurrentPage] = useState<string>(() => {
    return currentUser?.role === 'student' ? 'my-placement' : 'dashboard';
  });

  // Cross-page navigation state helpers
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [selectedStudentForStatement, setSelectedStudentForStatement] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | undefined>(undefined);
  const [gridInitialFilterStatus, setGridInitialFilterStatus] = useState<string | undefined>(undefined);

  // Persist handlers
  const handleUpdateStudents = (updated: Student[]) => {
    setStudents(updated);
    portalStorage.saveStudents(updated);
  };

  const handleUpdateDrives = (updated: Drive[]) => {
    setDrives(updated);
    portalStorage.saveDrives(updated);
  };

  const handleUpdateApplications = (updated: Application[]) => {
    setApplications(updated);
    portalStorage.saveApplications(updated);
  };

  const handleUpdateCategories = (updated: ClearanceCategory[]) => {
    setCategories(updated);
    portalStorage.saveCategories(updated);
  };

  const handleUpdateClearances = (updated: ClearanceRecord[]) => {
    setClearances(updated);
    portalStorage.saveClearances(updated);
  };

  const handleDeleteStudents = (studentIds: string[]) => {
    const studentIdsSet = new Set(studentIds);

    // 1. Remove from students
    const updatedStudents = students.filter((s) => !studentIdsSet.has(s.id));
    setStudents(updatedStudents);
    portalStorage.saveStudents(updatedStudents);

    // 2. Remove all applications and progress belonging to these students
    const updatedApplications = applications.filter((a) => !studentIdsSet.has(a.studentId));
    setApplications(updatedApplications);
    portalStorage.saveApplications(updatedApplications);

    // 3. Remove these students from all drives' registeredStudentIds
    const updatedDrives = drives.map((d) => ({
      ...d,
      registeredStudentIds: d.registeredStudentIds.filter((id) => !studentIdsSet.has(id)),
    }));
    setDrives(updatedDrives);
    portalStorage.saveDrives(updatedDrives);

    // 4. Remove all clearance records belonging to these students
    const updatedClearances = clearances.filter((c) => !studentIdsSet.has(c.studentId));
    setClearances(updatedClearances);
    portalStorage.saveClearances(updatedClearances);

    // 5. Clean up cross-component selection state if the selected student was deleted
    if (selectedStudentForProfile && studentIdsSet.has(selectedStudentForProfile.id)) {
      setSelectedStudentForProfile(null);
    }
    if (selectedStudentForStatement && studentIdsSet.has(selectedStudentForStatement)) {
      setSelectedStudentForStatement(null);
    }

    // 6. If currently logged in user is the deleted student, log them out
    if (currentUser?.role === 'student' && currentUser.studentId && studentIdsSet.has(currentUser.studentId)) {
      handleLogout();
    }
  };

  // Auth Handlers
  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    portalStorage.saveCurrentUser(user);
    if (user.role === 'student') {
      setCurrentPage('my-placement');
    } else {
      setCurrentPage('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    portalStorage.saveCurrentUser(null);
  };

  const handleResetDemoData = () => {
    portalStorage.resetDemoData();
    setStudents(portalStorage.getStudents());
    setDrives(portalStorage.getDrives());
    setApplications(portalStorage.getApplications());
    setCategories(portalStorage.getCategories());
    setClearances(portalStorage.getClearances());
  };

  // Navigation router helper
  const handleNavigate = (page: string, params?: any) => {
    if (params?.reportId) {
      setActiveReportId(params.reportId);
    }
    if (params?.filterStatus) {
      setGridInitialFilterStatus(params.filterStatus);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Student registers for a drive
  const handleStudentRegisterDrive = (driveId: string) => {
    if (!currentUser || currentUser.role !== 'student' || !currentUser.studentId) return;

    const studentId = currentUser.studentId;
    const drive = drives.find((d) => d.id === driveId);
    if (!drive) return;

    // Update drive registrations
    const updatedDrive: Drive = {
      ...drive,
      registeredStudentIds: [...drive.registeredStudentIds, studentId],
    };
    handleUpdateDrives(drives.map((d) => (d.id === driveId ? updatedDrive : d)));

    // Create application
    const newApp: Application = {
      id: `app-${Date.now()}`,
      studentId,
      driveId,
      company: drive.company,
      role: drive.role,
      stage: 'Registered',
      stageHistory: [{ stage: 'Registered', timestamp: new Date().toISOString().split('T')[0] }],
      isOfferPublished: false,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    handleUpdateApplications([newApp, ...applications]);
  };

  // If unauthenticated, show Login Page
  if (!currentUser) {
    return (
      <ToastProvider>
        <LoginPage onLogin={handleLogin} students={students} />
      </ToastProvider>
    );
  }

  // Find Student Profile Object if student logged in
  const currentStudentObj =
    currentUser.role === 'student'
      ? students.find((s) => s.id === currentUser.studentId) || students[0]
      : null;

  // ROUTE GUARDS: If student attempts to view an in-charge page
  const inChargePages = [
    'dashboard',
    'students',
    'import-students',
    'drives',
    'applications',
    'reports',
    'checklist-setup',
    'clearance-grid',
    'statements',
    'settings',
  ];

  const isStudentAttemptingInCharge =
    currentUser.role === 'student' && inChargePages.includes(currentPage);

  return (
    <ToastProvider>
      <AppShell
        user={currentUser}
        onLogout={handleLogout}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        allStudents={students}
        onSelectStudent={(stu) => {
          setSelectedStudentForProfile(stu);
          setCurrentPage('students');
        }}
        onResetDemoData={handleResetDemoData}
        onSwitchUser={(switchedUser) => {
          handleLogin(switchedUser);
        }}
      >
        {/* ROUTE GUARD 403 SCREEN */}
        {isStudentAttemptingInCharge ? (
          <Forbidden403 onGoToDashboard={() => setCurrentPage('my-placement')} />
        ) : currentUser.role === 'student' ? (
          /* ========================================================= */
          /* STUDENT PORTAL SCREENS */
          /* ========================================================= */
          <>
            {currentStudentObj && currentPage === 'my-placement' && (
              <StudentPlacementPage
                student={currentStudentObj}
                drives={drives}
                applications={applications}
                onRegisterDrive={handleStudentRegisterDrive}
                onNavigateToNoDues={() => setCurrentPage('my-nodues')}
              />
            )}

            {currentStudentObj && currentPage === 'my-nodues' && (
              <StudentNoDuesPage
                student={currentStudentObj}
                categories={categories}
                clearances={clearances}
                onPrintStatement={() => {
                  setSelectedStudentForStatement(currentStudentObj.id);
                  window.print();
                }}
              />
            )}

            {currentStudentObj && currentPage === 'profile' && (
              <StudentProfilePage student={currentStudentObj} />
            )}
          </>
        ) : (
          /* ========================================================= */
          /* IN-CHARGE SCREENS */
          /* ========================================================= */
          <>
            {currentPage === 'dashboard' && (
              <DashboardPage
                students={students}
                drives={drives}
                applications={applications}
                categories={categories}
                clearances={clearances}
                onNavigate={handleNavigate}
                onSelectStudent={(s) => {
                  setSelectedStudentForProfile(s);
                  setCurrentPage('students');
                }}
              />
            )}

            {currentPage === 'students' && (
              <StudentsPage
                students={students}
                onUpdateStudents={handleUpdateStudents}
                onDeleteStudents={handleDeleteStudents}
                applications={applications}
                drives={drives}
                categories={categories}
                clearances={clearances}
                initialSelectedStudent={selectedStudentForProfile}
                onNavigateToStatements={(studentId) => {
                  setSelectedStudentForStatement(studentId);
                  setCurrentPage('statements');
                }}
              />
            )}

            {currentPage === 'import-students' && (
              <ImportStudentsPage
                existingStudents={students}
                onImportComplete={(newBatch) => {
                  handleUpdateStudents([...newBatch, ...students]);
                }}
                onNavigateToStudents={() => setCurrentPage('students')}
              />
            )}

            {currentPage === 'drives' && (
              <DrivesPage
                drives={drives}
                onUpdateDrives={handleUpdateDrives}
                students={students}
                applications={applications}
                onUpdateApplications={handleUpdateApplications}
                onSelectStudent={(s) => {
                  setSelectedStudentForProfile(s);
                  setCurrentPage('students');
                }}
              />
            )}

            {currentPage === 'applications' && (
              <ApplicationsPage
                applications={applications}
                onUpdateApplications={handleUpdateApplications}
                students={students}
                drives={drives}
                onSelectStudent={(s) => {
                  setSelectedStudentForProfile(s);
                  setCurrentPage('students');
                }}
              />
            )}

            {currentPage === 'checklist-setup' && (
              <ChecklistSetupPage
                categories={categories}
                onUpdateCategories={handleUpdateCategories}
              />
            )}

            {currentPage === 'clearance-grid' && (
              <ClearanceGridPage
                students={students}
                categories={categories}
                clearances={clearances}
                onUpdateClearances={handleUpdateClearances}
                onNavigateToStatements={(studentId) => {
                  setSelectedStudentForStatement(studentId);
                  setCurrentPage('statements');
                }}
                initialFilterStatus={gridInitialFilterStatus}
              />
            )}

            {currentPage === 'statements' && (
              <StatementsPage
                students={students}
                categories={categories}
                clearances={clearances}
                initialStudentId={selectedStudentForStatement}
              />
            )}

            {currentPage === 'reports' && (
              <ReportsPage
                students={students}
                drives={drives}
                applications={applications}
                categories={categories}
                clearances={clearances}
                onNavigateToStatements={(studentId) => {
                  setSelectedStudentForStatement(studentId || null);
                  setCurrentPage('statements');
                }}
                initialReportId={activeReportId}
              />
            )}

            {currentPage === 'settings' && (
              <SettingsPage onResetDemoData={handleResetDemoData} />
            )}
          </>
        )}
      </AppShell>
    </ToastProvider>
  );
}
