import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App, ServiceAccount } from 'firebase-admin/app';

export const FIREBASE_ADMIN_APP = Symbol('FIREBASE_ADMIN_APP');

export const firebaseAdminAppProvider = {
  provide: FIREBASE_ADMIN_APP,
  useFactory: (): App => {
    const existingApp = getApps()[0];
    if (existingApp) return existingApp;

    const serviceAccount = loadServiceAccount();
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  },
};

function loadServiceAccount(): ServiceAccount {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  }

  let parsed: {
    client_email?: string;
    private_key?: string;
    project_id?: string;
  };
  try {
    parsed = JSON.parse(json) as typeof parsed;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error(
      'Firebase service account JSON is missing required fields.',
    );
  }

  return {
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    projectId: parsed.project_id,
  };
}
