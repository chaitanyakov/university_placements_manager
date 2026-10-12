/**
 * HireSight Placement & Department No-Dues Portal
 * Complete Frontend Implementation
 */

import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  Student,
  Drive,
  Application,
  ClearanceCategory,
  ClearanceRecord,
  AuthUser,
  Department,
  portalStorage,
} from './services/placementNoDuesService';
import {
  auth,
  db,
  deleteStudentFirebaseAccounts,
  saveChangedApplications,
  saveChangedClearances,
  saveChangedClearanceCategories,
  saveChangedDrives,
  saveChangedStudentProfiles,
  subscribeApplications,
  subscribeClearances,
  subscribeClearanceCategories,
  subscribeDepartments,
  subscribeDrives,
  subscribeStudents,
  subscribeStudentProfile,
} from './services/firebaseAuthService';
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
  const [departments, setDepartments] = useState<Department[]>(() =>
    portalStorage.getDepartments()
  );
  const [firestoreSyncError, setFirestoreSyncError] = useState<string | null>(null);
  const [firestoreSyncSignals, setFirestoreSyncSignals] = useState<string[]>([]);
  const initialAuthStateChecked = useRef(false);
  const markFirestoreSyncSignal = (collectionName: string) => {
    setFirestoreSyncSignals((current) =>
      current.includes(collectionName) ? current : [...current, collectionName]
    );
  };

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    if (initialAuthStateChecked.current) return;
    initialAuthStateChecked.current = true;
    if (!firebaseUser) {
      setCurrentUser(null);
      portalStorage.saveCurrentUser(null);
      return;
    }

    void getDoc(doc(db, 'users', firebaseUser.uid)).then((snapshot) => {
      const profile = snapshot.data();
      if (
        !snapshot.exists() ||
        profile?.active === false ||
        (profile?.role !== 'incharge' && profile?.role !== 'student')
      ) {
        setCurrentUser(null);
        portalStorage.saveCurrentUser(null);
        return;
      }
      const restoredUser: AuthUser = {
        id: firebaseUser.uid,
        email: String(profile.email || firebaseUser.email || ''),
        name: String(profile.name || firebaseUser.displayName || ''),
        role: profile.role,
        studentId: profile.studentId,
        rollNo: profile.rollNo,
        department: profile.department,
        active: profile.active,
        passwordChanged: profile.passwordChanged ?? false,
      };
      setCurrentUser(restoredUser);
      portalStorage.saveCurrentUser(restoredUser);
    }).catch((error: unknown) => {
      setCurrentUser(null);
      portalStorage.saveCurrentUser(null);
      setFirestoreSyncError(error instanceof Error ? error.message : String(error));
    });
  }), []);

  useEffect(() => {
    setFirestoreSyncSignals([]);
  }, [currentUser?.id]);

  // Firestore is the shared source of truth; local storage is only an offline cache.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeDepartments((liveDepts) => {
      setDepartments(liveDepts);
      portalStorage.saveDepartments(liveDepts);
      markFirestoreSyncSignal('departments');
      setFirestoreSyncError(null);
    }, (error) => {
      markFirestoreSyncSignal('departments');
      setFirestoreSyncError(error.message);
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeDrives((remoteDrives) => {
      setDrives(remoteDrives);
      portalStorage.saveDrives(remoteDrives);
      markFirestoreSyncSignal('drives');
      setFirestoreSyncError(null);
    }, (error) => {
      markFirestoreSyncSignal('drives');
      setFirestoreSyncError(error.message);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeClearanceCategories((remoteCategories) => {
      setCategories(remoteCategories);
      portalStorage.saveCategories(remoteCategories);
      markFirestoreSyncSignal('categories');
      setFirestoreSyncError(null);
    }, (error) => {
      markFirestoreSyncSignal('categories');
      setFirestoreSyncError(error.message);
    });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role !== 'incharge') return;
    return subscribeStudents((remoteStudents) => {
      setStudents(remoteStudents);
      portalStorage.saveStudents(remoteStudents);
      markFirestoreSyncSignal('students');
      setFirestoreSyncError(null);
    }, (error) => {
      markFirestoreSyncSignal('students');
      setFirestoreSyncError(error.message);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeApplications(currentUser, (remoteApplications) => {
      setApplications(remoteApplications);
      portalStorage.saveApplications(remoteApplications);
      markFirestoreSyncSignal('applications');
      setFirestoreSyncError(null);
    }, (error) => {
      markFirestoreSyncSignal('applications');
      setFirestoreSyncError(error.message);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeClearances(currentUser, (remoteClearances) => {
      setClearances(remoteClearances);
      portalStorage.saveClearances(remoteClearances);
      markFirestoreSyncSignal('clearances');
      setFirestoreSyncError(null);
    }, (error) => {
      markFirestoreSyncSignal('clearances');
      setFirestoreSyncError(error.message);
    });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role !== 'student' || !currentUser.rollNo) return;
    return subscribeStudentProfile(currentUser.rollNo, (profile) => {
      if (!profile || profile.id !== currentUser.studentId) return;
      setStudents((existing) => {
        const next = [...existing.filter((student) => student.id !== profile.id), profile];
        portalStorage.saveStudents(next);
        return next;
      });
      markFirestoreSyncSignal('student-profile');
      setFirestoreSyncError(null);
    }, (error) => {
      markFirestoreSyncSignal('student-profile');
      setFirestoreSyncError(error.message);
    });
  }, [currentUser]);

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
    const previous = students;
    setStudents(updated);
    portalStorage.saveStudents(updated);
    void saveChangedStudentProfiles(previous, updated).catch((error) => {
      console.error('Could not save student profile updates to Firestore:', error);
      setFirestoreSyncError(error instanceof Error ? error.message : String(error));
    });
  };

  const handleUpdateDrives = (updated: Drive[]) => {
    const previous = drives;
    setDrives(updated);
    portalStorage.saveDrives(updated);
    void saveChangedDrives(previous, updated).catch((error) => {
      console.error('Could not save placement drive updates to Firestore:', error);
      setFirestoreSyncError(error instanceof Error ? error.message : String(error));
    });
  };

  const handleUpdateApplications = (updated: Application[]) => {
    const previous = applications;
    setApplications(updated);
    portalStorage.saveApplications(updated);
    void saveChangedApplications(previous, updated).catch((error) => {
      console.error('Could not save application updates to Firestore:', error);
      setFirestoreSyncError(error instanceof Error ? error.message : String(error));
    });
  };

  const handleUpdateCategories = (updated: ClearanceCategory[]) => {
    const previous = categories;
    setCategories(updated);
    portalStorage.saveCategories(updated);
    void saveChangedClearanceCategories(previous, updated).catch((error) => {
      console.error('Could not save clearance category updates to Firestore:', error);
      setFirestoreSyncError(error instanceof Error ? error.message : String(error));
    });
  };

  const handleUpdateClearances = (updated: ClearanceRecord[]) => {
    const previous = clearances;
    setClearances(updated);
    portalStorage.saveClearances(updated);
    void saveChangedClearances(previous, updated).catch((error) => {
      console.error('Could not save clearance updates to Firestore:', error);
      setFirestoreSyncError(error instanceof Error ? error.message : String(error));
    });
  };

  const handleDeleteStudents = async (studentIds: string[]) => {
    const studentIdsSet = new Set(studentIds);
    const studentsToDelete = students.filter((student) => studentIdsSet.has(student.id));

    await deleteStudentFirebaseAccounts(studentsToDelete.map((student) => ({
      rollNo: student.rollNo,
      studentId: student.id,
      email: student.email,
    })));

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
    setDepartments(portalStorage.getDepartments());
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
    window.scrollTo({ top: 0, behavior: 'auto' });
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
      ? students.find((s) => s.id === currentUser.studentId)
      : null;

  const requiredSyncSignals = currentUser.role === 'incharge'
    ? ['departments', 'drives', 'categories', 'students', 'applications', 'clearances']
    : ['departments', 'drives', 'categories', 'applications', 'clearances', 'student-profile'];
  const isInitialFirestoreSyncComplete = requiredSyncSignals.every((signal) =>
    firestoreSyncSignals.includes(signal)
  );

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

  if (!isInitialFirestoreSyncComplete) {
    return (
      <ToastProvider>
        <div className="min-h-screen grid place-items-center bg-[#F8F7F3] p-6">
          <div className="max-w-lg rounded-lg border border-[#E4DFD3] bg-white p-6 text-center">
            <p className="text-sm font-semibold text-[#222722]">Loading shared HireSight data…</p>
            <p className="mt-2 text-sm text-[#6B6F6A]">
              Connecting to the shared roster and placement records for this account.
            </p>
            {firestoreSyncError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                Cloud sync failed: {firestoreSyncError}
              </p>
            )}
          </div>
        </div>
      </ToastProvider>
    );
  }

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
      >
        {firestoreSyncError && (
          <div role="alert" className="mx-5 mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            Cloud data sync failed: {firestoreSyncError}. Changes may not be shared with other devices.
          </div>
        )}
        {/* ROUTE GUARD 403 SCREEN */}
        {isStudentAttemptingInCharge ? (
          <Forbidden403 onGoToDashboard={() => setCurrentPage('my-placement')} />
        ) : currentUser.role === 'student' ? (
          /* ========================================================= */
          /* STUDENT PORTAL SCREENS */
          /* ========================================================= */
          <>
            {!currentStudentObj && (
              <div className="max-w-2xl mx-auto p-5 bg-white border border-[#E4DFD3] rounded-[6px] text-sm text-[#6B6F6A]">
                Your student profile is not available yet. Ask the placement office to sync your imported student record, then sign in again.
              </div>
            )}
            {currentStudentObj && currentPage === 'my-placement' && (
              <StudentPlacementPage
                student={currentStudentObj}
                drives={drives}
                applications={applications}
                onRegisterDrive={handleStudentRegisterDrive}
                onNavigateToNoDues={() => setCurrentPage('my-nodues')}
                passwordChanged={currentUser.passwordChanged ?? false}
                onNavigateToProfile={() => setCurrentPage('profile')}
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
              <StudentProfilePage
                student={currentStudentObj}
                currentUser={currentUser}
                onPasswordChanged={() => {
                  if (currentUser) {
                    const updated = { ...currentUser, passwordChanged: true };
                    setCurrentUser(updated);
                    portalStorage.saveCurrentUser(updated);
                  }
                }}
              />
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
                departments={departments}
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
                departments={departments}
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
                existingDepartments={departments}
                onImportComplete={async (
                  newBatch,
                  _newDepartmentsCreated,
                  newApplications = [],
                  newClearances = [],
                  importedDrives,
                  importedCategories
                ) => {
                  const nextStudents = [...newBatch, ...students];
                  const nextApplications = [...newApplications, ...applications];
                  const nextClearances = [...newClearances, ...clearances];
                  const nextDrives = importedDrives || drives;
                  const nextCategories = importedCategories || categories;
                  await Promise.all([
                    saveChangedStudentProfiles(students, nextStudents),
                    saveChangedApplications(applications, nextApplications),
                    saveChangedClearances(clearances, nextClearances),
                    importedDrives ? saveChangedDrives(drives, nextDrives) : Promise.resolve(),
                    importedCategories ? saveChangedClearanceCategories(categories, nextCategories) : Promise.resolve(),
                  ]);
                  setStudents(nextStudents);
                  portalStorage.saveStudents(nextStudents);
                  setApplications(nextApplications);
                  portalStorage.saveApplications(nextApplications);
                  setClearances(nextClearances);
                  portalStorage.saveClearances(nextClearances);
                  setDepartments(portalStorage.getDepartments());
                  if (importedDrives) {
                    setDrives(nextDrives);
                    portalStorage.saveDrives(nextDrives);
                  }
                  if (importedCategories) {
                    setCategories(nextCategories);
                    portalStorage.saveCategories(nextCategories);
                  }
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
                departments={departments}
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
                departments={departments}
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
                departments={departments}
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
                departments={departments}
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
