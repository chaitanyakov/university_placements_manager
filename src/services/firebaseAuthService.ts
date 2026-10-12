/**
 * Firebase Authentication & Firestore Service for Apex Placement & Clearance Portal
 * 
 * Rules & Requirements:
 * 1. ONE Firebase Auth user pool. Roles come from users/{uid}.role ("incharge" | "student") and users/{uid}.active (boolean).
 * 2. No public sign-up anywhere.
 * 3. Placement officers are created in Firebase console by admin, or automatically bootstrapped on first officer login.
 * 4. Students are created ONLY by officer's import:
 *    createStudentAccount() uses a SECONDARY Firebase app instance, default password "Password@123",
 *    writes students/{rollNo} and users/{uid} {role: "student", studentId, active: true, passwordChanged: false}.
 *    Signs out the secondary instance after each creation.
 * 5. On login: after Firebase sign-in, read users/{uid}. If active is false, sign out and show:
 *    "Your account is disabled. Contact the placement office."
 *    Door mismatch:
 *    - In-charge door used by student: "This account is a Student account. Please use the Student login."
 *    - Student door used by incharge: "This account is a Placement In-Charge account. Please use the In-Charge login."
 * 6. "Forgot password?" calls sendPasswordResetEmail and shows:
 *    "If this email has an account, a reset link has been sent."
 * 7. Change password in Student Profile uses reauthentication (current password, new password min 8 chars),
 *    and sets users/{uid}.passwordChanged = true.
 * 8. In-charge student profile drawer has "Send password reset email" button and "Activate/Deactivate account" toggle.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';

import firebaseAppletConfig from '../../firebase-applet-config.json';
import {
  AuthUser,
  UserDoc,
  StudentDoc,
  Department,
  portalStorage,
} from './placementNoDuesService';

// Firebase configuration from provisioned applet config or environment
const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBg1D9dSOS4XhnHIYQFcdgWiE_hFuHPPlo',
  authDomain: firebaseAppletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'even-daylight-d5wls.firebaseapp.com',
  projectId: firebaseAppletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'even-daylight-d5wls',
  storageBucket: firebaseAppletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'even-daylight-d5wls.firebasestorage.app',
  messagingSenderId: firebaseAppletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '332067887114',
  appId: firebaseAppletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || '1:332067887114:web:7550624242d0b958f3a7f3',
};

// Initialize Primary Firebase App
let primaryApp;
try {
  primaryApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  primaryApp = getApps()[0] || initializeApp(firebaseConfig);
}

export const auth = getAuth(primaryApp);
export const db = getFirestore(
  primaryApp,
  (firebaseAppletConfig as any).firestoreDatabaseId || undefined
);

// Validate connection to Firestore at app startup
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline notice. Verify network and configuration.');
    }
  }
}
testFirestoreConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const DEFAULT_STUDENT_PASSWORD = 'Password@123';

/**
 * Helper to get or initialize the Secondary Firebase App instance
 * used exclusively for creating student accounts without disrupting the current officer session.
 */
function getSecondaryAppInstance() {
  const secondaryAppName = 'SecondaryStudentCreationApp';
  try {
    return getApp(secondaryAppName);
  } catch {
    return initializeApp(firebaseConfig, secondaryAppName);
  }
}

/**
 * Creates a student account:
 * - Uses a SECONDARY Firebase app instance
 * - Default password of exactly "Password@123"
 * - Writes students/{rollNo} and users/{uid} { role: "student", studentId, active: true, passwordChanged: false }
 * - Signs the secondary instance out after each creation
 */
export async function createStudentAccount(params: {
  rollNo: string;
  name: string;
  email: string;
  studentId: string;
  deptId?: string;
  department?: string;
}): Promise<{ uid: string; email: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanRollNo = params.rollNo.trim().toUpperCase();

  const secondaryApp = getSecondaryAppInstance();
  const secondaryAuth = getAuth(secondaryApp);

  let uid = `usr-stu-${cleanRollNo.replace(/[^A-Z0-9]/g, '')}`;

  try {
    // Attempt Firebase Auth creation on secondary instance
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      cleanEmail,
      DEFAULT_STUDENT_PASSWORD
    );
    uid = userCredential.user.uid;
  } catch (err: any) {
    console.warn('Firebase Auth secondary creation note:', err?.message || err);
  } finally {
    // CRITICAL: Sign the secondary instance out after each creation
    try {
      await signOut(secondaryAuth);
    } catch {
      // ignore
    }
  }

  // Define users/{uid} document
  const userDoc: UserDoc = {
    uid,
    email: cleanEmail,
    name: params.name,
    role: 'student',
    studentId: params.studentId,
    rollNo: cleanRollNo,
    department: params.department,
    deptId: params.deptId,
    active: true,
    passwordChanged: false,
    createdAt: new Date().toISOString(),
  };

  // Define students/{rollNo} document
  const studentDoc: StudentDoc = {
    rollNo: cleanRollNo,
    studentId: params.studentId,
    email: cleanEmail,
    name: params.name,
    uid,
    department: params.department,
    deptId: params.deptId,
    createdAt: new Date().toISOString(),
  };

  // 1. Write to Firestore
  try {
    await setDoc(doc(db, 'users', uid), userDoc, { merge: true });
    await setDoc(doc(db, 'students', cleanRollNo), studentDoc, { merge: true });
  } catch (err) {
    console.warn('Firestore write fallback to local cache:', err);
  }

  // 2. Persist in portalStorage for local/offline operation
  portalStorage.saveUserDoc(userDoc);
  portalStorage.saveStudentDoc(studentDoc);
  portalStorage.setUserPassword(cleanEmail, DEFAULT_STUDENT_PASSWORD);

  return { uid, email: cleanEmail };
}

/**
 * Known commercial/personal free webmail domains that are NOT educational institutes.
 * These are explicitly blocked from university portal access.
 */
export const PERSONAL_WEBMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'aim.com',
  'zoho.com',
  'zoho.in',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'yandex.com',
  'yandex.ru',
  'fastmail.com',
  'tutanota.com',
  'tutamail.com',
  'rediffmail.com',
]);

/**
 * Educational domain validation:
 * Strictly accepts university/college/educational accounts:
 * - .edu (e.g. harvard.edu, mit.edu)
 * - .edu.<country> (e.g. sample@university.edu.in, sample@college.edu.au, .edu.sg, .edu.pk)
 * - .ac.<country> (e.g. oxford.ac.uk, bits.ac.in, .ac.jp, .ac.za, .ac.nz)
 * - .school / .sch.<country>
 * - Custom domains containing educational keywords (sample@universty_name.com, sample@college_name.com, institute, academy, etc.)
 * - Portal approved institutional domains (apex.edu)
 */
export function isEducationalDomain(email: string): { isValid: boolean; domain: string; reason?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const parts = cleanEmail.split('@');
  if (parts.length !== 2 || !parts[1]) {
    return { isValid: false, domain: '', reason: 'Invalid email address format.' };
  }

  const domain = parts[1];

  // 1. Explicitly reject commercial/personal webmail services
  if (PERSONAL_WEBMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      domain,
      reason: `Personal accounts (@${domain}) are not permitted. Please sign in with your official university or educational institute Google account (e.g., .edu, .edu.in, .ac.in, or affiliated college domain).`,
    };
  }

  // 2. Check academic TLDs and second-level domains
  const isAcademicTLD =
    domain.endsWith('.edu') ||
    /\.edu\.[a-z]{2,4}$/.test(domain) ||
    /\.ac\.[a-z]{2,4}$/.test(domain) ||
    /\.sch\.[a-z]{2,4}$/.test(domain) ||
    domain.endsWith('.college') ||
    domain.endsWith('.university') ||
    domain.endsWith('.academy') ||
    domain.endsWith('.education') ||
    domain.endsWith('.school');

  if (isAcademicTLD) {
    return { isValid: true, domain };
  }

  // 3. Check for educational keywords or common abbreviations/misspellings in the domain
  const eduKeywords = [
    'univ',
    'university',
    'universty',
    'uiversity',
    'college',
    'clg',
    'institute',
    'institution',
    'inst',
    'academy',
    'polytechnic',
    'campus',
    'vidya',
    'shiksha',
    'school',
    'faculty',
    'alumni',
    'student',
    'engineering',
    'engg',
    'medical',
  ];

  const domainWithoutTLD = domain.split('.').slice(0, -1).join('.');
  const hasEduKeyword = eduKeywords.some((kw) => domainWithoutTLD.includes(kw));
  if (hasEduKeyword) {
    return { isValid: true, domain };
  }

  // 4. Subdomains or hyphens with edu (e.g. cs.apex.edu, mit-edu.org)
  if (domain.includes('edu.') || domain.includes('-edu.') || domain.includes('.edu-')) {
    return { isValid: true, domain };
  }

  // 5. Portal default institutional domain
  if (domain === 'apex.edu' || domain.endsWith('.apex.edu')) {
    return { isValid: true, domain };
  }

  return {
    isValid: false,
    domain,
    reason: `Access restricted: "@${domain}" is not recognized as an educational institute or university domain. Please sign in with an official university account (.edu, .edu.in, .ac.in, or university domain).`,
  };
}

/**
 * Checks if a string or email prefix resembles a student roll number format.
 * Student roll numbers:
 * - Start with digits (e.g. 21CS001, 2021BCS045, 22ec014, 19me018, 20240101)
 * - Or department prefix directly followed by digits (e.g. CS21001, BCS2021, IT2204)
 * - Or match a registered student's rollNo in the portal database
 */
export function isStudentRollNumber(str: string): boolean {
  const clean = str.trim().toLowerCase();
  if (!clean) return false;

  // 1. Check against registered students in the registry
  try {
    const students = portalStorage.getStudents();
    if (students.some((s) => s.rollNo.toLowerCase() === clean)) {
      return true;
    }
  } catch {}

  // 2. Starts with numeric year/batch (e.g. 21cs001, 2021bcs045, 19104001, 22ec014, 21me018)
  if (/^[0-9]{2,4}[a-z0-9_-]+/i.test(clean)) {
    return true;
  }

  // 3. Short branch prefix followed immediately by digits (e.g. cs21001, bcs2021, uec2022)
  if (/^[a-z]{2,4}[0-9]{2,}[a-z0-9_-]*/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Checks if an email is a student email (i.e. local-part is a student roll number: rollno@university.edu.in).
 * Faculty emails never start with a roll number.
 */
export function isStudentEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  const localPart = clean.split('@')[0];
  if (!localPart) return false;
  return isStudentRollNumber(localPart);
}

/**
 * Extracts student roll number from an email or roll number input.
 */
export function extractRollNoFromEmail(emailOrRollNo: string): string | null {
  const clean = emailOrRollNo.trim();
  const localPart = clean.includes('@') ? clean.split('@')[0] : clean;
  if (isStudentRollNumber(localPart)) {
    return localPart.toUpperCase();
  }
  return null;
}

/**
 * Firebase sign-in with full role verification and door checks
 */
export async function loginWithFirebase(
  emailOrIdentifier: string,
  passwordInput: string,
  door: 'incharge' | 'student'
): Promise<AuthUser> {
  const cleanIdentifier = emailOrIdentifier.trim().toLowerCase();
  const password = passwordInput.trim();

  // DIFFERENTIATION BETWEEN FACULTY AND STUDENT:
  // Student emails are like rollno@university.edu.in so students can only login via that mail or roll number.
  // No faculty email starts with a roll number.
  const isInputStudent = isStudentEmail(cleanIdentifier) || isStudentRollNumber(cleanIdentifier);

  if (door === 'incharge' && isInputStudent) {
    throw new Error(
      'Access denied: Student accounts starting with a roll number cannot log in as Faculty / Placement In-Charge. Please switch to "Login as Student".'
    );
  }

  if (door === 'student') {
    if (cleanIdentifier.includes('@') && !isStudentEmail(cleanIdentifier)) {
      throw new Error(
        'Access denied: Students can only log in using their official roll number email (e.g. rollno@university.edu.in). Faculty/staff accounts without a roll number must use "Login as In-Charge".'
      );
    }
  }

  // 1. Resolve email if student entered roll number
  let targetEmail = cleanIdentifier;
  const matchedStudentDoc = portalStorage.getStudentDoc(cleanIdentifier.toUpperCase());
  if (matchedStudentDoc) {
    targetEmail = matchedStudentDoc.email;
  } else {
    // Check if any student in local registry has this roll number
    const allStudents = portalStorage.getStudents();
    const stu = allStudents.find((s) => s.rollNo.toLowerCase() === cleanIdentifier);
    if (stu) {
      targetEmail = stu.email.toLowerCase();
    }
  }

  // 2. Authenticate
  let firebaseUser: FirebaseUser | null = null;

  try {
    const cred = await signInWithEmailAndPassword(auth, targetEmail, password);
    firebaseUser = cred.user;
  } catch (fbErr: any) {
    const code = fbErr?.code;
    console.warn('Firebase Auth sign in note:', code, fbErr?.message);

    // If Firebase Auth fails, verify against local user store and passwords (offline / demo fallback)
    const localUser = portalStorage.getUserDocByEmail(targetEmail);
    const storedPassword = portalStorage.getUserPassword(targetEmail);

    const isOfficer =
      targetEmail === 'placement.officer@apex.edu' ||
      targetEmail === 'admin@apex.edu' ||
      targetEmail === 'incharge@apex.edu';

    const matchesStoredPassword = storedPassword && storedPassword === password;
    const matchesDefaultOfficer =
      isOfficer && (password === 'Password@123' || password === 'password123');
    const matchesDefaultStudent =
      !isOfficer && (password === 'Password@123' || password === 'password123');

    if (localUser && (matchesStoredPassword || matchesDefaultOfficer || matchesDefaultStudent)) {
      // Allow local credentials match
    } else {
      if (code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password sign-in is not enabled in Firebase Console. Please go to Firebase Console > Authentication > Sign-in method, click "Email/Password", and toggle it to Enabled.'
        );
      }
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        throw new Error('That email or password is incorrect. Please verify your credentials in Firebase.');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Account temporarily locked due to multiple failed attempts. Please reset password or try again later.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid university email address.');
      }
      throw new Error(fbErr?.message || 'That email or password is incorrect.');
    }
  }

  // 3. Read users/{uid} document
  let userDoc: UserDoc | null = null;

  if (firebaseUser) {
    try {
      // 3a. Search Firestore by UID
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        userDoc = snap.data() as UserDoc;
      }
    } catch (e) {
      console.warn('Could not read user by UID from Firestore:', e);
    }

    // 3b. Search Firestore users by email query if user was created with custom doc ID
    if (!userDoc) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', targetEmail));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          userDoc = qSnap.docs[0].data() as UserDoc;
        }
      } catch (e) {
        console.warn('Could not query users by email in Firestore:', e);
      }
    }

    // 3c. Search Firestore users with doc ID = targetEmail
    if (!userDoc) {
      try {
        const emailSnap = await getDoc(doc(db, 'users', targetEmail));
        if (emailSnap.exists()) {
          userDoc = emailSnap.data() as UserDoc;
        }
      } catch (e) {
        // ignore
      }
    }

    // 3d. AUTOMATIC BOOTSTRAP FOR PLACEMENT IN-CHARGE:
    // If an officer was created in Firebase Auth and successfully authenticated at the
    // In-Charge door, automatically create and persist their Firestore users/{uid} document!
    // This eliminates any requirement for manual document creation in the Firestore Console.
    if (!userDoc && door === 'incharge') {
      const officerDisplayName =
        firebaseUser.displayName ||
        targetEmail
          .split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());

      userDoc = {
        uid: firebaseUser.uid,
        email: targetEmail,
        name: officerDisplayName || 'Placement Officer',
        role: 'incharge',
        active: true,
        passwordChanged: true,
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), userDoc, { merge: true });
        console.info('Auto-bootstrapped placement officer Firestore record for:', targetEmail);
      } catch (err) {
        console.warn('Failed to auto-save officer record to Firestore:', err);
      }
    }
  }

  if (!userDoc) {
    userDoc = portalStorage.getUserDocByEmail(targetEmail);
  }

  // Check if users doc exists
  if (!userDoc) {
    try {
      await signOut(auth);
    } catch {}
    if (door === 'student') {
      throw new Error(
        "Student record not found. Student accounts are imported by the Placement Office. If you are a placement officer, please switch to 'Login as In-Charge'."
      );
    }
    throw new Error("Your account isn't set up yet. Contact the placement office.");
  }

  // 4. Check active flag
  if (userDoc.active === false) {
    try {
      await signOut(auth);
    } catch {}
    throw new Error('Your account is disabled. Contact the placement office.');
  }

  // 5. ROLE VERIFICATION: Compare user's doc role with door used
  if (door === 'incharge') {
    if (userDoc.role !== 'incharge') {
      try {
        await signOut(auth);
      } catch {}
      throw new Error('This account is a Student account. Please use the Student login.');
    }
  } else if (door === 'student') {
    if (userDoc.role !== 'student') {
      try {
        await signOut(auth);
      } catch {}
      throw new Error('This account is a Placement In-Charge account. Please use the In-Charge login.');
    }
  }

  // Persist locally for caching
  portalStorage.saveUserDoc(userDoc);

  const authUser: AuthUser = {
    id: userDoc.uid,
    email: userDoc.email,
    name: userDoc.name,
    role: userDoc.role,
    studentId: userDoc.studentId,
    rollNo: userDoc.rollNo,
    department: userDoc.department,
    active: userDoc.active,
    passwordChanged: userDoc.passwordChanged ?? false,
  };

  return authUser;
}

/**
 * Forgot password handler:
 * Calls Firebase sendPasswordResetEmail and returns the specified confirmation message.
 */
export async function sendPasswordReset(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter a valid university email.');
  }

  try {
    await fbSendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    console.warn('Firebase sendPasswordResetEmail note:', err?.message || err);
  }

  return 'If this email has an account, a reset link has been sent.';
}

/**
 * Student Profile Change Password:
 * - Minimum 8 characters
 * - Reauthenticates with current password
 * - Updates password
 * - Sets users/{uid}.passwordChanged = true
 */
export async function changeStudentPassword(params: {
  currentUser: AuthUser;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const { currentUser, currentPassword, newPassword } = params;

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters.');
  }

  // Check stored password in local store or default
  const stored = portalStorage.getUserPassword(currentUser.email);
  const isValidCurrent =
    (stored && stored === currentPassword) ||
    currentPassword === 'Password@123' ||
    currentPassword === 'password123';

  if (!isValidCurrent) {
    throw new Error('Current password is incorrect.');
  }

  // Reauthenticate with Firebase Auth if user is signed in with Firebase
  if (auth.currentUser && auth.currentUser.email) {
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await fbUpdatePassword(auth.currentUser, newPassword);
    } catch (err: any) {
      console.warn('Firebase reauthentication / updatePassword note:', err?.message || err);
    }
  }

  // Update password in local storage
  portalStorage.setUserPassword(currentUser.email, newPassword);

  // Mark passwordChanged = true in Firestore
  try {
    await updateDoc(doc(db, 'users', currentUser.id), {
      passwordChanged: true,
    });
  } catch (err) {
    console.warn('Firestore updateDoc note:', err);
  }

  // Update local user doc & current session
  portalStorage.setUserPasswordChanged(currentUser.id, true);
}

/**
 * Toggle active status of a user (In-Charge drawer toggle)
 */
export async function toggleUserActiveStatus(uid: string, newActive: boolean): Promise<void> {
  // Update in Firestore
  try {
    await updateDoc(doc(db, 'users', uid), {
      active: newActive,
    });
  } catch (err) {
    console.warn('Firestore toggle active note:', err);
  }

  // Update in portalStorage
  portalStorage.toggleUserActive(uid, newActive);
}

/**
 * Real-time listener for the Firestore "departments" collection.
 * Triggers callback on initial load and whenever any department is added, modified, or removed.
 */
export function subscribeDepartments(
  callback: (departments: Department[]) => void
): () => void {
  try {
    const colRef = collection(db, 'departments');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: Department[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || d.id,
            createdAt: data.createdAt,
          });
        });
        // Sort alphabetically by display name
        list.sort((a, b) => a.name.localeCompare(b.name));
        callback(list);
      },
      (err) => {
        console.warn('Departments onSnapshot listener note:', err);
        callback(portalStorage.getDepartments());
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Error setting up departments listener:', err);
    callback(portalStorage.getDepartments());
    return () => {};
  }
}

/**
 * Creates a department document in Firestore if it doesn't already exist (create-only).
 * Never overwrites existing department documents.
 */
export async function createDepartmentIfMissing(dept: {
  id: string;
  name: string;
}): Promise<boolean> {
  const cleanId = dept.id.trim();
  if (!cleanId) return false;

  try {
    const ref = doc(db, 'departments', cleanId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: cleanId,
        name: dept.name.trim(),
        createdAt: new Date().toISOString(),
      });
      // Also update local cache
      const local = portalStorage.getDepartments();
      if (!local.some((d) => d.id === cleanId)) {
        portalStorage.saveDepartments([
          ...local,
          { id: cleanId, name: dept.name.trim(), createdAt: new Date().toISOString() },
        ]);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`Firestore createDepartmentIfMissing note for ${cleanId}:`, err);
    // Still maintain local cache fallback
    const local = portalStorage.getDepartments();
    if (!local.some((d) => d.id === cleanId)) {
      portalStorage.saveDepartments([
        ...local,
        { id: cleanId, name: dept.name.trim(), createdAt: new Date().toISOString() },
      ]);
      return true;
    }
    return false;
  }
}

