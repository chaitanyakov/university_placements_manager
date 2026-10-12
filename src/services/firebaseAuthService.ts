/**
 * Firebase Authentication & Firestore Service for HireSight Placement & Clearance Portal
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
  deleteUser,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  writeBatch,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

import firebaseAppletConfig from '../../firebase-applet-config.json';
import {
  Application,
  AuthUser,
  ClearanceRecord,
  Student,
  Drive,
  ClearanceCategory,
  UserDoc,
  StudentDoc,
  Department,
  portalStorage,
} from './placementNoDuesService';

// Firebase configuration from provisioned applet config or environment
const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAJYD2M5H4kqIxJbK5Uj6z_lt-jNhDYNd0',
  authDomain: firebaseAppletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'hackathon-1968d.firebaseapp.com',
  projectId: firebaseAppletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'hackathon-1968d',
  storageBucket: firebaseAppletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'hackathon-1968d.firebasestorage.app',
  messagingSenderId: firebaseAppletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '565212693680',
  appId: firebaseAppletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || '1:565212693680:web:0aa3d30fb97eab87d86775',
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
const storage = getStorage(primaryApp);
const functions = getFunctions(primaryApp, 'us-central1');

export async function deleteStudentFirebaseAccounts(
  students: Array<Pick<StudentDoc, 'rollNo' | 'studentId' | 'email'>>
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Sign in as a placement officer before deleting students.');
  }
  const deleteStudents = httpsCallable<
    { students: Array<Pick<StudentDoc, 'rollNo' | 'studentId' | 'email'>> },
    { deletedCount: number }
  >(functions, 'deleteStudentAccounts');
  await deleteStudents({ students });
}

export async function uploadOfferLetter(
  applicationId: string,
  file: File
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Sign in as a placement officer before uploading an offer letter.');
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Offer letters must be PDF files.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Offer letters must be 10 MB or smaller.');
  }
  if (await file.slice(0, 5).text() !== '%PDF-') {
    throw new Error('The selected file is not a valid PDF.');
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `offer-letters/${applicationId}/${Date.now()}-${safeFileName}`;
  const fileRef = storageRef(storage, path);

  await uploadBytes(fileRef, file, { contentType: 'application/pdf' });
  try {
    await updateDoc(doc(db, 'applications', applicationId), {
      offerLetterPath: path,
      offerLetterName: file.name,
      offerLetterUploadedAt: new Date().toISOString(),
      isOfferPublished: true,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    try {
      await deleteObject(fileRef);
    } catch (cleanupError) {
      console.error('Could not remove an offer letter after its Firestore update failed:', cleanupError);
    }
    throw error;
  }
}

export async function getOfferLetterDownloadUrl(path: string): Promise<string> {
  return getDownloadURL(storageRef(storage, path));
}

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
  profile: Student;
  applications: Application[];
  clearances: ClearanceRecord[];
}): Promise<{ uid: string; email: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanRollNo = params.rollNo.trim().toUpperCase();

  const secondaryApp = getSecondaryAppInstance();
  const secondaryAuth = getAuth(secondaryApp);

  let userCredential;

  try {
    try {
      userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        cleanEmail,
        DEFAULT_STUDENT_PASSWORD
      );
    } catch (err: any) {
      if (err?.code !== 'auth/email-already-in-use') throw err;

      try {
        userCredential = await signInWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          DEFAULT_STUDENT_PASSWORD
        );
      } catch (signInError: any) {
        throw new Error(
          `A Firebase account already exists for ${cleanEmail}, but it could not be verified with the default password. ` +
          `Ask the student to reset their password or resolve the account in Firebase Console.`
        );
      }
    }
  } catch (err: any) {
    throw new Error(`Could not create Firebase account for ${cleanEmail}: ${err?.message || err}`);
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch (err) {
      console.warn('Could not sign out the secondary Firebase account:', err);
    }
  }
  const uid = userCredential.user.uid;

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
    profile: params.profile,
  };

  // Commit both profile documents together so accounts are never partially provisioned.
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), userDoc, { merge: true });
    batch.set(doc(db, 'students', cleanRollNo), studentDoc, { merge: true });
    params.applications.forEach((application) => {
      batch.set(doc(db, 'applications', application.id), application);
    });
    params.clearances.forEach((clearance) => {
      batch.set(doc(db, 'clearances', clearance.id), clearance);
    });
    await batch.commit();
  } catch (err) {
    try {
      await deleteUser(userCredential.user);
    } catch (cleanupError) {
      console.error(`Could not remove the incomplete Firebase account for ${cleanEmail}:`, cleanupError);
    }
    throw new Error(
      `Could not save Firebase records for ${cleanEmail}: ${err instanceof Error ? err.message : String(err)}`
    );
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
    if (cleanIdentifier.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)) {
      throw new Error(
        'Enter the student email address used when the placement office imported the account.'
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
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password sign-in is not enabled in Firebase Console. Enable it under Authentication > Sign-in method.'
      );
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      throw new Error('That email or password is incorrect. Please verify your Firebase credentials.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Account temporarily locked due to multiple failed attempts. Please reset password or try again later.');
    }
    if (code === 'auth/invalid-email') {
      throw new Error('Please enter a valid university email address.');
    }
    throw new Error(fbErr?.message || 'Could not sign in to Firebase.');
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
        await signOut(auth);
        throw new Error(
          `Firebase sign-in succeeded, but the officer profile could not be created in Firestore: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
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

  if (!auth.currentUser || auth.currentUser.uid !== currentUser.id || !auth.currentUser.email) {
    throw new Error('Your Firebase session has expired. Sign in again before changing your password.');
  }

  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await fbUpdatePassword(auth.currentUser, newPassword);

  try {
    await updateDoc(doc(db, 'users', currentUser.id), {
      passwordChanged: true,
    });
  } catch (err) {
    throw new Error(
      `Your Firebase password was changed, but the profile could not be updated: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  portalStorage.setUserPassword(currentUser.email, newPassword);
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
  callback: (departments: Department[]) => void,
  onError?: (error: Error) => void
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
        onError?.(err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Error setting up departments listener:', err);
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}

export function subscribeStudents(
  callback: (students: Student[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    collection(db, 'students'),
    (snapshot) => {
      const students = snapshot.docs
        .map((studentDoc) => studentDoc.data().profile as Student | undefined)
        .filter((student): student is Student => Boolean(student));
      callback(students);
    },
    (error) => {
      console.error('Could not sync students from Firestore:', error);
      onError?.(error);
    }
  );
}

export function subscribeDrives(
  callback: (drives: Drive[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    collection(db, 'drives'),
    (snapshot) => callback(snapshot.docs.map((driveDoc) => ({
      ...driveDoc.data(),
      id: driveDoc.id,
    }) as Drive)),
    (error) => {
      console.error('Could not sync placement drives from Firestore:', error);
      onError?.(error);
    }
  );
}

export function subscribeClearanceCategories(
  callback: (categories: ClearanceCategory[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    collection(db, 'categories'),
    (snapshot) => {
      const categories = snapshot.docs
        .map((categoryDoc) => categoryDoc.data() as ClearanceCategory)
        .sort((left, right) => left.order - right.order);
      callback(categories);
    },
    (error) => {
      console.error('Could not sync clearance categories from Firestore:', error);
      onError?.(error);
    }
  );
}

export function subscribeApplications(
  user: AuthUser,
  callback: (applications: Application[]) => void,
  onError?: (error: Error) => void
): () => void {
  const applicationsRef = collection(db, 'applications');
  const applicationsQuery = user.role === 'student'
    ? query(applicationsRef, where('studentId', '==', user.studentId || user.id))
    : applicationsRef;

  return onSnapshot(
    applicationsQuery,
    (snapshot) => {
      callback(snapshot.docs.map((applicationDoc) => applicationDoc.data() as Application));
    },
    (error) => {
      console.error('Could not sync placement applications from Firestore:', error);
      onError?.(error);
    }
  );
}

export function subscribeClearances(
  user: AuthUser,
  callback: (clearances: ClearanceRecord[]) => void,
  onError?: (error: Error) => void
): () => void {
  const clearancesRef = collection(db, 'clearances');
  const clearancesQuery = user.role === 'student'
    ? query(clearancesRef, where('studentId', '==', user.studentId || user.id))
    : clearancesRef;

  return onSnapshot(
    clearancesQuery,
    (snapshot) => {
      callback(snapshot.docs.map((clearanceDoc) => clearanceDoc.data() as ClearanceRecord));
    },
    (error) => {
      console.error('Could not sync clearance records from Firestore:', error);
      onError?.(error);
    }
  );
}

export function subscribeStudentProfile(
  rollNo: string,
  callback: (student: Student | null) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'students', rollNo.trim().toUpperCase()),
    (snapshot) => {
      const profile = snapshot.data()?.profile as Student | undefined;
      callback(profile || null);
    },
    (error) => {
      console.error(`Could not load the student profile for ${rollNo}:`, error);
      onError?.(error);
    }
  );
}

export async function saveChangedApplications(
  previous: Application[],
  updated: Application[]
): Promise<void> {
  const previousById = new Map(previous.map((application) => [application.id, application]));
  const updatedById = new Map(updated.map((application) => [application.id, application]));
  const operations = [
    ...updated
      .filter((application) =>
        JSON.stringify(previousById.get(application.id)) !== JSON.stringify(application)
      )
      .map((application) => ({ type: 'set' as const, application })),
    ...previous
      .filter((application) => !updatedById.has(application.id))
      .map((application) => ({ type: 'delete' as const, application })),
  ];

  for (let start = 0; start < operations.length; start += 450) {
    const batch = writeBatch(db);
    operations.slice(start, start + 450).forEach(({ type, application }) => {
      const applicationRef = doc(db, 'applications', application.id);
      if (type === 'set') batch.set(applicationRef, application);
      else batch.delete(applicationRef);
    });
    await batch.commit();
  }
}

export async function saveChangedStudentProfiles(
  previous: Student[],
  updated: Student[]
): Promise<void> {
  const previousById = new Map(previous.map((student) => [student.id, student]));
  const changed = updated.filter(
    (student) => JSON.stringify(previousById.get(student.id)) !== JSON.stringify(student)
  );

  for (let start = 0; start < changed.length; start += 450) {
    const batch = writeBatch(db);
    changed.slice(start, start + 450).forEach((student) => {
      batch.set(
        doc(db, 'students', student.rollNo.trim().toUpperCase()),
        { profile: student },
        { merge: true }
      );
    });
    await batch.commit();
  }
}

export async function saveChangedDrives(
  previous: Drive[],
  updated: Drive[]
): Promise<void> {
  const previousById = new Map(previous.map((drive) => [drive.id, drive]));
  const updatedById = new Map(updated.map((drive) => [drive.id, drive]));
  const operations = [
    ...updated
      .filter((drive) => JSON.stringify(previousById.get(drive.id)) !== JSON.stringify(drive))
      .map((drive) => ({ type: 'set' as const, drive })),
    ...previous
      .filter((drive) => !updatedById.has(drive.id))
      .map((drive) => ({ type: 'delete' as const, drive })),
  ];

  for (let start = 0; start < operations.length; start += 450) {
    const batch = writeBatch(db);
    operations.slice(start, start + 450).forEach(({ type, drive }) => {
      const driveRef = doc(db, 'drives', drive.id);
      if (type === 'set') batch.set(driveRef, drive);
      else batch.delete(driveRef);
    });
    await batch.commit();
  }
}

export async function saveChangedClearanceCategories(
  previous: ClearanceCategory[],
  updated: ClearanceCategory[]
): Promise<void> {
  const previousById = new Map(previous.map((category) => [category.id, category]));
  const updatedById = new Map(updated.map((category) => [category.id, category]));
  const operations = [
    ...updated
      .filter((category) => JSON.stringify(previousById.get(category.id)) !== JSON.stringify(category))
      .map((category) => ({ type: 'set' as const, category })),
    ...previous
      .filter((category) => !updatedById.has(category.id))
      .map((category) => ({ type: 'delete' as const, category })),
  ];

  for (let start = 0; start < operations.length; start += 450) {
    const batch = writeBatch(db);
    operations.slice(start, start + 450).forEach(({ type, category }) => {
      const categoryRef = doc(db, 'categories', category.id);
      if (type === 'set') batch.set(categoryRef, category);
      else batch.delete(categoryRef);
    });
    await batch.commit();
  }
}

export async function saveChangedClearances(
  previous: ClearanceRecord[],
  updated: ClearanceRecord[]
): Promise<void> {
  const previousById = new Map(previous.map((record) => [record.id, record]));
  const updatedById = new Map(updated.map((record) => [record.id, record]));
  const operations = [
    ...updated
      .filter((record) => JSON.stringify(previousById.get(record.id)) !== JSON.stringify(record))
      .map((record) => ({ type: 'set' as const, record })),
    ...previous
      .filter((record) => !updatedById.has(record.id))
      .map((record) => ({ type: 'delete' as const, record })),
  ];

  for (let start = 0; start < operations.length; start += 450) {
    const batch = writeBatch(db);
    operations.slice(start, start + 450).forEach(({ type, record }) => {
      const recordRef = doc(db, 'clearances', record.id);
      if (type === 'set') batch.set(recordRef, record);
      else batch.delete(recordRef);
    });
    await batch.commit();
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
    throw new Error(
      `Could not create department ${dept.name.trim()} in Firestore: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
