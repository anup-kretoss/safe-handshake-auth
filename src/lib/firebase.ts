import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Track which sender ID the stored token belongs to
const TOKEN_SENDER_KEY = 'fcm_sender_id';

let app: ReturnType<typeof initializeApp>;
let messaging: ReturnType<typeof getMessaging>;

try {
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (error) {
  console.error('Firebase init error:', error);
}

async function getOrUpdateSW(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  // Unregister any old SW registrations to force fresh install
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    if (reg.active?.scriptURL.includes('firebase-messaging-sw')) {
      await reg.update(); // pull latest version
    }
  }

  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function requestFCMToken(): Promise<string | null> {
  if (!messaging) return null;

  if (Notification.permission === 'denied') {
    console.error('Notifications blocked');
    return null;
  }

  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return null;
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.error('VAPID key missing');
    return null;
  }

  try {
    const swReg = await getOrUpdateSW();

    // If the stored token was from a different sender, delete it first
    const storedSender = localStorage.getItem(TOKEN_SENDER_KEY);
    if (storedSender && storedSender !== firebaseConfig.messagingSenderId) {
      console.log('Sender ID changed — deleting old token');
      try { await deleteToken(messaging); } catch (_) {}
    }

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });

    if (token) {
      localStorage.setItem(TOKEN_SENDER_KEY, firebaseConfig.messagingSenderId!);
      console.log('FCM token:', token.substring(0, 30) + '...');
    } else {
      console.warn('getToken returned empty — check VAPID key matches Firebase project');
    }

    return token || null;
  } catch (err: any) {
    console.error('getToken failed:', err.code, err.message);
    return null;
  }
}

export function onFCMMessage(callback: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
