const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();

const db = getFirestore();

exports.deleteStudentAccounts = onCall(
  { region: 'us-central1', maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in as a placement officer first.');
    }

    const caller = await db.collection('users').doc(request.auth.uid).get();
    if (!caller.exists || caller.data().role !== 'incharge') {
      throw new HttpsError('permission-denied', 'Only placement officers can delete student accounts.');
    }

    const students = request.data?.students;
    if (
      !Array.isArray(students) ||
      students.length === 0 ||
      students.length > 100 ||
      new Set(students.map((student) => student?.rollNo?.trim().toUpperCase())).size !== students.length ||
      students.some(
        (student) =>
          !student ||
          typeof student.rollNo !== 'string' ||
          typeof student.studentId !== 'string' ||
          typeof student.email !== 'string'
      )
    ) {
      throw new HttpsError('invalid-argument', 'Provide 1 to 100 valid student records.');
    }

    const profiles = [];
    for (const input of students) {
      const rollNo = input.rollNo.trim().toUpperCase();
      const email = input.email.trim().toLowerCase();
      const studentRef = db.collection('students').doc(rollNo);
      const studentSnapshot = await studentRef.get();

      if (!studentSnapshot.exists) {
        throw new HttpsError(
          'failed-precondition',
          `No Firestore student profile exists for ${rollNo}; no accounts were deleted.`
        );
      }

      const student = studentSnapshot.data();
      if (
        student.studentId !== input.studentId ||
        String(student.email || '').toLowerCase() !== email ||
        typeof student.uid !== 'string'
      ) {
        throw new HttpsError(
          'failed-precondition',
          `The Firestore profile for ${rollNo} does not match the selected student; no accounts were deleted.`
        );
      }

      const userRef = db.collection('users').doc(student.uid);
      const userSnapshot = await userRef.get();
      if (
        !userSnapshot.exists ||
        userSnapshot.data().role !== 'student' ||
        userSnapshot.data().studentId !== input.studentId ||
        String(userSnapshot.data().email || '').toLowerCase() !== email ||
        String(userSnapshot.data().rollNo || '').toUpperCase() !== rollNo
      ) {
        throw new HttpsError(
          'failed-precondition',
          `No matching student account profile exists for ${rollNo}; no accounts were deleted.`
        );
      }

      profiles.push({ rollNo, studentId: input.studentId, uid: student.uid, studentRef, userRef });
    }

    for (const profile of profiles) {
      try {
        await getAuth().deleteUser(profile.uid);
      } catch (error) {
        if (error.code !== 'auth/user-not-found') {
          throw new HttpsError(
            'internal',
            `Could not delete the Firebase login for ${profile.rollNo}: ${error.message}`
          );
        }
      }

      await Promise.all([
        profile.studentRef.delete(),
        profile.userRef.delete(),
        deleteStudentRecords('clearances', profile.studentId),
        deleteStudentRecords('applications', profile.studentId),
        removeFromDrives(profile.studentId),
      ]);
    }

    return { deletedCount: profiles.length };
  }
);

async function deleteStudentRecords(collectionName, studentId) {
  const records = await db.collection(collectionName).where('studentId', '==', studentId).get();
  for (let start = 0; start < records.docs.length; start += 400) {
    const batch = db.batch();
    records.docs.slice(start, start + 400).forEach((record) => batch.delete(record.ref));
    await batch.commit();
  }
}

async function removeFromDrives(studentId) {
  const drives = await db
    .collection('drives')
    .where('registeredStudentIds', 'array-contains', studentId)
    .get();

  for (let start = 0; start < drives.docs.length; start += 400) {
    const batch = db.batch();
    drives.docs
      .slice(start, start + 400)
      .forEach((drive) =>
        batch.update(drive.ref, {
          registeredStudentIds: FieldValue.arrayRemove(studentId),
        })
      );
    await batch.commit();
  }
}
