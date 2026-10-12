import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Briefcase,
  FileSpreadsheet,
  BarChart3,
  CheckSquare,
  Grid3X3,
  FileText,
  RotateCcw,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
} from 'lucide-react';
import { AuthUser, Student } from '../../services/placementNoDuesService';
import { Button } from '../ui/Button';

export type InChargePage =
  | 'dashboard'
  | 'students'
  | 'import-students'
  | 'drives'
  | 'applications'
  | 'reports'
  | 'checklist-setup'
  | 'clearance-grid'
  | 'statements'
  | 'settings';

export type StudentPage = 'my-placement' | 'my-nodues' | 'profile';

interface AppShellProps {
  user: AuthUser | null;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  onSelectStudent?: (student: Student) => void;
  allStudents?: Student[];
  onResetDemoData?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  onLogout,
  currentPage,
  onNavigate,
  onSelectStudent,
  allStudents = [],
  onResetDemoData,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isStudent = user?.role === 'student';

  // Quick student search results
  const searchResults =
    globalSearch.trim().length > 1
      ? allStudents.filter(
          (s) =>
            s.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
            s.rollNo.toLowerCase().includes(globalSearch.toLowerCase())
        ).slice(0, 5)
      : [];

  const navItemClass = (pageKey: string) => {
    const isActive = currentPage === pageKey;
    return `w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors text-left select-none relative ${
      isActive
        ? 'text-[#1F4D3F] font-bold bg-[#FAF8F3]'
        : 'text-[#6B6F6A] hover:text-[#1C1F1D] hover:bg-[#FAF8F3]'
    }`;
  };

  const activeBarClass = (pageKey: string) => {
    return currentPage === pageKey
      ? 'absolute left-0 top-0 bottom-0 w-[3px] bg-[#C2501F]'
      : 'hidden';
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col text-[#1C1F1D]">
      {/* ---------------- STUDENT TOP HEADER ---------------- */}
      {isStudent ? (
        <header className="sticky top-0 z-30 bg-white border-b border-[#E4DFD3] no-print">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <span className="font-serif text-lg font-medium tracking-tight text-[#1C1F1D] whitespace-nowrap">
                Apex University
              </span>
              <nav className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => onNavigate('my-placement')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors cursor-pointer ${
                    currentPage === 'my-placement'
                      ? 'bg-[#FAF8F3] text-[#1F4D3F] font-semibold border-b-2 border-[#1F4D3F]'
                      : 'text-[#6B6F6A] hover:text-[#1C1F1D]'
                  }`}
                >
                  My Placement
                </button>
                <button
                  onClick={() => onNavigate('my-nodues')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors cursor-pointer ${
                    currentPage === 'my-nodues'
                      ? 'bg-[#FAF8F3] text-[#1F4D3F] font-semibold border-b-2 border-[#1F4D3F]'
                      : 'text-[#6B6F6A] hover:text-[#1C1F1D]'
                  }`}
                >
                  My No-Dues
                </button>
                <button
                  onClick={() => onNavigate('profile')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors cursor-pointer ${
                    currentPage === 'profile'
                      ? 'bg-[#FAF8F3] text-[#1F4D3F] font-semibold border-b-2 border-[#1F4D3F]'
                      : 'text-[#6B6F6A] hover:text-[#1C1F1D]'
                  }`}
                >
                  Profile
                </button>
              </nav>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-[#1C1F1D] leading-tight">
                  {user?.name}
                </p>
                <p className="text-[11px] text-[#6B6F6A] leading-tight">
                  Student · {user?.department || 'Engineering'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
                onClick={onLogout}
                className="text-xs text-[#6B6F6A] hover:text-[#9E2A2B]"
              >
                Sign out
              </Button>
            </div>
          </div>
        </header>
      ) : (
        /* ---------------- IN-CHARGE SHELL (SIDEBAR + TOP STRIP) ---------------- */
        <div className="flex flex-1 min-h-screen">
          {/* DESKTOP SIDEBAR (240px, white, thin right border) */}
          <aside className="hidden lg:flex w-[240px] bg-white border-r border-[#E4DFD3] flex-col shrink-0 sticky top-0 h-screen overflow-y-auto no-scrollbar z-20 no-print">
            {/* University Brand Header */}
            <div className="p-4 border-b border-[#E4DFD3]">
              <h1 className="font-serif text-lg font-medium tracking-tight text-[#1C1F1D] leading-snug">
                Apex University
              </h1>
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B6F6A] mt-0.5">
                Placement & No-Dues
              </p>
            </div>

            {/* Navigation Groups */}
            <div className="p-3 space-y-6 flex-1">
              {/* PLACEMENT GROUP */}
              <div>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] mb-1.5">
                  Placement
                </p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className={navItemClass('dashboard')}
                  >
                    <span className={activeBarClass('dashboard')} />
                    <LayoutDashboard className="w-4 h-4 stroke-[1.5]" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => onNavigate('students')}
                    className={navItemClass('students')}
                  >
                    <span className={activeBarClass('students')} />
                    <Users className="w-4 h-4 stroke-[1.5]" />
                    <span>Students</span>
                  </button>
                  <button
                    onClick={() => onNavigate('import-students')}
                    className={navItemClass('import-students')}
                  >
                    <span className={activeBarClass('import-students')} />
                    <UserPlus className="w-4 h-4 stroke-[1.5]" />
                    <span>Import Students</span>
                  </button>
                  <button
                    onClick={() => onNavigate('drives')}
                    className={navItemClass('drives')}
                  >
                    <span className={activeBarClass('drives')} />
                    <Briefcase className="w-4 h-4 stroke-[1.5]" />
                    <span>Drives</span>
                  </button>
                  <button
                    onClick={() => onNavigate('applications')}
                    className={navItemClass('applications')}
                  >
                    <span className={activeBarClass('applications')} />
                    <FileSpreadsheet className="w-4 h-4 stroke-[1.5]" />
                    <span>Applications Tracker</span>
                  </button>
                  <button
                    onClick={() => onNavigate('reports')}
                    className={navItemClass('reports')}
                  >
                    <span className={activeBarClass('reports')} />
                    <BarChart3 className="w-4 h-4 stroke-[1.5]" />
                    <span>Reports</span>
                  </button>
                </div>
              </div>

              {/* NO-DUES GROUP */}
              <div>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] mb-1.5">
                  No-Dues
                </p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => onNavigate('checklist-setup')}
                    className={navItemClass('checklist-setup')}
                  >
                    <span className={activeBarClass('checklist-setup')} />
                    <CheckSquare className="w-4 h-4 stroke-[1.5]" />
                    <span>Checklist Setup</span>
                  </button>
                  <button
                    onClick={() => onNavigate('clearance-grid')}
                    className={navItemClass('clearance-grid')}
                  >
                    <span className={activeBarClass('clearance-grid')} />
                    <Grid3X3 className="w-4 h-4 stroke-[1.5]" />
                    <span>Clearance Grid</span>
                  </button>
                  <button
                    onClick={() => onNavigate('statements')}
                    className={navItemClass('statements')}
                  >
                    <span className={activeBarClass('statements')} />
                    <FileText className="w-4 h-4 stroke-[1.5]" />
                    <span>Statements</span>
                  </button>
                </div>
              </div>

              {/* ADMIN GROUP */}
              <div>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] mb-1.5">
                  Admin
                </p>
                <div className="space-y-0.5">
                  {onResetDemoData && (
                    <button
                      onClick={onResetDemoData}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#6B6F6A] hover:text-[#C2501F] hover:bg-[#FAF8F3] transition-colors rounded-[4px] text-left cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 stroke-[1.5]" />
                      <span>Load Demo Data</span>
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate('settings')}
                    className={navItemClass('settings')}
                  >
                    <span className={activeBarClass('settings')} />
                    <Settings className="w-4 h-4 stroke-[1.5]" />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar User Footer */}
            <div className="p-3 border-t border-[#E4DFD3] bg-[#FCFBF8]">
              <div className="flex items-center justify-between">
                <div className="truncate pr-2">
                  <p className="text-xs font-semibold text-[#1C1F1D] truncate">
                    {user?.name}
                  </p>
                  <p className="text-[11px] text-[#6B6F6A] uppercase tracking-wider truncate">
                    Placement In-Charge
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-[#6B6F6A] hover:text-[#9E2A2B] rounded transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>

          {/* MOBILE SLIDE-IN DRAWER */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="fixed inset-0 bg-[#1C1F1D]/40"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-[#E4DFD3] flex flex-col p-4 shadow-xl z-10">
                <div className="flex items-center justify-between pb-3 border-b border-[#E4DFD3]">
                  <span className="font-serif text-lg font-medium text-[#1C1F1D]">
                    Apex University
                  </span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-[#6B6F6A]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-4 space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A] mb-1">
                      Placement
                    </p>
                    <div className="space-y-1">
                      {[
                        { id: 'dashboard', label: 'Dashboard' },
                        { id: 'students', label: 'Students' },
                        { id: 'import-students', label: 'Import Students' },
                        { id: 'drives', label: 'Drives' },
                        { id: 'applications', label: 'Applications Tracker' },
                        { id: 'reports', label: 'Reports' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            onNavigate(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded ${
                            currentPage === item.id
                              ? 'bg-[#FAF8F3] text-[#1F4D3F] font-bold'
                              : 'text-[#6B6F6A]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A] mb-1">
                      No-Dues
                    </p>
                    <div className="space-y-1">
                      {[
                        { id: 'checklist-setup', label: 'Checklist Setup' },
                        { id: 'clearance-grid', label: 'Clearance Grid' },
                        { id: 'statements', label: 'Statements' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            onNavigate(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded ${
                            currentPage === item.id
                              ? 'bg-[#FAF8F3] text-[#1F4D3F] font-bold'
                              : 'text-[#6B6F6A]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E4DFD3] flex items-center justify-between">
                  <div className="truncate">
                    <p className="text-xs font-semibold text-[#1C1F1D]">{user?.name}</p>
                    <p className="text-[10px] text-[#6B6F6A]">Placement In-Charge</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onLogout}>
                    Sign out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MAIN COLUMN (TOP STRIP + CONTENT) */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* TOP STRIP */}
            <header className="sticky top-0 z-20 bg-white border-b border-[#E4DFD3] px-4 sm:px-6 h-14 flex items-center justify-between gap-4 shrink-0 no-print">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-1.5 text-[#6B6F6A] hover:text-[#1C1F1D] rounded"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-base sm:text-lg font-medium text-[#1C1F1D] capitalize">
                    {currentPage.replace('-', ' ')}
                  </h2>
                </div>
              </div>

              {/* Top search & User Switcher / Profile */}
              <div className="flex items-center gap-3">
                {/* Global search */}
                <div className="relative hidden md:block">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#6B6F6A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={globalSearch}
                      onChange={(e) => {
                        setGlobalSearch(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      placeholder="Search students by roll or name..."
                      className="w-64 h-8 pl-8 pr-3 text-xs bg-[#FAF8F3] hover:bg-white focus:bg-white border border-[#E4DFD3] rounded-[4px] text-[#1C1F1D] focus:outline-none focus:border-[#1F4D3F] placeholder:text-[#6B6F6A]"
                    />
                  </div>

                  {/* Search dropdown results */}
                  {searchOpen && globalSearch.trim().length > 1 && (
                    <div className="absolute right-0 top-10 w-80 bg-white border border-[#E4DFD3] rounded-[6px] shadow-lg z-30 p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A] px-2 py-1">
                        Matching Students ({searchResults.length})
                      </div>
                      {searchResults.length === 0 ? (
                        <div className="p-3 text-xs text-[#6B6F6A] text-center">
                          No students found matching "{globalSearch}".
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {searchResults.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => {
                                if (onSelectStudent) {
                                  onSelectStudent(s);
                                }
                                onNavigate('students');
                                setSearchOpen(false);
                                setGlobalSearch('');
                              }}
                              className="px-2.5 py-1.5 rounded hover:bg-[#FAF8F3] cursor-pointer flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-medium text-[#1C1F1D]">{s.name}</p>
                                <p className="text-[11px] text-[#6B6F6A]">
                                  {s.rollNo} · {s.department}
                                </p>
                              </div>
                              <span className="text-[10px] bg-[#EAF3ED] text-[#1E5631] px-1.5 py-0.5 rounded">
                                {s.placementStatus}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Dropdown with quick Role Testing Switcher */}
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-[4px] hover:bg-[#FAF8F3] transition-colors cursor-pointer text-left border border-transparent hover:border-[#E4DFD3]"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#1F4D3F] text-white flex items-center justify-center text-xs font-semibold">
                      {user?.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-[#1C1F1D] hidden sm:inline">
                      {user?.name}
                    </span>
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 top-10 w-64 bg-white border border-[#E4DFD3] rounded-[6px] shadow-lg p-2 z-30">
                      <div className="px-2.5 py-2 border-b border-[#E4DFD3] mb-1">
                        <p className="text-xs font-semibold text-[#1C1F1D]">{user?.name}</p>
                        <p className="text-[11px] text-[#6B6F6A]">{user?.email}</p>
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold bg-[#EAF3ED] text-[#1E5631] px-1.5 py-0.5 rounded">
                          {user?.role === 'incharge' ? 'Placement In-Charge' : 'Student'}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-[#9E2A2B] hover:bg-[#FCECEE] rounded mt-1 flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* MAIN VIEWPORT CONTENT */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      )}

      {/* Student Viewport Content */}
      {isStudent && (
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      )}
    </div>
  );
};
