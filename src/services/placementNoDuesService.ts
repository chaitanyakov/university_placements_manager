/**
 * Shared Services & Data Layer for University Placement & Department No-Dues Portal
 * Provides strict mathematical calculations, persistent storage, and query helpers.
 */
import * as XLSX from 'xlsx';

export interface Department {
  id: string; // normalized lowercase slug, e.g. "ai-ml", "cse", "it"
  name: string; // display name, e.g. "AI & ML", "CSE"
  createdAt?: string;
}

/**
 * Normalizes a department name into a lowercase URL/ID slug.
 * Example: "AI & ML" -> "ai-ml", "Computer Science & Engineering" -> "computer-science-engineering"
 */
export function getDepartmentSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function showcaseHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createShowcaseStudentData(
  student: Student,
  drives: Drive[],
  categories: ClearanceCategory[]
): { student: Student; applications: Application[]; clearances: ClearanceRecord[] } {
  const seed = showcaseHash(student.rollNo.toUpperCase());
  const outcome = student.activeBacklogs > 0 || student.cgpa < 6 ? 4 : seed % 6;
  const isNotQualified = outcome === 4;
  const updatedStudent: Student = {
    ...student,
    activeBacklogs: isNotQualified ? Math.max(1, student.activeBacklogs) : student.activeBacklogs,
    isEligible: !isNotQualified && student.activeBacklogs === 0 && student.cgpa >= 6,
    placementStatus: isNotQualified
      ? 'Unplaced'
      : outcome === 0 || outcome === 1
        ? 'Placed'
        : outcome === 2
          ? 'Selected'
          : 'Shortlisted',
  };

  const availableDrives = drives.filter((drive) => drive.status !== 'Cancelled');
  const departmentDrives = availableDrives.filter((drive) =>
    drive.eligibleDepartments.includes(student.department)
  );
  const eligibleDrives = departmentDrives.length > 0
    ? departmentDrives
    : availableDrives;
  const applications: Application[] = [];
  if (eligibleDrives.length > 0) {
    const topPackageDrive = [...eligibleDrives].sort(
      (left, right) => right.packageLpa - left.packageLpa
    )[0];
    const drive = outcome === 0
      ? topPackageDrive
      : eligibleDrives[Math.floor(seed / 6) % eligibleDrives.length];
    const stage: ApplicationStage = [
      'Joined',
      'Offer',
      'Selected',
      'Interview',
      'Rejected',
      'Assessment',
    ][outcome] as ApplicationStage;
    const updatedAt = '2026-10-12';
    applications.push({
      id: `showcase-${updatedStudent.id}-${drive.id}`,
      studentId: updatedStudent.id,
      driveId: drive.id,
      company: drive.company,
      role: drive.role,
      stage,
      stageHistory: [
        { stage: 'Registered', timestamp: '2026-09-15' },
        { stage, timestamp: updatedAt, notes: 'Showcase placement outcome' },
      ],
      packageLpa: drive.packageLpa,
      isOfferPublished: stage === 'Offer' || stage === 'Joined',
      updatedAt,
    });
  }

  const clearanceStates: ClearanceStatus[] = [
    'Cleared',
    'Cleared',
    'Cleared',
    'Cleared',
    'Cleared',
    'Pending',
    'Pending',
    'Rejected',
    'Further action required',
    'Not Applicable',
  ];
  const clearances = categories.map((category) => {
    const status = clearanceStates[showcaseHash(`${student.rollNo}:${category.id}`) % clearanceStates.length];
    const remarks = status === 'Cleared' || status === 'Not Applicable'
      ? status === 'Cleared' ? 'Verified and approved.' : 'Not applicable to this student.'
      : status === 'Pending'
        ? 'Awaiting department verification.'
        : status === 'Rejected'
          ? 'A department requirement remains unresolved.'
          : 'Please contact the department to complete the required action.';
    return {
      id: `clr-${updatedStudent.id}-${category.id}`,
      studentId: updatedStudent.id,
      categoryId: category.id,
      status,
      remarks,
      pendingRequirements: status === 'Pending' || status === 'Rejected' || status === 'Further action required'
        ? [`Follow up with ${category.name}.`]
        : [],
      updatedAt: '2026-10-12',
      updatedBy: 'Placement Office',
    };
  });

  return { student: updatedStudent, applications, clearances };
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  department: string;
  deptId?: string;
  program: string;
  year: number;
  section: string;
  batch: string; // e.g. "2025", "2026"
  cgpa: number;
  activeBacklogs: number;
  isRegistered: boolean;
  isEligible: boolean;
  placementStatus: 'Unplaced' | 'Shortlisted' | 'Selected' | 'Placed' | 'Offer Received' | 'Joined';
  phone?: string;
  skills: string[];
  sourceData?: Record<string, unknown>;
}

export interface Drive {
  id: string;
  company: string;
  role: string;
  description: string;
  eligibleDepartments: string[];
  eligibleBatches: string[];
  minCgpa: number;
  maxBacklogs: number;
  skills: string[];
  deadline: string; // YYYY-MM-DD
  stages: string[];
  location: string;
  packageLpa: number;
  status: 'Planned' | 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
  registeredStudentIds: string[];
  createdAt: string;
  sourceData?: Record<string, unknown>;
}

export type ApplicationStage =
  | 'Registered'
  | 'Eligibility Verified'
  | 'Shortlisted'
  | 'Assessment'
  | 'Interview'
  | 'Selected'
  | 'Offer'
  | 'Joined'
  | 'Rejected'
  | 'Withdrawn';

export interface Application {
  id: string;
  studentId: string;
  driveId: string;
  company: string;
  role: string;
  stage: ApplicationStage;
  stageHistory: Array<{ stage: ApplicationStage; timestamp: string; notes?: string }>;
  packageLpa?: number;
  isOfferPublished: boolean;
  updatedAt: string;
  nextActionDate?: string;
  sourceData?: Record<string, unknown>;
}

export interface ClearanceCategory {
  id: string;
  name: string;
  isMandatory: boolean;
  isActive: boolean;
  order: number;
  description?: string;
  sourceData?: Record<string, unknown>;
}

export type ClearanceStatus =
  | 'Pending'
  | 'Cleared'
  | 'Not Applicable'
  | 'Rejected'
  | 'Further action required';

export interface ClearanceRecord {
  id: string;
  studentId: string;
  categoryId: string;
  status: ClearanceStatus;
  remarks: string;
  pendingRequirements: string[];
  updatedAt: string;
  updatedBy: string;
  sourceData?: Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'incharge' | 'student';
  studentId?: string;
  rollNo?: string;
  department?: string;
  active?: boolean;
  passwordChanged?: boolean;
}

export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  role: 'incharge' | 'student';
  studentId?: string;
  rollNo?: string;
  department?: string;
  deptId?: string;
  active: boolean;
  passwordChanged: boolean;
  createdAt?: string;
}

export interface StudentDoc {
  rollNo: string;
  studentId: string;
  email: string;
  name: string;
  uid: string;
  department?: string;
  deptId?: string;
  createdAt?: string;
  profile?: Student;
}

// -------------------------------------------------------------
// DEFAULT DATA ENGINE SEEDS
// -------------------------------------------------------------

export const DEFAULT_CATEGORIES: ClearanceCategory[] = [
  { id: 'cat-lib', name: 'Library', isMandatory: true, isActive: true, order: 1, description: 'Book returns, lost book dues, overdue fines' },
  { id: 'cat-lab', name: 'Laboratory / Equipment', isMandatory: true, isActive: true, order: 2, description: 'Component kits, broken equipment replacement, project gear' },
  { id: 'cat-dept', name: 'Department', isMandatory: true, isActive: true, order: 3, description: 'Locker keys, mentor clearance, final project repository' },
  { id: 'cat-place', name: 'Placement Office', isMandatory: true, isActive: true, order: 4, description: 'Offer confirmation letter, survey response, bond verification' },
  { id: 'cat-acc', name: 'Accounts & Finance', isMandatory: true, isActive: true, order: 5, description: 'Tuition fees, caution deposit reconciliation, exam arrears' },
  { id: 'cat-hostel', name: 'Hostel & Mess', isMandatory: false, isActive: true, order: 6, description: 'Room vacation check, mess dues, maintenance damages' },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'stu-1',
    rollNo: '21CS001',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.92,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Joined',
    phone: '+91 98112 34501',
    skills: ['React', 'Node.js', 'Distributed Systems', 'Python'],
  },
  {
    id: 'stu-2',
    rollNo: '21CS014',
    name: 'Priya Patel',
    email: 'priya.patel@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 9.15,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34502',
    skills: ['C++', 'Machine Learning', 'Go', 'Algorithms'],
  },
  {
    id: 'stu-3',
    rollNo: '21CS028',
    name: 'Rohan Verma',
    email: 'rohan.verma@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 7.42,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34503',
    skills: ['Java', 'Spring Boot', 'SQL', 'Docker'],
  },
  {
    id: 'stu-4',
    rollNo: '21CS045',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 8.65,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Offer Received',
    phone: '+91 98112 34504',
    skills: ['TypeScript', 'Cloud Architecture', 'PostgreSQL'],
  },
  {
    id: 'stu-5',
    rollNo: '21CS052',
    name: 'Karan Mehra',
    email: 'karan.mehra@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 6.80,
    activeBacklogs: 1,
    isRegistered: true,
    isEligible: false,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34505',
    skills: ['HTML', 'CSS', 'JavaScript'],
  },
  {
    id: 'stu-6',
    rollNo: '21EC003',
    name: 'Neha Nambiar',
    email: 'neha.nambiar@apex.edu',
    department: 'Electronics & Communication',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.78,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Joined',
    phone: '+91 98112 34506',
    skills: ['VLSI', 'Verilog', 'Embedded C', 'DSP'],
  },
  {
    id: 'stu-7',
    rollNo: '21EC019',
    name: 'Aditya Kulkarni',
    email: 'aditya.kulkarni@apex.edu',
    department: 'Electronics & Communication',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.10,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34507',
    skills: ['Embedded Systems', 'IoT', 'Microcontrollers', 'C++'],
  },
  {
    id: 'stu-8',
    rollNo: '21EC034',
    name: 'Divya Nair',
    email: 'divya.nair@apex.edu',
    department: 'Electronics & Communication',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 7.25,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34508',
    skills: ['MATLAB', 'Signals & Systems', 'Communication Networks'],
  },
  {
    id: 'stu-9',
    rollNo: '21IT008',
    name: 'Vikram Sengupta',
    email: 'vikram.sengupta@apex.edu',
    department: 'Information Technology',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.35,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34509',
    skills: ['Cybersecurity', 'Linux', 'Network Protocols', 'Python'],
  },
  {
    id: 'stu-10',
    rollNo: '21IT022',
    name: 'Sneha Roy',
    email: 'sneha.roy@apex.edu',
    department: 'Information Technology',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.90,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34510',
    skills: ['Full Stack', 'Next.js', 'PostgreSQL', 'GraphQL'],
  },
  {
    id: 'stu-11',
    rollNo: '21IT031',
    name: 'Arjun Das',
    email: 'arjun.das@apex.edu',
    department: 'Information Technology',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 6.95,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34511',
    skills: ['Java', 'SQL', 'Web Foundations'],
  },
  {
    id: 'stu-12',
    rollNo: '21ME005',
    name: 'Farhan Siddiqui',
    email: 'farhan.siddiqui@apex.edu',
    department: 'Mechanical Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 7.85,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34512',
    skills: ['AutoCAD', 'SolidWorks', 'Thermodynamics', 'ANSYS'],
  },
  {
    id: 'stu-13',
    rollNo: '21ME018',
    name: 'Meera Menon',
    email: 'meera.menon@apex.edu',
    department: 'Mechanical Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.40,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34513',
    skills: ['FEA', 'Robotics', 'MATLAB', 'Manufacturing'],
  },
  {
    id: 'stu-14',
    rollNo: '21ME029',
    name: 'Tanmay Joshi',
    email: 'tanmay.joshi@apex.edu',
    department: 'Mechanical Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 6.70,
    activeBacklogs: 2,
    isRegistered: true,
    isEligible: false,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34514',
    skills: ['CAD Draftsman', 'Production Planning'],
  },
  {
    id: 'stu-15',
    rollNo: '21EE004',
    name: 'Gaurav Bhatia',
    email: 'gaurav.bhatia@apex.edu',
    department: 'Electrical & Electronics',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.05,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34515',
    skills: ['Power Systems', 'PLC', 'Control Systems', 'MATLAB'],
  },
  {
    id: 'stu-16',
    rollNo: '21EE016',
    name: 'Pooja Hegde',
    email: 'pooja.hegde@apex.edu',
    department: 'Electrical & Electronics',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 7.15,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34516',
    skills: ['Circuit Design', 'Microcontrollers', 'Sensors'],
  },
  // Batch 2026 Juniors (for batch comparisons and trendline testing)
  {
    id: 'stu-17',
    rollNo: '22CS002',
    name: 'Ishaan Chopra',
    email: 'ishaan.chopra@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 3,
    section: 'A',
    batch: '2026',
    cgpa: 9.30,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Offer Received',
    phone: '+91 98112 34517',
    skills: ['Python', 'Deep Learning', 'PyTorch', 'Rust'],
  },
  {
    id: 'stu-18',
    rollNo: '22CS011',
    name: 'Siddharth Rao',
    email: 'siddharth.rao@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 3,
    section: 'A',
    batch: '2026',
    cgpa: 8.45,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Shortlisted',
    phone: '+91 98112 34518',
    skills: ['React Native', 'Firebase', 'Node.js'],
  },
  {
    id: 'stu-19',
    rollNo: '22CS025',
    name: 'Kavya Pillai',
    email: 'kavya.pillai@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 3,
    section: 'B',
    batch: '2026',
    cgpa: 8.70,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34519',
    skills: ['Java', 'Algorithms', 'Distributed DBs'],
  },
  {
    id: 'stu-20',
    rollNo: '22EC009',
    name: 'Tarun Saxena',
    email: 'tarun.saxena@apex.edu',
    department: 'Electronics & Communication',
    program: 'B.Tech',
    year: 3,
    section: 'A',
    batch: '2026',
    cgpa: 7.90,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34520',
    skills: ['Embedded C', 'Arduino', 'VHDL'],
  },
  {
    id: 'stu-21',
    rollNo: '22IT014',
    name: 'Shreya Kapoor',
    email: 'shreya.kapoor@apex.edu',
    department: 'Information Technology',
    program: 'B.Tech',
    year: 3,
    section: 'A',
    batch: '2026',
    cgpa: 8.60,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34521',
    skills: ['Cloud', 'DevOps', 'AWS', 'Terraform'],
  },
  {
    id: 'stu-22',
    rollNo: '22ME007',
    name: 'Nikhil Mathur',
    email: 'nikhil.mathur@apex.edu',
    department: 'Mechanical Engineering',
    program: 'B.Tech',
    year: 3,
    section: 'A',
    batch: '2026',
    cgpa: 7.30,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34522',
    skills: ['Thermodynamics', 'Fluid Mechanics'],
  },
  {
    id: 'stu-23',
    rollNo: '22EE012',
    name: 'Manish Tiwari',
    email: 'manish.tiwari@apex.edu',
    department: 'Electrical & Electronics',
    program: 'B.Tech',
    year: 3,
    section: 'A',
    batch: '2026',
    cgpa: 6.40,
    activeBacklogs: 1,
    isRegistered: false,
    isEligible: false,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34523',
    skills: ['Circuits', 'Power Electronics'],
  },
  {
    id: 'stu-24',
    rollNo: '21CS060',
    name: 'Harsh Vardhan',
    email: 'harsh.vardhan@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 8.85,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34524',
    skills: ['C++', 'Distributed Systems', 'Go'],
  },
  {
    id: 'stu-25',
    rollNo: '21EC041',
    name: 'Bhavna Chawla',
    email: 'bhavna.chawla@apex.edu',
    department: 'Electronics & Communication',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 8.00,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34525',
    skills: ['Embedded Systems', 'Digital Electronics'],
  },
  {
    id: 'stu-26',
    rollNo: '21CS075',
    name: 'Deepak Joshi',
    email: 'deepak.joshi@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.12,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Placed',
    phone: '+91 98112 34526',
    skills: ['Node.js', 'PostgreSQL', 'Docker'],
  },
  {
    id: 'stu-27',
    rollNo: '21EC050',
    name: 'Aishwarya Rao',
    email: 'aishwarya.rao@apex.edu',
    department: 'Electronics & Communication',
    program: 'B.Tech',
    year: 4,
    section: 'B',
    batch: '2025',
    cgpa: 7.80,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Selected',
    phone: '+91 98112 34527',
    skills: ['Signals & Systems', 'MATLAB', 'Verilog'],
  },
  {
    id: 'stu-28',
    rollNo: '21ME022',
    name: 'Gautam Singhania',
    email: 'gautam.singhania@apex.edu',
    department: 'Mechanical Engineering',
    program: 'B.Tech',
    year: 4,
    section: 'A',
    batch: '2025',
    cgpa: 8.45,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Offer Received',
    phone: '+91 98112 34528',
    skills: ['AutoCAD', 'SolidWorks', 'ANSYS'],
  },
  {
    id: 'stu-29',
    rollNo: '22CS088',
    name: 'Kavita Menon',
    email: 'kavita.menon@apex.edu',
    department: 'Computer Science & Engineering',
    program: 'B.Tech',
    year: 3,
    section: 'B',
    batch: '2026',
    cgpa: 8.90,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34529',
    skills: ['Python', 'Data Structures', 'Machine Learning'],
  },
  {
    id: 'stu-30',
    rollNo: '22ME035',
    name: 'Varun Nair',
    email: 'varun.nair@apex.edu',
    department: 'Mechanical Engineering',
    program: 'B.Tech',
    year: 3,
    section: 'A',
    batch: '2026',
    cgpa: 6.95,
    activeBacklogs: 0,
    isRegistered: true,
    isEligible: true,
    placementStatus: 'Unplaced',
    phone: '+91 98112 34530',
    skills: ['Manufacturing', 'Thermodynamics'],
  },
];

export const INITIAL_DRIVES: Drive[] = [
  {
    id: 'drv-1',
    company: 'Google',
    role: 'Software Engineer',
    description: 'Engineering role working on distributed storage, search systems, and scalable cloud infrastructure.',
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleBatches: ['2025', '2026'],
    minCgpa: 8.5,
    maxBacklogs: 0,
    skills: ['Data Structures', 'Algorithms', 'System Design', 'C++', 'Java'],
    deadline: '2026-11-15',
    stages: ['Registration', 'Online Assessment', 'Technical Round 1', 'Technical Round 2', 'Managerial Interview', 'HR & Offer'],
    location: 'Bengaluru / Hyderabad',
    packageLpa: 28.5,
    status: 'In Progress',
    registeredStudentIds: ['stu-1', 'stu-2', 'stu-4', 'stu-10', 'stu-17', 'stu-19', 'stu-24'],
    createdAt: '2026-09-01',
  },
  {
    id: 'drv-2',
    company: 'Microsoft',
    role: 'Systems Engineer',
    description: 'Core software design on Azure cloud platform, kernel diagnostics, and modern service architecture.',
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Communication'],
    eligibleBatches: ['2025'],
    minCgpa: 8.0,
    maxBacklogs: 0,
    skills: ['C#', 'C++', 'Operating Systems', 'Networking'],
    deadline: '2026-10-25',
    stages: ['Registration', 'Coding Test', 'Technical Round', 'System Design', 'Offer'],
    location: 'Hyderabad / Noida',
    packageLpa: 24.0,
    status: 'In Progress',
    registeredStudentIds: ['stu-1', 'stu-2', 'stu-3', 'stu-4', 'stu-6', 'stu-7', 'stu-9', 'stu-10', 'stu-24'],
    createdAt: '2026-09-05',
  },
  {
    id: 'drv-3',
    company: 'Texas Instruments',
    role: 'Hardware Design Engineer',
    description: 'Analog and digital signal chain ASIC validation, board-level testing, and firmware driver integration.',
    eligibleDepartments: ['Electronics & Communication', 'Electrical & Electronics'],
    eligibleBatches: ['2025'],
    minCgpa: 8.0,
    maxBacklogs: 0,
    skills: ['VLSI', 'Verilog', 'Circuits', 'Microcontrollers'],
    deadline: '2026-09-20',
    stages: ['Registration', 'Domain Test', 'Technical Interview', 'HR Round', 'Offer'],
    location: 'Bengaluru',
    packageLpa: 19.5,
    status: 'Completed',
    registeredStudentIds: ['stu-6', 'stu-7', 'stu-15'],
    createdAt: '2026-08-10',
  },
  {
    id: 'drv-4',
    company: 'Tata Consultancy Services',
    role: 'Digital Specialist Engineer',
    description: 'Enterprise modern architecture development, API integrations, and cloud solution consulting.',
    eligibleDepartments: ['Computer Science & Engineering', 'Electronics & Communication', 'Information Technology', 'Mechanical Engineering', 'Electrical & Electronics'],
    eligibleBatches: ['2025', '2026'],
    minCgpa: 7.0,
    maxBacklogs: 0,
    skills: ['Java', 'SQL', 'Web Technologies', 'Analytical Reasoning'],
    deadline: '2026-10-30',
    stages: ['Registration', 'NQT Assessment', 'Technical Interview', 'HR Interview', 'Offer'],
    location: 'Pan India',
    packageLpa: 7.5,
    status: 'Completed',
    registeredStudentIds: ['stu-3', 'stu-7', 'stu-9', 'stu-12', 'stu-13', 'stu-15', 'stu-21'],
    createdAt: '2026-08-15',
  },
  {
    id: 'drv-5',
    company: 'Larsen & Toubro',
    role: 'Graduate Engineer Trainee',
    description: 'Mechanical equipment design, automated manufacturing floor oversight, and structural modeling.',
    eligibleDepartments: ['Mechanical Engineering', 'Electrical & Electronics'],
    eligibleBatches: ['2025'],
    minCgpa: 7.2,
    maxBacklogs: 0,
    skills: ['SolidWorks', 'Thermodynamics', 'Industrial Safety', 'AutoCAD'],
    deadline: '2026-11-20',
    stages: ['Registration', 'Aptitude Test', 'Technical Panel', 'Fitment Interview', 'Offer'],
    location: 'Mumbai / Chennai',
    packageLpa: 8.2,
    status: 'Open',
    registeredStudentIds: ['stu-12', 'stu-13', 'stu-15'],
    createdAt: '2026-09-20',
  },
  {
    id: 'drv-6',
    company: 'Amazon',
    role: 'SDE Intern & FTE',
    description: 'E-commerce checkout microservices, high-throughput message brokers, and operational excellence.',
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleBatches: ['2025', '2026'],
    minCgpa: 8.0,
    maxBacklogs: 0,
    skills: ['Object Oriented Design', 'Java', 'Data Structures', 'AWS'],
    deadline: '2026-11-28',
    stages: ['Registration', 'Online Assessment', 'Technical Rounds', 'Bar Raiser', 'Offer'],
    location: 'Bengaluru',
    packageLpa: 32.0,
    status: 'Open',
    registeredStudentIds: ['stu-1', 'stu-2', 'stu-10', 'stu-17', 'stu-24'],
    createdAt: '2026-09-28',
  },
  {
    id: 'drv-7',
    company: 'Cisco Systems',
    role: 'Associate Network Consulting Engineer',
    description: 'Enterprise SDN infrastructure configuration, telemetry monitoring, and client site automation.',
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Communication'],
    eligibleBatches: ['2025'],
    minCgpa: 7.5,
    maxBacklogs: 0,
    skills: ['Computer Networks', 'Python', 'TCP/IP', 'Linux'],
    deadline: '2026-09-15',
    stages: ['Registration', 'Technical Screening', 'Panel Interview', 'Offer'],
    location: 'Bengaluru',
    packageLpa: 16.0,
    status: 'Cancelled', // Cancelled drive to verify that its applications are excluded from statistics!
    registeredStudentIds: ['stu-3', 'stu-7', 'stu-9', 'stu-11'],
    createdAt: '2026-08-01',
  },
];

export const INITIAL_APPLICATIONS: Application[] = [
  // Aarav Sharma (stu-1) - Multiple offers! Google (joined) + Microsoft (offer)
  {
    id: 'app-1',
    studentId: 'stu-1',
    driveId: 'drv-1',
    company: 'Google',
    role: 'Software Engineer',
    stage: 'Joined',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-02' },
      { stage: 'Shortlisted', timestamp: '2026-09-10' },
      { stage: 'Assessment', timestamp: '2026-09-16' },
      { stage: 'Interview', timestamp: '2026-09-24' },
      { stage: 'Offer', timestamp: '2026-10-01' },
      { stage: 'Joined', timestamp: '2026-10-05', notes: 'Accepted offer and signed letter of intent' },
    ],
    packageLpa: 28.5,
    isOfferPublished: true,
    updatedAt: '2026-10-05',
  },
  {
    id: 'app-2',
    studentId: 'stu-1',
    driveId: 'drv-2',
    company: 'Microsoft',
    role: 'Systems Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-06' },
      { stage: 'Shortlisted', timestamp: '2026-09-12' },
      { stage: 'Interview', timestamp: '2026-09-22' },
      { stage: 'Offer', timestamp: '2026-09-30' },
    ],
    packageLpa: 24.0,
    isOfferPublished: true,
    updatedAt: '2026-09-30',
  },

  // Priya Patel (stu-2) - Multiple offers! Google (offer) + Microsoft (offer)
  {
    id: 'app-3',
    studentId: 'stu-2',
    driveId: 'drv-1',
    company: 'Google',
    role: 'Software Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-02' },
      { stage: 'Shortlisted', timestamp: '2026-09-10' },
      { stage: 'Interview', timestamp: '2026-09-24' },
      { stage: 'Offer', timestamp: '2026-10-02' },
    ],
    packageLpa: 28.5,
    isOfferPublished: true,
    updatedAt: '2026-10-02',
  },
  {
    id: 'app-4',
    studentId: 'stu-2',
    driveId: 'drv-2',
    company: 'Microsoft',
    role: 'Systems Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-06' },
      { stage: 'Shortlisted', timestamp: '2026-09-12' },
      { stage: 'Interview', timestamp: '2026-09-20' },
      { stage: 'Offer', timestamp: '2026-09-29' },
    ],
    packageLpa: 24.0,
    isOfferPublished: true,
    updatedAt: '2026-09-29',
  },

  // Rohan Verma (stu-3) - TCS (Joined)
  {
    id: 'app-5',
    studentId: 'stu-3',
    driveId: 'drv-4',
    company: 'Tata Consultancy Services',
    role: 'Digital Specialist Engineer',
    stage: 'Joined',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-16' },
      { stage: 'Assessment', timestamp: '2026-08-25' },
      { stage: 'Interview', timestamp: '2026-09-02' },
      { stage: 'Offer', timestamp: '2026-09-15' },
      { stage: 'Joined', timestamp: '2026-09-20' },
    ],
    packageLpa: 7.5,
    isOfferPublished: true,
    updatedAt: '2026-09-20',
  },
  {
    id: 'app-6',
    studentId: 'stu-3',
    driveId: 'drv-2',
    company: 'Microsoft',
    role: 'Systems Engineer',
    stage: 'Rejected',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-06' },
      { stage: 'Assessment', timestamp: '2026-09-14' },
      { stage: 'Rejected', timestamp: '2026-09-18', notes: 'Did not meet technical assessment cutoff' },
    ],
    isOfferPublished: false,
    updatedAt: '2026-09-18',
  },

  // Ananya Iyer (stu-4) - Google (Selected, unpublished offer) & Microsoft (Interview)
  {
    id: 'app-7',
    studentId: 'stu-4',
    driveId: 'drv-1',
    company: 'Google',
    role: 'Software Engineer',
    stage: 'Selected',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-02' },
      { stage: 'Shortlisted', timestamp: '2026-09-10' },
      { stage: 'Interview', timestamp: '2026-09-25' },
      { stage: 'Selected', timestamp: '2026-10-04' },
    ],
    packageLpa: 28.5,
    isOfferPublished: true,
    updatedAt: '2026-10-04',
  },
  {
    id: 'app-8',
    studentId: 'stu-4',
    driveId: 'drv-2',
    company: 'Microsoft',
    role: 'Systems Engineer',
    stage: 'Interview',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-06' },
      { stage: 'Shortlisted', timestamp: '2026-09-12' },
      { stage: 'Interview', timestamp: '2026-09-26' },
    ],
    isOfferPublished: false,
    updatedAt: '2026-09-26',
    nextActionDate: '2026-10-18',
  },

  // Neha Nambiar (stu-6) - Texas Instruments (Joined)
  {
    id: 'app-9',
    studentId: 'stu-6',
    driveId: 'drv-3',
    company: 'Texas Instruments',
    role: 'Hardware Design Engineer',
    stage: 'Joined',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-12' },
      { stage: 'Assessment', timestamp: '2026-08-20' },
      { stage: 'Interview', timestamp: '2026-08-28' },
      { stage: 'Offer', timestamp: '2026-09-05' },
      { stage: 'Joined', timestamp: '2026-09-12' },
    ],
    packageLpa: 19.5,
    isOfferPublished: true,
    updatedAt: '2026-09-12',
  },

  // Aditya Kulkarni (stu-7) - Texas Instruments (Offer) & TCS (Offer)
  {
    id: 'app-10',
    studentId: 'stu-7',
    driveId: 'drv-3',
    company: 'Texas Instruments',
    role: 'Hardware Design Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-12' },
      { stage: 'Interview', timestamp: '2026-08-28' },
      { stage: 'Offer', timestamp: '2026-09-08' },
    ],
    packageLpa: 19.5,
    isOfferPublished: true,
    updatedAt: '2026-09-08',
  },
  {
    id: 'app-11',
    studentId: 'stu-7',
    driveId: 'drv-4',
    company: 'Tata Consultancy Services',
    role: 'Digital Specialist Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-16' },
      { stage: 'Interview', timestamp: '2026-09-04' },
      { stage: 'Offer', timestamp: '2026-09-16' },
    ],
    packageLpa: 7.5,
    isOfferPublished: true,
    updatedAt: '2026-09-16',
  },

  // Vikram Sengupta (stu-9) - TCS (Offer)
  {
    id: 'app-12',
    studentId: 'stu-9',
    driveId: 'drv-4',
    company: 'Tata Consultancy Services',
    role: 'Digital Specialist Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-16' },
      { stage: 'Interview', timestamp: '2026-09-04' },
      { stage: 'Offer', timestamp: '2026-09-18' },
    ],
    packageLpa: 7.5,
    isOfferPublished: true,
    updatedAt: '2026-09-18',
  },

  // Sneha Roy (stu-10) - Google (Offer)
  {
    id: 'app-13',
    studentId: 'stu-10',
    driveId: 'drv-1',
    company: 'Google',
    role: 'Software Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-02' },
      { stage: 'Shortlisted', timestamp: '2026-09-10' },
      { stage: 'Interview', timestamp: '2026-09-26' },
      { stage: 'Offer', timestamp: '2026-10-06' },
    ],
    packageLpa: 28.5,
    isOfferPublished: true,
    updatedAt: '2026-10-06',
  },

  // Farhan Siddiqui (stu-12) - TCS (Offer)
  {
    id: 'app-14',
    studentId: 'stu-12',
    driveId: 'drv-4',
    company: 'Tata Consultancy Services',
    role: 'Digital Specialist Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-16' },
      { stage: 'Interview', timestamp: '2026-09-05' },
      { stage: 'Offer', timestamp: '2026-09-20' },
    ],
    packageLpa: 7.5,
    isOfferPublished: true,
    updatedAt: '2026-09-20',
  },

  // Meera Menon (stu-13) - TCS (Joined)
  {
    id: 'app-15',
    studentId: 'stu-13',
    driveId: 'drv-4',
    company: 'Tata Consultancy Services',
    role: 'Digital Specialist Engineer',
    stage: 'Joined',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-16' },
      { stage: 'Interview', timestamp: '2026-09-05' },
      { stage: 'Offer', timestamp: '2026-09-21' },
      { stage: 'Joined', timestamp: '2026-09-27' },
    ],
    packageLpa: 7.5,
    isOfferPublished: true,
    updatedAt: '2026-09-27',
  },

  // Gaurav Bhatia (stu-15) - Texas Instruments (Offer)
  {
    id: 'app-16',
    studentId: 'stu-15',
    driveId: 'drv-3',
    company: 'Texas Instruments',
    role: 'Hardware Design Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-12' },
      { stage: 'Interview', timestamp: '2026-08-30' },
      { stage: 'Offer', timestamp: '2026-09-10' },
    ],
    packageLpa: 19.5,
    isOfferPublished: true,
    updatedAt: '2026-09-10',
  },

  // Harsh Vardhan (stu-24) - Microsoft (Offer)
  {
    id: 'app-17',
    studentId: 'stu-24',
    driveId: 'drv-2',
    company: 'Microsoft',
    role: 'Systems Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-06' },
      { stage: 'Interview', timestamp: '2026-09-22' },
      { stage: 'Offer', timestamp: '2026-10-02' },
    ],
    packageLpa: 24.0,
    isOfferPublished: true,
    updatedAt: '2026-10-02',
  },

  // Juniors (Batch 2026)
  {
    id: 'app-18',
    studentId: 'stu-17',
    driveId: 'drv-1',
    company: 'Google',
    role: 'Software Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-02' },
      { stage: 'Interview', timestamp: '2026-09-28' },
      { stage: 'Offer', timestamp: '2026-10-07' },
    ],
    packageLpa: 28.5,
    isOfferPublished: true,
    updatedAt: '2026-10-07',
  },
  {
    id: 'app-19',
    studentId: 'stu-19',
    driveId: 'drv-1',
    company: 'Google',
    role: 'Software Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-09-02' },
      { stage: 'Interview', timestamp: '2026-09-28' },
      { stage: 'Offer', timestamp: '2026-10-08' },
    ],
    packageLpa: 28.5,
    isOfferPublished: true,
    updatedAt: '2026-10-08',
  },
  {
    id: 'app-20',
    studentId: 'stu-21',
    driveId: 'drv-4',
    company: 'Tata Consultancy Services',
    role: 'Digital Specialist Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-16' },
      { stage: 'Interview', timestamp: '2026-09-08' },
      { stage: 'Offer', timestamp: '2026-09-25' },
    ],
    packageLpa: 7.5,
    isOfferPublished: true,
    updatedAt: '2026-09-25',
  },

  // Applications from CANCELLED drive (drv-7 Cisco) - Must be ignored by calculations!
  {
    id: 'app-21',
    studentId: 'stu-3',
    driveId: 'drv-7',
    company: 'Cisco Systems',
    role: 'Associate Network Consulting Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-02' },
      { stage: 'Offer', timestamp: '2026-08-25' },
    ],
    packageLpa: 16.0,
    isOfferPublished: false,
    updatedAt: '2026-09-15',
  },
  {
    id: 'app-22',
    studentId: 'stu-7',
    driveId: 'drv-7',
    company: 'Cisco Systems',
    role: 'Associate Network Consulting Engineer',
    stage: 'Offer',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-02' },
      { stage: 'Offer', timestamp: '2026-08-26' },
    ],
    packageLpa: 16.0,
    isOfferPublished: false,
    updatedAt: '2026-09-15',
  },
  {
    id: 'app-23',
    studentId: 'stu-11',
    driveId: 'drv-7',
    company: 'Cisco Systems',
    role: 'Associate Network Consulting Engineer',
    stage: 'Withdrawn',
    stageHistory: [
      { stage: 'Registered', timestamp: '2026-08-02' },
      { stage: 'Withdrawn', timestamp: '2026-08-20', notes: 'Student opted out' },
    ],
    isOfferPublished: false,
    updatedAt: '2026-08-20',
  },
];

// Helper to seed initial clearance records for students
export function createInitialClearanceRecords(): ClearanceRecord[] {
  const records: ClearanceRecord[] = [];
  const categories = DEFAULT_CATEGORIES;

  INITIAL_STUDENTS.forEach((student) => {
    categories.forEach((cat) => {
      let status: ClearanceStatus = 'Cleared';
      let remarks = 'No outstanding dues.';
      const pendingReqs: string[] = [];

      // Seed realistic variations based on student id
      if (student.id === 'stu-1') {
        // Aarav is fully cleared!
        status = 'Cleared';
        remarks = 'All clearances verified.';
      } else if (student.id === 'stu-2') {
        // Priya is pending on Library book return
        if (cat.id === 'cat-lib') {
          status = 'Pending';
          remarks = '1 borrowed reference book pending return: "Algorithm Design".';
          pendingReqs.push('Return "Algorithm Design" (Accession #89211)');
        }
      } else if (student.id === 'stu-5') {
        // Karan has backlogs & rejected in Accounts
        if (cat.id === 'cat-acc') {
          status = 'Rejected';
          remarks = 'Semester 7 tuition fee instalment pending ₹18,500.';
          pendingReqs.push('Clear semester 7 fee balance at Finance counter.');
        } else if (cat.id === 'cat-lab') {
          status = 'Further action required';
          remarks = 'Microprocessor kit replacement slip not submitted.';
          pendingReqs.push('Submit replacement slip signed by Lab In-Charge.');
        }
      } else if (student.id === 'stu-8') {
        // Divya has pending in Department
        if (cat.id === 'cat-dept') {
          status = 'Pending';
          remarks = 'Final year seminar report copy pending submission.';
          pendingReqs.push('Submit hardbound seminar report to Dept Coordinator.');
        }
      } else if (student.id === 'stu-14') {
        // Tanmay has rejected library due
        if (cat.id === 'cat-lib') {
          status = 'Rejected';
          remarks = 'Damaged machine design handbook fine overdue ₹450.';
          pendingReqs.push('Pay damage assessment fee of ₹450.');
        }
      } else if (student.id === 'stu-16') {
        if (cat.id === 'cat-place') {
          status = 'Pending';
          remarks = 'Exit survey response not completed.';
          pendingReqs.push('Submit placement exit survey on portal.');
        }
      } else {
        // Batch 2026 students: some pending, some not applicable
        if (student.batch === '2026') {
          if (cat.id === 'cat-place' || cat.id === 'cat-acc') {
            status = 'Pending';
            remarks = 'Ongoing session clearance in progress.';
          }
        }
      }

      records.push({
        id: `rec-${student.id}-${cat.id}`,
        studentId: student.id,
        categoryId: cat.id,
        status,
        remarks,
        pendingRequirements: pendingReqs,
        updatedAt: '2026-10-10',
        updatedBy: 'Placement & Records Section',
      });
    });
  });

  return records;
}

// -------------------------------------------------------------
// LOCAL STORAGE PERSISTENCE ENGINE
// -------------------------------------------------------------

const STORAGE_KEYS = {
  STUDENTS: 'apex_portal_students_v1',
  DRIVES: 'apex_portal_drives_v1',
  APPLICATIONS: 'apex_portal_applications_v1',
  CATEGORIES: 'apex_portal_categories_v1',
  CLEARANCES: 'apex_portal_clearances_v1',
  CURRENT_USER: 'apex_portal_current_user_v1',
  USERS: 'apex_portal_users_v1',
  STUDENT_DOCS: 'apex_portal_student_docs_v1',
  PASSWORDS: 'apex_portal_passwords_v1',
  DEPARTMENTS: 'apex_portal_departments_v1',
};

export function createInitialUserDocs(): Record<string, UserDoc> {
  const users: Record<string, UserDoc> = {};

  // Incharge user
  users['usr-incharge'] = {
    uid: 'usr-incharge',
    email: 'placement.officer@apex.edu',
    name: 'Dr. V. Ramanathan',
    role: 'incharge',
    active: true,
    passwordChanged: true,
    createdAt: '2026-01-01',
  };

  // Student users (seeded with active: true, passwordChanged: false)
  INITIAL_STUDENTS.forEach((s) => {
    users[s.id] = {
      uid: s.id,
      email: `${s.rollNo.toLowerCase()}@apex.edu`,
      name: s.name,
      role: 'student',
      studentId: s.id,
      rollNo: s.rollNo,
      department: s.department,
      active: true,
      passwordChanged: false,
      createdAt: '2026-01-01',
    };
  });

  return users;
}

export function createInitialStudentDocs(): Record<string, StudentDoc> {
  const docs: Record<string, StudentDoc> = {};
  INITIAL_STUDENTS.forEach((s) => {
    docs[s.rollNo] = {
      rollNo: s.rollNo,
      studentId: s.id,
      email: `${s.rollNo.toLowerCase()}@apex.edu`,
      name: s.name,
      uid: s.id,
      createdAt: '2026-01-01',
    };
  });
  return docs;
}

class PortalStorage {
  private get<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      if (!item) return fallback;
      return JSON.parse(item) as T;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }

  getStudents(): Student[] {
    const list = this.get<Student[]>(STORAGE_KEYS.STUDENTS, []);
    return list.map((s) => ({
      ...s,
      email: s.email || `${s.rollNo.toLowerCase()}@apex.edu`,
    }));
  }

  saveStudents(students: Student[]) {
    this.set(STORAGE_KEYS.STUDENTS, students);
  }

  getDrives(): Drive[] {
    return this.get<Drive[]>(STORAGE_KEYS.DRIVES, INITIAL_DRIVES);
  }

  saveDrives(drives: Drive[]) {
    this.set(STORAGE_KEYS.DRIVES, drives);
  }

  getApplications(): Application[] {
    return this.get<Application[]>(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);
  }

  saveApplications(apps: Application[]) {
    this.set(STORAGE_KEYS.APPLICATIONS, apps);
  }

  getCategories(): ClearanceCategory[] {
    return this.get<ClearanceCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  }

  saveCategories(cats: ClearanceCategory[]) {
    this.set(STORAGE_KEYS.CATEGORIES, cats);
  }

  getClearances(): ClearanceRecord[] {
    const fallback = createInitialClearanceRecords();
    return this.get<ClearanceRecord[]>(STORAGE_KEYS.CLEARANCES, fallback);
  }

  saveClearances(clearances: ClearanceRecord[]) {
    this.set(STORAGE_KEYS.CLEARANCES, clearances);
  }

  getDepartments(): Department[] {
    return this.get<Department[]>(STORAGE_KEYS.DEPARTMENTS, []);
  }

  saveDepartments(departments: Department[]) {
    this.set(STORAGE_KEYS.DEPARTMENTS, departments);
  }

  getCurrentUser(): AuthUser | null {
    return this.get<AuthUser | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  saveCurrentUser(user: AuthUser | null) {
    if (!user) {
      try {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      } catch (e) {
        console.warn('LocalStorage remove error', e);
      }
    } else {
      this.set(STORAGE_KEYS.CURRENT_USER, user);
    }
  }

  getUserDocs(): Record<string, UserDoc> {
    const docs = this.get<Record<string, UserDoc>>(STORAGE_KEYS.USERS, createInitialUserDocs());
    // Ensure all student user docs reflect official roll number email format (rollno@apex.edu)
    Object.values(docs).forEach((u) => {
      if (u.role === 'student' && u.rollNo) {
        const rollPrefix = u.rollNo.toLowerCase();
        if (!u.email.toLowerCase().startsWith(rollPrefix + '@')) {
          u.email = `${rollPrefix}@apex.edu`;
        }
      }
    });
    return docs;
  }

  saveUserDocs(users: Record<string, UserDoc>) {
    this.set(STORAGE_KEYS.USERS, users);
  }

  getUserDoc(uid: string): UserDoc | null {
    const docs = this.getUserDocs();
    return docs[uid] || null;
  }

  getUserDocByEmail(email: string): UserDoc | null {
    const docs = this.getUserDocs();
    const cleanEmail = email.trim().toLowerCase();
    // 1. Direct email match
    let found = Object.values(docs).find((u) => u.email.toLowerCase() === cleanEmail);
    if (found) return found;

    // 2. Roll number match (e.g. "21cs001@university.edu.in", "21cs001@apex.edu", or "21CS001")
    const localPart = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
    found = Object.values(docs).find(
      (u) =>
        u.rollNo &&
        (u.rollNo.toLowerCase() === cleanEmail ||
          u.rollNo.toLowerCase() === localPart ||
          u.email.toLowerCase().startsWith(localPart + '@'))
    );
    return found || null;
  }

  saveUserDoc(user: UserDoc) {
    const docs = this.getUserDocs();
    docs[user.uid] = user;
    this.saveUserDocs(docs);
  }

  getStudentDocs(): Record<string, StudentDoc> {
    return this.get<Record<string, StudentDoc>>(STORAGE_KEYS.STUDENT_DOCS, createInitialStudentDocs());
  }

  saveStudentDocs(docs: Record<string, StudentDoc>) {
    this.set(STORAGE_KEYS.STUDENT_DOCS, docs);
  }

  getStudentDoc(rollNo: string): StudentDoc | null {
    const docs = this.getStudentDocs();
    const clean = rollNo.trim().toUpperCase();
    if (docs[clean]) return docs[clean];
    const localPart = clean.includes('@') ? clean.split('@')[0] : clean;
    if (docs[localPart]) return docs[localPart];
    // Check values
    const found = Object.values(docs).find(
      (d) =>
        d.rollNo.toUpperCase() === clean ||
        d.rollNo.toUpperCase() === localPart ||
        d.email.toLowerCase() === rollNo.trim().toLowerCase()
    );
    return found || null;
  }

  saveStudentDoc(doc: StudentDoc) {
    const docs = this.getStudentDocs();
    docs[doc.rollNo.toUpperCase()] = doc;
    this.saveStudentDocs(docs);
  }

  getUserPassword(email: string): string {
    const passwords = this.get<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
    const cleanEmail = email.trim().toLowerCase();
    if (passwords[cleanEmail]) return passwords[cleanEmail];
    const localPart = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
    for (const [key, pwd] of Object.entries(passwords)) {
      if (key.toLowerCase() === localPart || key.toLowerCase().startsWith(localPart + '@')) {
        return pwd;
      }
    }
    return passwords[cleanEmail] || 'Password@123';
  }

  setUserPassword(email: string, password: string) {
    const passwords = this.get<Record<string, string>>(STORAGE_KEYS.PASSWORDS, {});
    passwords[email.trim().toLowerCase()] = password;
    this.set(STORAGE_KEYS.PASSWORDS, passwords);
  }

  toggleUserActive(uid: string, active: boolean) {
    const docs = this.getUserDocs();
    if (docs[uid]) {
      docs[uid].active = active;
      this.saveUserDocs(docs);
    }
    // Also check if matches by studentId
    Object.values(docs).forEach((doc) => {
      if (doc.studentId === uid || doc.uid === uid) {
        doc.active = active;
      }
    });
    this.saveUserDocs(docs);
  }

  setUserPasswordChanged(uid: string, passwordChanged: boolean) {
    const docs = this.getUserDocs();
    if (docs[uid]) {
      docs[uid].passwordChanged = passwordChanged;
      this.saveUserDocs(docs);
    }
    // If current logged-in user matches, update their session too
    const current = this.getCurrentUser();
    if (current && (current.id === uid || current.studentId === uid)) {
      current.passwordChanged = passwordChanged;
      this.saveCurrentUser(current);
    }
  }

  resetDemoData() {
    this.set(STORAGE_KEYS.STUDENTS, []);
    this.set(STORAGE_KEYS.DRIVES, INITIAL_DRIVES);
    this.set(STORAGE_KEYS.APPLICATIONS, []);
    this.set(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    this.set(STORAGE_KEYS.CLEARANCES, []);
    this.set(STORAGE_KEYS.USERS, createInitialUserDocs());
    this.set(STORAGE_KEYS.STUDENT_DOCS, {});
    this.set(STORAGE_KEYS.PASSWORDS, {});
    this.set(STORAGE_KEYS.DEPARTMENTS, []);
  }

  deleteStudentsCascade(studentIds: string[]): {
    students: Student[];
    drives: Drive[];
    applications: Application[];
    clearances: ClearanceRecord[];
  } {
    const studentIdsSet = new Set(studentIds);
    const updatedStudents = this.getStudents().filter((s) => !studentIdsSet.has(s.id));
    const updatedApplications = this.getApplications().filter((a) => !studentIdsSet.has(a.studentId));
    const updatedDrives = this.getDrives().map((d) => ({
      ...d,
      registeredStudentIds: d.registeredStudentIds.filter((id) => !studentIdsSet.has(id)),
    }));
    const updatedClearances = this.getClearances().filter((c) => !studentIdsSet.has(c.studentId));

    this.saveStudents(updatedStudents);
    this.saveApplications(updatedApplications);
    this.saveDrives(updatedDrives);
    this.saveClearances(updatedClearances);

    return {
      students: updatedStudents,
      drives: updatedDrives,
      applications: updatedApplications,
      clearances: updatedClearances,
    };
  }
}

export function deleteStudentsCascade(
  studentIds: string[],
  current: {
    students: Student[];
    drives: Drive[];
    applications: Application[];
    clearances: ClearanceRecord[];
  }
) {
  const studentIdsSet = new Set(studentIds);
  return {
    students: current.students.filter((s) => !studentIdsSet.has(s.id)),
    applications: current.applications.filter((a) => !studentIdsSet.has(a.studentId)),
    drives: current.drives.map((d) => ({
      ...d,
      registeredStudentIds: d.registeredStudentIds.filter((id) => !studentIdsSet.has(id)),
    })),
    clearances: current.clearances.filter((c) => !studentIdsSet.has(c.studentId)),
  };
}

export const portalStorage = new PortalStorage();

// -------------------------------------------------------------
// STRICT BUSINESS LOGIC & NUMBER CALCULATIONS
// All metrics across the portal MUST call these exact methods.
// -------------------------------------------------------------

/**
 * Checks whether an individual application constitutes a valid placement offer.
 * Rules:
 * 1. Cancelled drives are EXCLUDED completely.
 * 2. Withdrawn and Rejected applications are EXCLUDED.
 * 3. Stage must be 'Offer' or 'Joined' or 'Selected'.
 */
export function isApplicationValidOffer(
  app: Application,
  drivesMap: Map<string, Drive> | Drive[]
): boolean {
  const drive = Array.isArray(drivesMap)
    ? drivesMap.find((d) => d.id === app.driveId)
    : drivesMap.get(app.driveId);

  // If drive is cancelled, it does NOT count as placement
  if (!drive || drive.status === 'Cancelled') {
    return false;
  }

  if (app.stage === 'Rejected' || app.stage === 'Withdrawn') {
    return false;
  }

  return app.stage === 'Offer' || app.stage === 'Joined' || app.stage === 'Selected';
}

/**
 * Filter down applications to only valid offers under non-cancelled drives.
 */
export function getValidOffers(
  applications: Application[],
  drives: Drive[]
): Application[] {
  const drivesMap = new Map(drives.map((d) => [d.id, d]));
  return applications.filter((app) => isApplicationValidOffer(app, drivesMap));
}

/**
 * Total offers: all valid offers, where a single student may hold several offers.
 */
export function getTotalOffers(
  applications: Application[],
  drives: Drive[]
): number {
  return getValidOffers(applications, drives).length;
}

/**
 * Unique placed students: distinct students holding at least 1 valid offer or placed/joined status.
 */
export function getUniquePlacedStudents(
  applications: Application[],
  drives: Drive[],
  students: Student[]
): Student[] {
  const validOffers = getValidOffers(applications, drives);
  const studentIdsWithValidOffer = new Set(validOffers.map((o) => o.studentId));
  return students.filter((s) => studentIdsWithValidOffer.has(s.id));
}

export function getUniquePlacedCount(
  applications: Application[],
  drives: Drive[]
): number {
  const validOffers = getValidOffers(applications, drives);
  const uniqueStudentIds = new Set(validOffers.map((o) => o.studentId));
  return uniqueStudentIds.size;
}

/**
 * Registered and Eligible student base:
 * Only students marked isRegistered === true AND isEligible === true count as eligible candidate base.
 */
export function getRegisteredAndEligibleStudents(students: Student[]): Student[] {
  return students.filter((s) => s.isRegistered && s.isEligible);
}

/**
 * Placed % = unique placed students / registered and eligible students in that scope.
 * Withdrawn, rejected and cancelled-drive applications are excluded.
 */
export function getPlacementPercentage(
  students: Student[],
  applications: Application[],
  drives: Drive[]
): number {
  const eligibleBase = getRegisteredAndEligibleStudents(students);
  if (eligibleBase.length === 0) return 0;

  const validOffers = getValidOffers(applications, drives);
  const eligibleStudentIds = new Set(eligibleBase.map((s) => s.id));

  // Distinct eligible students who got a valid offer
  const uniquePlacedInEligibleBase = new Set(
    validOffers.filter((o) => eligibleStudentIds.has(o.studentId)).map((o) => o.studentId)
  );

  const percentage = (uniquePlacedInEligibleBase.size / eligibleBase.length) * 100;
  return Math.round(percentage * 10) / 10;
}

/**
 * Package statistics:
 * Highest Package & Average Package calculated strictly from valid offers with package data.
 */
export function getPackageStats(
  applications: Application[],
  drives: Drive[]
): {
  highest: number;
  average: number;
  countWithPackage: number;
} {
  const validOffers = getValidOffers(applications, drives);
  const packages = validOffers
    .map((o) => o.packageLpa)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  if (packages.length === 0) {
    return { highest: 0, average: 0, countWithPackage: 0 };
  }

  const highest = Math.max(...packages);
  const total = packages.reduce((sum, p) => sum + p, 0);
  const average = Math.round((total / packages.length) * 10) / 10;

  return {
    highest,
    average,
    countWithPackage: packages.length,
  };
}

/**
 * No-Dues Overall Status calculation for a student:
 * Based on active mandatory categories:
 * - If any mandatory category has status 'Rejected' or 'Further action required' => 'Rejected / Action Required'
 * - If all active mandatory categories are 'Cleared' or 'Not Applicable' => 'Cleared'
 * - Otherwise => 'Pending' / 'Incomplete'
 */
export function getStudentNoDuesStatus(
  studentId: string,
  categories: ClearanceCategory[],
  records: ClearanceRecord[]
): {
  status: 'Cleared' | 'Pending' | 'Rejected / Action Required' | 'Incomplete';
  clearedCount: number;
  totalMandatory: number;
  totalActive: number;
  pendingRequirements: string[];
  rejectedCategories: string[];
  recordsMap: Map<string, ClearanceRecord>;
} {
  const activeCategories = categories.filter((c) => c.isActive);
  const mandatoryCategories = activeCategories.filter((c) => c.isMandatory);

  const studentRecords = records.filter((r) => r.studentId === studentId);
  const recordsMap = new Map<string, ClearanceRecord>(
    studentRecords.map((r) => [r.categoryId, r])
  );

  let clearedCount = 0;
  const pendingRequirements: string[] = [];
  const rejectedCategories: string[] = [];
  let hasRejected = false;
  let allMandatorySatisfied = true;

  activeCategories.forEach((cat) => {
    const rec = recordsMap.get(cat.id);
    const recStatus: ClearanceStatus = rec ? rec.status : 'Pending';

    if (recStatus === 'Cleared' || recStatus === 'Not Applicable') {
      clearedCount++;
    } else {
      if (rec?.pendingRequirements && rec.pendingRequirements.length > 0) {
        pendingRequirements.push(...rec.pendingRequirements);
      } else if (rec?.remarks) {
        pendingRequirements.push(`${cat.name}: ${rec.remarks}`);
      }
    }

    if (cat.isMandatory) {
      if (recStatus === 'Rejected' || recStatus === 'Further action required') {
        hasRejected = true;
        rejectedCategories.push(cat.name);
      }
      if (recStatus !== 'Cleared' && recStatus !== 'Not Applicable') {
        allMandatorySatisfied = false;
      }
    }
  });

  let status: 'Cleared' | 'Pending' | 'Rejected / Action Required' | 'Incomplete' = 'Pending';
  if (hasRejected) {
    status = 'Rejected / Action Required';
  } else if (allMandatorySatisfied && mandatoryCategories.length > 0) {
    status = 'Cleared';
  } else {
    status = clearedCount > 0 ? 'Incomplete' : 'Pending';
  }

  return {
    status,
    clearedCount,
    totalMandatory: mandatoryCategories.length,
    totalActive: activeCategories.length,
    pendingRequirements,
    rejectedCategories,
    recordsMap,
  };
}

/**
 * Filter helper for applying global dashboard/report filters:
 * Department, Batch, Company, Drive Status
 */
export interface FilterCriteria {
  department?: string;
  batch?: string;
  company?: string;
  driveStatus?: string;
  search?: string;
  registrationStatus?: string;
  eligibilityStatus?: string;
  stage?: string;
}

export function applyStudentFilters(students: Student[], filters: FilterCriteria): Student[] {
  return students.filter((s) => {
    if (filters.department && filters.department !== 'All' && s.department !== filters.department) {
      return false;
    }
    if (filters.batch && filters.batch !== 'All' && s.batch !== filters.batch) {
      return false;
    }
    if (filters.registrationStatus && filters.registrationStatus !== 'All') {
      const isReg = filters.registrationStatus === 'Registered';
      if (s.isRegistered !== isReg) return false;
    }
    if (filters.eligibilityStatus && filters.eligibilityStatus !== 'All') {
      const isElig = filters.eligibilityStatus === 'Eligible';
      if (s.isEligible !== isElig) return false;
    }
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      const matchRoll = s.rollNo.toLowerCase().includes(q);
      const matchName = s.name.toLowerCase().includes(q);
      const matchEmail = s.email.toLowerCase().includes(q);
      if (!matchRoll && !matchName && !matchEmail) return false;
    }
    return true;
  });
}

export function applyDriveFilters(drives: Drive[], filters: FilterCriteria): Drive[] {
  return drives.filter((d) => {
    if (filters.company && filters.company !== 'All' && d.company !== filters.company) {
      return false;
    }
    if (filters.driveStatus && filters.driveStatus !== 'All' && d.status !== filters.driveStatus) {
      return false;
    }
    if (filters.department && filters.department !== 'All') {
      if (!d.eligibleDepartments.includes(filters.department)) return false;
    }
    if (filters.batch && filters.batch !== 'All') {
      if (!d.eligibleBatches.includes(filters.batch)) return false;
    }
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      const matchCo = d.company.toLowerCase().includes(q);
      const matchRole = d.role.toLowerCase().includes(q);
      if (!matchCo && !matchRole) return false;
    }
    return true;
  });
}

// -------------------------------------------------------------
// CLEARANCE APPROVAL & RESOLUTION HELPERS
// -------------------------------------------------------------

/**
 * Grant complete clearance across all active categories for one or more students
 */
export function grantFullClearanceForStudents(
  studentIds: string[],
  categories: ClearanceCategory[],
  existingClearances: ClearanceRecord[],
  remarks = 'Institutional clearance approved by Placement In-Charge.',
  updatedBy = 'Placement In-Charge'
): ClearanceRecord[] {
  const today = new Date().toISOString().split('T')[0];
  const activeCategories = categories.filter((c) => c.isActive);
  const recordsMap = new Map(existingClearances.map((c) => [`${c.studentId}-${c.categoryId}`, c]));

  studentIds.forEach((stuId) => {
    activeCategories.forEach((cat) => {
      const key = `${stuId}-${cat.id}`;
      const rec = recordsMap.get(key);
      if (rec) {
        recordsMap.set(key, {
          ...rec,
          status: 'Cleared',
          remarks: remarks || rec.remarks || 'Cleared by Placement In-Charge',
          pendingRequirements: [],
          updatedAt: today,
          updatedBy,
        });
      } else {
        recordsMap.set(key, {
          id: `rec-${stuId}-${cat.id}`,
          studentId: stuId,
          categoryId: cat.id,
          status: 'Cleared',
          remarks: remarks || 'Cleared by Placement In-Charge',
          pendingRequirements: [],
          updatedAt: today,
          updatedBy,
        });
      }
    });
  });

  return Array.from(recordsMap.values());
}

/**
 * Update a single clearance category for a student
 */
export function updateStudentCategoryClearance(
  studentId: string,
  categoryId: string,
  existingClearances: ClearanceRecord[],
  status: ClearanceStatus = 'Cleared',
  remarks = 'Approved by Placement In-Charge.',
  pendingRequirements: string[] = [],
  updatedBy = 'Placement In-Charge'
): ClearanceRecord[] {
  const today = new Date().toISOString().split('T')[0];
  const recordsMap = new Map(existingClearances.map((c) => [`${c.studentId}-${c.categoryId}`, c]));
  const key = `${studentId}-${categoryId}`;
  const rec = recordsMap.get(key);

  if (rec) {
    recordsMap.set(key, {
      ...rec,
      status,
      remarks,
      pendingRequirements,
      updatedAt: today,
      updatedBy,
    });
  } else {
    recordsMap.set(key, {
      id: `rec-${studentId}-${categoryId}`,
      studentId,
      categoryId,
      status,
      remarks,
      pendingRequirements,
      updatedAt: today,
      updatedBy,
    });
  }

  return Array.from(recordsMap.values());
}

/**
 * Creates default clearance records for newly enrolled students
 */
export function generateDefaultClearanceRecordsForStudents(
  studentIds: string[],
  categories: ClearanceCategory[],
  initialStatus: ClearanceStatus = 'Pending'
): ClearanceRecord[] {
  const today = new Date().toISOString().split('T')[0];
  const records: ClearanceRecord[] = [];
  const activeCategories = categories.filter((c) => c.isActive);

  studentIds.forEach((stuId) => {
    activeCategories.forEach((cat) => {
      records.push({
        id: `rec-${stuId}-${cat.id}`,
        studentId: stuId,
        categoryId: cat.id,
        status: initialStatus,
        remarks: initialStatus === 'Cleared' ? 'Initial clearance certified' : 'Awaiting departmental verification',
        pendingRequirements: [],
        updatedAt: today,
        updatedBy: 'Placement & Records Section',
      });
    });
  });

  return records;
}

// -------------------------------------------------------------
// EXPORT & REPORT UTILITIES
// -------------------------------------------------------------

export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          let val = row[h];
          if (val === undefined || val === null) val = '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(
  filename: string,
  rows: Record<string, any>[],
  sheetName = 'PlacementData'
) {
  if (rows.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
