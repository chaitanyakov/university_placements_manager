import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { AuthUser, Student } from '../../services/placementNoDuesService';

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
  students: Student[];
}

type SelectedRole = 'incharge' | 'student' | null;

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, students }) => {
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectRole = (role: 'incharge' | 'student') => {
    setSelectedRole(role);
    setError(null);
    setEmail('');
    setPassword('');
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setError(null);
    setEmail('');
    setPassword('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password.trim()) {
      setError('Please enter both your university email and password.');
      return;
    }

    setIsLoading(true);

    // Simulate async authentication & Firestore users/{uid} lookup
    setTimeout(() => {
      setIsLoading(false);

      // 1. Check if user belongs to incharge group
      const isInchargeAccount =
        cleanEmail === 'placement.officer@apex.edu' ||
        cleanEmail === 'admin@apex.edu' ||
        cleanEmail === 'incharge@apex.edu';

      // 2. Check if user belongs to student group
      const matchedStudent = students.find(
        (s) => s.email.toLowerCase() === cleanEmail || s.rollNo.toLowerCase() === cleanEmail
      );

      // Check existence
      if (!isInchargeAccount && !matchedStudent) {
        setError("Your account isn't set up yet. Contact the placement office.");
        return;
      }

      // Check simple password minimum requirement
      if (password.length < 3) {
        setError('That email or password is incorrect.');
        return;
      }

      // 3. ROLE VERIFICATION: Compare user's doc role with door used
      if (selectedRole === 'incharge') {
        if (!isInchargeAccount && matchedStudent) {
          // A student tried to use the In-Charge door
          setError('This account is a Student account. Please use the Student login.');
          return;
        }

        // Login success for In-Charge
        onLogin({
          id: 'usr-incharge',
          email: 'placement.officer@apex.edu',
          name: 'Dr. V. Ramanathan',
          role: 'incharge',
        });
      } else if (selectedRole === 'student') {
        if (isInchargeAccount && !matchedStudent) {
          // An incharge tried to use the Student door
          setError('This account is a Placement In-Charge account. Please use the In-Charge login.');
          return;
        }

        if (matchedStudent) {
          // Login success for Student
          onLogin({
            id: matchedStudent.id,
            email: matchedStudent.email,
            name: matchedStudent.name,
            role: 'student',
            studentId: matchedStudent.id,
            department: matchedStudent.department,
          });
        } else {
          setError("Your account isn't set up yet. Contact the placement office.");
        }
      }
    }, 450);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F7F4EE] text-[#1C1F1D]">
      {/* SLIM TOP BAR */}
      <header className="h-14 border-b border-[#E4DFD3] bg-[#F7F4EE] px-6 sm:px-10 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg sm:text-xl font-medium tracking-tight text-[#1C1F1D]">
            Apex University
          </span>
          <span className="text-[#6B6F6A] text-xs hidden sm:inline">
            · Placement & Clearance Portal
          </span>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col justify-center">
        {selectedRole === null ? (
          /* ========================================================= */
          /* TWO-PANEL ROLE SELECTION ENTRY */
          /* ========================================================= */
          <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1280px] mx-auto">
            {/* LEFT PANEL: PLACEMENT IN-CHARGE */}
            <section
              aria-labelledby="heading-incharge"
              className="flex-1 p-8 sm:p-12 lg:p-16 flex flex-col justify-between transition-colors duration-150 hover:bg-[#FAF8F3] border-b md:border-b-0 md:border-r border-[#E4DFD3]"
            >
              <div>
                {/* Chip */}
                <div className="inline-block text-[11px] font-semibold uppercase tracking-[0.06em] bg-[#1F4D3F] text-white px-2.5 py-1 rounded-[4px] mb-6">
                  PLACEMENT OFFICE
                </div>

                {/* Heading (Fraunces, 40px) */}
                <h2
                  id="heading-incharge"
                  className="font-serif text-[32px] sm:text-[38px] lg:text-[40px] font-medium tracking-tight text-[#1C1F1D] leading-[1.15] mb-4 text-balance"
                >
                  For Placement <em className="italic font-normal">In-Charge</em>
                </h2>

                {/* Description (muted, max 2 lines) */}
                <p className="text-sm text-[#6B6F6A] max-w-md leading-relaxed mb-8">
                  Manage students, recruitment drives, placement analytics and department no-dues clearances.
                </p>

                {/* Button (solid deep green, 44px) */}
                <button
                  type="button"
                  onClick={() => handleSelectRole('incharge')}
                  className="h-[44px] px-6 text-sm font-medium bg-[#1F4D3F] text-white hover:bg-[#173C31] rounded-[6px] transition-colors duration-120 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2501F] focus-visible:ring-offset-1 select-none"
                >
                  Login as In-Charge
                </button>
              </div>

              {/* Footer text (muted) */}
              <div className="mt-8 pt-6 border-t border-[#E4DFD3]">
                <p className="text-xs text-[#6B6F6A]">
                  Need access? Contact the university administrator.
                </p>
              </div>
            </section>

            {/* RIGHT PANEL: STUDENT */}
            <section
              aria-labelledby="heading-student"
              className="flex-1 p-8 sm:p-12 lg:p-16 flex flex-col justify-between transition-colors duration-150 hover:bg-[#FAF8F3]"
            >
              <div>
                {/* White chip with border */}
                <div className="inline-block text-[11px] font-semibold uppercase tracking-[0.06em] bg-white text-[#1C1F1D] border border-[#E4DFD3] px-2.5 py-1 rounded-[4px] mb-6">
                  STUDENT
                </div>

                {/* Heading (Fraunces, 40px) */}
                <h2
                  id="heading-student"
                  className="font-serif text-[32px] sm:text-[38px] lg:text-[40px] font-medium tracking-tight text-[#1C1F1D] leading-[1.15] mb-4 text-balance"
                >
                  For <em className="italic font-normal">Students</em>
                </h2>

                {/* Description (muted, max 2 lines) */}
                <p className="text-sm text-[#6B6F6A] max-w-md leading-relaxed mb-8">
                  Track your applications, view published offers and check your no-dues status.
                </p>

                {/* Button (solid deep green, 44px) */}
                <button
                  type="button"
                  onClick={() => handleSelectRole('student')}
                  className="h-[44px] px-6 text-sm font-medium bg-[#1F4D3F] text-white hover:bg-[#173C31] rounded-[6px] transition-colors duration-120 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2501F] focus-visible:ring-offset-1 select-none"
                >
                  Login as Student
                </button>
              </div>

              {/* Footer text (muted) */}
              <div className="mt-8 pt-6 border-t border-[#E4DFD3]">
                <p className="text-xs text-[#6B6F6A] leading-normal">
                  Your login was created by the placement office. Check your university email for your credentials.
                </p>
              </div>
            </section>
          </div>
        ) : (
          /* ========================================================= */
          /* SAME-PAGE LOGIN FORM (Centered Card 400px wide) */
          /* ========================================================= */
          <div className="w-full flex items-center justify-center p-4 sm:p-6 my-auto">
            <div className="w-full max-w-[400px] bg-white border border-[#E4DFD3] rounded-[6px] p-6 sm:p-8 shadow-none">
              {/* Back link */}
              <button
                type="button"
                onClick={handleBackToRoles}
                className="inline-flex items-center gap-1.5 text-xs text-[#6B6F6A] hover:text-[#1F4D3F] transition-colors cursor-pointer mb-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2501F] rounded-[4px] px-1 py-0.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Choose a different role</span>
              </button>

              {/* Role badge */}
              <div className="mb-2">
                {selectedRole === 'incharge' ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] bg-[#1F4D3F] text-white px-2 py-0.5 rounded-[3px]">
                    Placement In-Charge
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] bg-[#FAF8F3] text-[#1C1F1D] border border-[#E4DFD3] px-2 py-0.5 rounded-[3px]">
                    Student Portal
                  </span>
                )}
              </div>

              {/* Form title */}
              <h2 className="font-serif text-2xl font-medium text-[#1C1F1D] mb-1.5">
                {selectedRole === 'incharge'
                  ? 'Sign in as Placement In-Charge'
                  : 'Sign in as Student'}
              </h2>
              <p className="text-xs text-[#6B6F6A] mb-6">
                {selectedRole === 'incharge'
                  ? 'Access administrative controls, recruitment drives, and clearance records.'
                  : 'Access your placement applications, interview rounds, and no-dues certificate.'}
              </p>

              {/* Plain-Language Inline Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="mb-5 p-3 rounded-[4px] bg-[#FCECEE] border border-[#F6C6CA] text-[#9E2A2B] text-xs leading-normal"
                >
                  {error}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] mb-1.5"
                  >
                    University email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#6B6F6A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="text"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        selectedRole === 'incharge'
                          ? 'placement.officer@apex.edu'
                          : 'aarav.sharma@apex.edu or 21CS001'
                      }
                      className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-[#E4DFD3] rounded-[4px] text-[#1C1F1D] placeholder:text-[#8C9189] focus:outline-none focus:border-[#1F4D3F] focus:ring-1 focus:ring-[#1F4D3F]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold uppercase tracking-[0.06em] text-[#6B6F6A] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#6B6F6A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full h-10 pl-9 pr-10 text-sm bg-white border border-[#E4DFD3] rounded-[4px] text-[#1C1F1D] placeholder:text-[#8C9189] focus:outline-none focus:border-[#1F4D3F] focus:ring-1 focus:ring-[#1F4D3F]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6F6A] hover:text-[#1C1F1D] p-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2501F] rounded"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Sign In Button (44px, solid deep green, loading state) */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[44px] mt-2 inline-flex items-center justify-center gap-2 rounded-[6px] text-sm font-medium bg-[#1F4D3F] text-white hover:bg-[#173C31] transition-colors duration-120 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2501F] focus-visible:ring-offset-1 disabled:opacity-60 disabled:pointer-events-none select-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>
              </form>

              {/* Demo Credentials Helper */}
              <div className="mt-6 pt-4 border-t border-[#F2EFE9] text-xs text-[#6B6F6A]">
                <p className="font-semibold text-[11px] uppercase tracking-wider text-[#1C1F1D] mb-1.5">
                  Demo Credentials:
                </p>
                {selectedRole === 'incharge' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('placement.officer@apex.edu');
                      setPassword('password123');
                    }}
                    className="text-left w-full hover:underline text-[#1F4D3F] block"
                  >
                    placement.officer@apex.edu · password123
                  </button>
                ) : (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('aarav.sharma@apex.edu');
                        setPassword('password123');
                      }}
                      className="text-left w-full hover:underline text-[#1F4D3F] block truncate"
                    >
                      aarav.sharma@apex.edu (Aarav Sharma)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('priya.patel@apex.edu');
                        setPassword('password123');
                      }}
                      className="text-left w-full hover:underline text-[#1F4D3F] block truncate"
                    >
                      priya.patel@apex.edu (Priya Patel)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="h-10 border-t border-[#E4DFD3] bg-[#F7F4EE] px-6 sm:px-10 flex items-center justify-center shrink-0">
        <p className="text-xs text-[#6B6F6A]">
          © University Placement Office
        </p>
      </footer>
    </div>
  );
};
