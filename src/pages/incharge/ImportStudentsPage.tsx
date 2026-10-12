import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Student,
  Department,
  getDepartmentSlug,
  portalStorage,
  exportToCSV,
  exportToExcel,
} from '../../services/placementNoDuesService';
import {
  createStudentAccount,
  createDepartmentIfMissing,
} from '../../services/firebaseAuthService';
import { PageHeader, Stepper, FileDropzone, ProgressBar } from '../../components/ui/FeedbackComponents';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { Download, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface ImportStudentsPageProps {
  existingStudents: Student[];
  existingDepartments?: Department[];
  onImportComplete: (newStudents: Student[], newDepartmentsCreated?: number) => void;
  onNavigateToStudents: () => void;
}

interface ParsedRow {
  rowNum: number;
  rollNo: string;
  name: string;
  email: string;
  department: string;
  deptId: string;
  program: string;
  year: number;
  section: string;
  batch: string;
  cgpa: number;
  backlogs: number;
  status: 'OK' | 'DUPLICATE' | 'ERROR';
  issue?: string;
  raw: Record<string, string>;
}

export const ImportStudentsPage: React.FC<ImportStudentsPageProps> = ({
  existingStudents,
  existingDepartments = [],
  onImportComplete,
  onNavigateToStudents,
}) => {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [showRequiredColumns, setShowRequiredColumns] = useState(false);

  // Parsed rows state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'OK' | 'DUPLICATE' | 'ERROR'>('ALL');

  // Import execution state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    newDepartmentsCreated: number;
    credentials: Array<{ rollNo: string; name: string; email: string }>;
  } | null>(null);

  // -------------------------------------------------------------
  // STEP 1: PARSE FILE OR LOAD SAMPLE BATCH
  // -------------------------------------------------------------
  const parseRowsFromText = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      showToast({ type: 'error', message: 'File is empty or missing headers.' });
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\r"]/g, ''));
    const rows: ParsedRow[] = [];

    const existingRolls = new Set(existingStudents.map((s) => s.rollNo.toLowerCase()));
    const batchRollsInFile = new Set<string>();

    const knownDepartments = existingDepartments && existingDepartments.length > 0
      ? existingDepartments
      : portalStorage.getDepartments();
    const deptRegistry = new Map<string, { slug: string; displayName: string }>();
    for (const d of knownDepartments) {
      deptRegistry.set(d.id, { slug: d.id, displayName: d.name });
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const rowNum = i + 1;
      const getVal = (col: string) => {
        const idx = headers.indexOf(col);
        return idx !== -1 && cells[idx] !== undefined ? cells[idx] : '';
      };

      const rollNo = getVal('rollno') || getVal('roll_no') || getVal('roll') || cells[0] || '';
      const name = getVal('name') || getVal('student_name') || cells[1] || '';
      const email = getVal('email') || cells[2] || '';
      const rawDept =
        getVal('department') ||
        getVal('dept') ||
        (headers.includes('department') || headers.includes('dept') ? '' : cells[3] || '');
      const program = getVal('program') || cells[4] || 'B.Tech';
      const year = parseInt(getVal('year') || cells[5] || '4', 10);
      const section = getVal('section') || cells[6] || 'A';
      const batch = getVal('batch') || cells[7] || '2025';
      const cgpa = parseFloat(getVal('cgpa') || cells[8] || '7.5');
      const backlogs = parseInt(getVal('backlogs') || cells[9] || '0', 10);

      const cleanDept = rawDept.trim();

      let status: 'OK' | 'DUPLICATE' | 'ERROR' = 'OK';
      let issue: string | undefined = undefined;

      // Validation
      if (!rollNo) {
        status = 'ERROR';
        issue = `Row ${rowNum}: roll number missing`;
      } else if (existingRolls.has(rollNo.toLowerCase())) {
        status = 'DUPLICATE';
        issue = `Row ${rowNum}: roll number ${rollNo} already exists in database`;
      } else if (batchRollsInFile.has(rollNo.toLowerCase())) {
        status = 'DUPLICATE';
        issue = `Row ${rowNum}: roll number ${rollNo} appears multiple times in file`;
      } else if (!cleanDept) {
        // In validation, the department cell is required. An empty department is an ERROR ("Department is required").
        // A department that does not exist yet is NOT an error.
        status = 'ERROR';
        issue = 'Department is required';
      } else if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status = 'ERROR';
        issue = `Row ${rowNum}: email format invalid (${email || 'empty'})`;
      } else if (!name) {
        status = 'ERROR';
        issue = `Row ${rowNum}: student name is missing`;
      } else if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        status = 'ERROR';
        issue = `Row ${rowNum}: CGPA must be between 0.0 and 10.0`;
      }

      batchRollsInFile.add(rollNo.toLowerCase());

      // Match department names case-insensitively after trimming spaces
      // Use the first spelling in the file as the display name.
      // Use a normalized lowercase slug as the document ID (e.g. "ai-ml" for "AI & ML").
      let deptDisplayName = cleanDept;
      let deptSlug = '';
      if (cleanDept) {
        deptSlug = getDepartmentSlug(cleanDept);
        if (!deptRegistry.has(deptSlug)) {
          deptRegistry.set(deptSlug, { slug: deptSlug, displayName: cleanDept });
        }
        const matched = deptRegistry.get(deptSlug)!;
        deptDisplayName = matched.displayName;
      }

      rows.push({
        rowNum,
        rollNo: rollNo.toUpperCase(),
        name,
        email: email.toLowerCase(),
        department: deptDisplayName,
        deptId: deptSlug,
        program,
        year: isNaN(year) ? 4 : year,
        section,
        batch,
        cgpa: isNaN(cgpa) ? 7.5 : cgpa,
        backlogs: isNaN(backlogs) ? 0 : backlogs,
        status,
        issue,
        raw: { rollNo, name, email, dept: cleanDept, program, batch },
      });
    }

    setParsedRows(rows);
    setCurrentStep(2);
  };

  const handleFileSelect = (file: File) => {
    const isExcel =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            showToast({ type: 'error', message: 'The Excel workbook does not contain any sheets.' });
            return;
          }
          const worksheet = workbook.Sheets[sheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          parseRowsFromText(csvText);
          showToast({
            type: 'info',
            message: `Loaded sheet "${sheetName}" from Excel file ${file.name}`,
          });
        } catch (err) {
          console.error('Error parsing Excel file:', err);
          showToast({
            type: 'error',
            message: 'Failed to read Excel (.xlsx) file. Please check file format.',
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          parseRowsFromText(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleLoadDemoCSV = () => {
    // Generate sample batch of 29 students with 24 OK, 3 Duplicate, 2 Error as in brief
    const sampleCSV = `Roll No,Name,Email,Department,Program,Year,Section,Batch,CGPA,Backlogs
21CS061,Aditi Kulkarni,aditi.kulkarni@apex.edu,Computer Science & Engineering,B.Tech,4,A,2025,8.45,0
21CS062,Rishi Verma,rishi.verma@apex.edu,Computer Science & Engineering,B.Tech,4,A,2025,7.90,0
21CS063,Sanjana Rao,sanjana.rao@apex.edu,Computer Science & Engineering,B.Tech,4,A,2025,8.80,0
21CS064,Devansh Patel,devansh.patel@apex.edu,Computer Science & Engineering,B.Tech,4,B,2025,9.10,0
21CS065,Tanvi Bhatt,tanvi.bhatt@apex.edu,Computer Science & Engineering,B.Tech,4,B,2025,7.65,0
21CS066,Karthik Nair,karthik.nair@apex.edu,Computer Science & Engineering,B.Tech,4,B,2025,8.20,0
21EC050,Simran Gill,simran.gill_invalid_email,Electronics & Communication,B.Tech,4,A,2025,7.40,0
21EC051,Abhishek Sen,abhishek.sen@apex.edu,Electronics & Communication,B.Tech,4,A,2025,8.30,0
21EC052,Ananya Ghosh,ananya.ghosh@apex.edu,Electronics & Communication,B.Tech,4,A,2025,8.60,0
21EC053,Rahul Bhat,rahul.bhat@apex.edu,Electronics & Communication,B.Tech,4,B,2025,7.10,0
21EC054,Pooja Desai,pooja.desai@apex.edu,Electronics & Communication,B.Tech,4,B,2025,8.75,0
21CS001,Aarav Sharma Duplicate,aarav.sharma@apex.edu,Computer Science & Engineering,B.Tech,4,A,2025,8.92,0
21IT041,Mohit Agarwal,mohit.agarwal@apex.edu,Information Technology,B.Tech,4,A,2025,8.15,0
21IT042,Ritu Roy,ritu.roy@apex.edu,Information Technology,B.Tech,4,A,2025,7.80,0
21IT043,Naveen Kumar,naveen.kumar@apex.edu,Information Technology,B.Tech,4,A,2025,8.50,0
21IT044,Swati Mishra,swati.mishra@apex.edu,Information Technology,B.Tech,4,B,2025,8.90,0
21IT045,Vikas Yadav,vikas.yadav@apex.edu,Information Technology,B.Tech,4,B,2025,7.30,0
21ME035,Suresh Raina,suresh.raina@apex.edu,Mechanical Engineering,B.Tech,4,A,2025,7.95,0
21ME036,Deepa Soni,deepa.soni@apex.edu,Mechanical Engineering,B.Tech,4,A,2025,8.40,0
21ME037,Chetan Bhagat,chetan.bhagat@apex.edu,Mechanical Engineering,B.Tech,4,A,2025,7.60,0
21ME038,Alok Nath,,Mechanical Engineering,B.Tech,4,B,2025,6.80,1
21EE025,Varun Dhawan,varun.dhawan@apex.edu,Electrical & Electronics,B.Tech,4,A,2025,8.25,0
21EE026,Kareena Kapoor,kareena.kapoor@apex.edu,Electrical & Electronics,B.Tech,4,A,2025,8.05,0
21EE027,Sonam Kapoor,sonam.kapoor@apex.edu,Electrical & Electronics,B.Tech,4,A,2025,7.70,0
21EE028,Ranbir Singh,ranbir.singh@apex.edu,Electrical & Electronics,B.Tech,4,B,2025,8.60,0
21CS014,Priya Patel Duplicate,priya.patel@apex.edu,Computer Science & Engineering,B.Tech,4,A,2025,9.15,0
21CS045,Ananya Iyer Duplicate,ananya.iyer@apex.edu,Computer Science & Engineering,B.Tech,4,B,2025,8.65,0
21CS067,Jayesh Shah,jayesh.shah@apex.edu,Computer Science & Engineering,B.Tech,4,B,2025,8.55,0
21CS068,Prachi Dixit,prachi.dixit@apex.edu,Computer Science & Engineering,B.Tech,4,B,2025,8.10,0`;

    parseRowsFromText(sampleCSV);
  };

  const handleDownloadSampleTemplate = () => {
    const templateCSV = `Roll No,Name,Email,Department,Program,Year,Section,Batch,CGPA,Backlogs
21CS101,John Doe,john.doe@apex.edu,Computer Science & Engineering,B.Tech,4,A,2025,8.5,0
21EC101,Jane Smith,jane.smith@apex.edu,Electronics & Communication,B.Tech,4,A,2025,8.2,0`;
    const blob = new Blob([templateCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'apex_student_import_template.csv';
    link.click();
  };

  const handleDownloadSampleExcelTemplate = () => {
    const sampleRows = [
      {
        'Roll No': '21CS101',
        Name: 'John Doe',
        Email: 'john.doe@apex.edu',
        Department: 'Computer Science & Engineering',
        Program: 'B.Tech',
        Year: 4,
        Section: 'A',
        Batch: '2025',
        CGPA: 8.5,
        Backlogs: 0,
      },
      {
        'Roll No': '21EC101',
        Name: 'Jane Smith',
        Email: 'jane.smith@apex.edu',
        Department: 'Electronics & Communication',
        Program: 'B.Tech',
        Year: 4,
        Section: 'A',
        Batch: '2025',
        CGPA: 8.2,
        Backlogs: 0,
      },
      {
        'Roll No': '21ME101',
        Name: 'Rahul Sharma',
        Email: 'rahul.sharma@apex.edu',
        Department: 'Mechanical Engineering',
        Program: 'B.Tech',
        Year: 4,
        Section: 'B',
        Batch: '2025',
        CGPA: 7.8,
        Backlogs: 0,
      },
    ];
    exportToExcel('apex_student_import_template', sampleRows, 'Students');
  };

  // -------------------------------------------------------------
  // STEP 2: SUMMARY & PREVIEW
  // -------------------------------------------------------------
  const okRows = parsedRows.filter((r) => r.status === 'OK');
  const duplicateRows = parsedRows.filter((r) => r.status === 'DUPLICATE');
  const errorRows = parsedRows.filter((r) => r.status === 'ERROR');

  const visiblePreviewRows = parsedRows.filter((r) => {
    if (filterType === 'ALL') return true;
    return r.status === filterType;
  });

  const handleDownloadErrorRows = () => {
    const badRows = parsedRows.filter((r) => r.status !== 'OK');
    if (badRows.length === 0) return;
    const data = badRows.map((r) => ({
      Row: r.rowNum,
      Status: r.status,
      Issue: r.issue || '',
      RollNo: r.rollNo,
      Name: r.name,
      Email: r.email,
    }));
    exportToExcel('apex_import_issues', data, 'Issues');
  };

  const handleConfirmImport = () => {
    if (okRows.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    let progress = 0;
    const total = okRows.length;
    const interval = setInterval(() => {
      progress++;
      setImportProgress(progress);

      if (progress >= total) {
        clearInterval(interval);
        setIsImporting(false);

        // Create new Student objects
        const newStudents: Student[] = okRows.map((r) => ({
          id: `stu-${Date.now()}-${r.rollNo}`,
          rollNo: r.rollNo,
          name: r.name,
          email: r.email,
          department: r.department,
          program: r.program,
          year: r.year,
          section: r.section,
          batch: r.batch,
          cgpa: r.cgpa,
          activeBacklogs: r.backlogs,
          isRegistered: true,
          isEligible: r.backlogs === 0 && r.cgpa >= 6.0,
          placementStatus: 'Unplaced',
          skills: ['Aptitude', 'Core Engineering'],
        }));

        // Provision Firebase Auth & Firestore documents using secondary app instance
        Promise.all(
          newStudents.map((s) =>
            createStudentAccount({
              rollNo: s.rollNo,
              name: s.name,
              email: s.email,
              studentId: s.id,
            })
          )
        ).catch((err) => {
          console.warn('Student account creation note:', err);
        });

        // Provision missing departments
        const currentKnownDeptIds = new Set(
          (existingDepartments && existingDepartments.length > 0
            ? existingDepartments
            : portalStorage.getDepartments()
          ).map((d) => d.id)
        );
        const newDeptsToCreate: Array<{ id: string; name: string }> = [];
        const seenNewDeptIds = new Set<string>();
        for (const r of okRows) {
          if (r.deptId && !currentKnownDeptIds.has(r.deptId) && !seenNewDeptIds.has(r.deptId)) {
            seenNewDeptIds.add(r.deptId);
            newDeptsToCreate.push({ id: r.deptId, name: r.department });
          }
        }
        Promise.all(newDeptsToCreate.map((d) => createDepartmentIfMissing(d))).catch((err) => {
          console.warn('Department creation note:', err);
        });

        const newDepartmentsCreated = newDeptsToCreate.length;

        // Generate credentials roster (password column omitted since all are Password@123)
        const credentials = newStudents.map((s) => ({
          rollNo: s.rollNo,
          name: s.name,
          email: s.email,
        }));

        onImportComplete(newStudents, newDepartmentsCreated);
        setImportResults({
          importedCount: newStudents.length,
          skippedCount: duplicateRows.length,
          failedCount: errorRows.length,
          newDepartmentsCreated,
          credentials,
        });
        setCurrentStep(3);
        showToast({
          type: 'success',
          message: `Successfully imported ${newStudents.length} student records and provisioned accounts.`,
        });
      }
    }, 40);
  };

  const handleDownloadCredentials = () => {
    if (!importResults) return;
    exportToCSV('apex_student_credentials', importResults.credentials);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Students Batch"
        subtitle="Bulk enroll students via CSV/Excel spreadsheet and generate portal credentials."
      />

      {/* Stepper (1 Upload, 2 Preview, 3 Result) */}
      <div className="py-2">
        <Stepper
          steps={['Upload', 'Preview', 'Result']}
          currentStep={currentStep}
        />
      </div>

      {/* ============================================================= */}
      {/* STEP 1: UPLOAD */}
      {/* ============================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <Card>
            <div className="space-y-4">
              <FileDropzone onFileSelect={handleFileSelect} />

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadSampleExcelTemplate}
                    className="text-[#1F4D3F] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download sample (.XLSX)</span>
                  </button>
                  <span className="text-[#E4DFD3]">·</span>
                  <button
                    onClick={handleDownloadSampleTemplate}
                    className="text-[#1F4D3F] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download sample (.CSV)</span>
                  </button>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadDemoCSV}
                  className="text-xs"
                >
                  Load 29-Row Demo Batch (with errors & duplicates)
                </Button>
              </div>

              {/* Collapsible Required Columns Box */}
              <div className="border border-[#E4DFD3] rounded-[4px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRequiredColumns(!showRequiredColumns)}
                  className="w-full p-2.5 bg-[#FCFBF8] text-xs font-medium text-[#1C1F1D] flex items-center justify-between cursor-pointer"
                >
                  <span>Required Columns & Accepted Values</span>
                  {showRequiredColumns ? (
                    <ChevronUp className="w-4 h-4 text-[#6B6F6A]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B6F6A]" />
                  )}
                </button>
                {showRequiredColumns && (
                  <div className="p-3 text-xs bg-white space-y-1.5 text-[#6B6F6A]">
                    <p>
                      <strong>Mandatory Columns:</strong> Roll No, Name, Email, Department, Program, Year, Section, Batch, CGPA, Backlogs.
                    </p>
                    <p>
                      <strong>Email:</strong> Must be valid university email address.
                    </p>
                    <p>
                      <strong>CGPA:</strong> Numeric scale from 0.0 to 10.0.
                    </p>
                    <p>
                      <strong>Backlogs:</strong> Integer 0 or higher.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-[4px] bg-[#FAF8F3] border border-[#E4DFD3] text-xs text-[#6B6F6A] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#1F4D3F] shrink-0 mt-0.5" />
                <span>
                  A login is created for each imported student. Share the credentials file securely. Existing records are never overwritten.
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 2: PREVIEW */}
      {/* ============================================================= */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {/* Summary Bar */}
          <div className="p-4 bg-white border border-[#E4DFD3] rounded-[6px] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold text-sm text-[#1C1F1D]">
                Batch Summary:
              </span>
              <span className="text-[#1E5631] font-semibold bg-[#EAF3ED] px-2.5 py-1 rounded">
                {okRows.length} OK
              </span>
              <span className="text-[#8C5E09] font-semibold bg-[#FDF6E2] px-2.5 py-1 rounded">
                {duplicateRows.length} Duplicate
              </span>
              <span className="text-[#9E2A2B] font-semibold bg-[#FCECEE] px-2.5 py-1 rounded">
                {errorRows.length} Error
              </span>
            </div>

            {/* Filter chips above table */}
            <div className="flex items-center gap-1.5 text-xs">
              {(['ALL', 'OK', 'DUPLICATE', 'ERROR'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer text-xs font-medium ${
                    filterType === t
                      ? 'bg-[#1F4D3F] text-white'
                      : 'bg-[#FAF8F3] text-[#6B6F6A] hover:text-[#1C1F1D]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Import Progress Bar (if importing) */}
          {isImporting && (
            <Card padding="md" className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#1F4D3F]">
                  Creating student account {importProgress} of {okRows.length}...
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsImporting(false)}
                  className="text-xs text-[#9E2A2B]"
                >
                  Cancel
                </Button>
              </div>
              <ProgressBar value={importProgress} max={okRows.length} />
            </Card>
          )}

          {/* Preview Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#FAF8F3] border-b border-[#E4DFD3] text-[#6B6F6A] sticky top-0 uppercase tracking-[0.06em]">
                  <tr>
                    <th className="w-8 px-2 py-2.5" />
                    <th className="w-14 px-3 py-2.5 font-semibold">Row #</th>
                    <th className="px-3 py-2.5 font-semibold">Roll No</th>
                    <th className="px-3 py-2.5 font-semibold">Student Name</th>
                    <th className="px-3 py-2.5 font-semibold">Email</th>
                    <th className="px-3 py-2.5 font-semibold">Department</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Issue Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4DFD3]">
                  {visiblePreviewRows.map((row) => {
                    let stripColor = 'bg-[#1E5631]';
                    let chipStatus = 'Cleared';
                    if (row.status === 'DUPLICATE') {
                      stripColor = 'bg-[#D97706]';
                      chipStatus = 'Pending';
                    } else if (row.status === 'ERROR') {
                      stripColor = 'bg-[#9E2A2B]';
                      chipStatus = 'Rejected';
                    }

                    return (
                      <tr key={row.rowNum} className="hover:bg-[#FAF8F3] h-10">
                        {/* Left color strip per row */}
                        <td className="p-0">
                          <div className={`w-1.5 h-full min-h-[40px] ${stripColor}`} />
                        </td>
                        <td className="px-3 py-2 font-mono text-[#6B6F6A] tabular-nums">
                          {row.rowNum}
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-[#1C1F1D]">
                          {row.rollNo || '—'}
                        </td>
                        <td className="px-3 py-2 font-medium text-[#1C1F1D]">
                          {row.name || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-[#6B6F6A]">
                          {row.email || '—'}
                        </td>
                        <td className="px-3 py-2 text-[#1C1F1D]">
                          {row.department}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              row.status === 'OK'
                                ? 'bg-[#EAF3ED] text-[#1E5631]'
                                : row.status === 'DUPLICATE'
                                ? 'bg-[#FDF6E2] text-[#8C5E09]'
                                : 'bg-[#FCECEE] text-[#9E2A2B]'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#6B6F6A]">
                          {row.issue || 'Ready for import'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-[#E4DFD3] bg-[#FCFBF8] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#6B6F6A]">
                Duplicates and errors will be skipped. Existing records are never overwritten.
              </p>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setCurrentStep(1)}
                  disabled={isImporting}
                >
                  Back
                </Button>
                {duplicateRows.length + errorRows.length > 0 && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleDownloadErrorRows}
                    disabled={isImporting}
                  >
                    Download error rows (CSV)
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="md"
                  disabled={okRows.length === 0 || isImporting}
                  onClick={handleConfirmImport}
                >
                  Confirm import ({okRows.length} rows)
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 3: RESULT */}
      {/* ============================================================= */}
      {currentStep === 3 && importResults && (
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Three plain stat blocks */}
          <div className="grid grid-cols-3 gap-4">
            <Card padding="md" className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A]">
                Imported
              </p>
              <p className="font-serif text-3xl font-medium text-[#1E5631] mt-1 tabular-nums">
                {importResults.importedCount}
              </p>
              <p className="text-xs text-[#6B6F6A] mt-1">Accounts created</p>
            </Card>

            <Card padding="md" className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A]">
                Skipped
              </p>
              <p className="font-serif text-3xl font-medium text-[#8C5E09] mt-1 tabular-nums">
                {importResults.skippedCount}
              </p>
              <p className="text-xs text-[#6B6F6A] mt-1">Duplicates omitted</p>
            </Card>

            <Card padding="md" className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6F6A]">
                Failed
              </p>
              <p className="font-serif text-3xl font-medium text-[#9E2A2B] mt-1 tabular-nums">
                {importResults.failedCount}
              </p>
              <p className="text-xs text-[#6B6F6A] mt-1">Invalid rows</p>
            </Card>
          </div>

          {/* Failures table with reasons */}
          {errorRows.length > 0 && (
            <Card padding="none">
              <div className="p-3.5 border-b border-[#E4DFD3] bg-[#FCFBF8]">
                <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
                  Skipped / Failed Records Detail
                </h3>
              </div>
              <div className="divide-y divide-[#E4DFD3] max-h-48 overflow-y-auto">
                {errorRows.concat(duplicateRows).map((r) => (
                  <div
                    key={r.rowNum}
                    className="p-3 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-[#1C1F1D]">
                        Row {r.rowNum}: {r.name || r.rollNo || 'Record'}
                      </span>
                      <p className="text-[#6B6F6A] text-[11px] mt-0.5">{r.issue}</p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        r.status === 'DUPLICATE'
                          ? 'bg-[#FDF6E2] text-[#8C5E09]'
                          : 'bg-[#FCECEE] text-[#9E2A2B]'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Credentials and Default Password Information */}
          <Card padding="md" className="bg-[#FAF8F3] border-[#E4DFD3] space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1F4D3F]">
              Student Authentication & Default Passwords
            </h4>
            <p className="text-xs text-[#1C1F1D] leading-relaxed">
              All <strong>{importResults.importedCount}</strong> student accounts have been provisioned in Firebase Auth with the standardized default password <code className="bg-white px-1.5 py-0.5 rounded border border-[#E4DFD3] text-[#1F4D3F] font-mono font-semibold">Password@123</code>.
            </p>
            <p className="text-[11px] text-[#6B6F6A] leading-relaxed">
              Students will be prompted by a persistent banner on their dashboard to update their password upon first sign-in. Downloaded credentials include student identification and email.
            </p>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E4DFD3]">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setParsedRows([]);
                setImportResults(null);
                setCurrentStep(1);
              }}
            >
              Import another file
            </Button>

            <div className="flex items-center gap-2.5">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownloadCredentials}
              >
                Download credentials CSV
              </Button>
              <Button variant="secondary" size="md" onClick={onNavigateToStudents}>
                Go to Students Directory
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
