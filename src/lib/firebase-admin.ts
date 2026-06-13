// Firebase Admin SDK — for use in server-side code (API routes) only
import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminDb: Firestore;

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0] as App;
  }

  // In Cloud Run, use Application Default Credentials (ADC)
  // Locally, set FIREBASE_SERVICE_ACCOUNT_KEY as base64-encoded service account JSON
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(
      Buffer.from(serviceAccountKey, 'base64').toString('utf8')
    );
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  // Default: use Application Default Credentials (works in Cloud Run automatically)
  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

function getAdminDb(): Firestore {
  if (!adminApp) {
    adminApp = getAdminApp();
  }
  if (!adminDb) {
    adminDb = getFirestore(adminApp);
  }
  return adminDb;
}

export { getAdminDb };
