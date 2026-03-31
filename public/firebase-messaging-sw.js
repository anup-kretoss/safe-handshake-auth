importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// SW version — bump this to force browser to install new SW
const SW_VERSION = '3';

firebase.initializeApp({
  apiKey: 'AIzaSyAG62i3wcZBb3833cG3zGLf6evlch5DzQw',
  authDomain: 'souk-it.firebaseapp.com',
  projectId: 'souk-it',
  storageBucket: 'souk-it.firebasestorage.app',
  messagingSenderId: '979438431901',
  appId: '1:979438431901:web:9f499c326a373d8f5f6e74',
});

const messaging = firebase.messaging();

// Background message handler — fires when app tab is NOT focused
messaging.onBackgroundMessage((payload) => {
  console.log('[SW v' + SW_VERSION + '] Background message:', payload);

  const title = payload.notification?.title || payload.data?.title || 'New Notification';
  const body  = payload.notification?.body  || payload.data?.message || '';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.type || 'general',
    data: payload.data || {},
    requireInteraction: false,
  });
});

// Click on notification → focus/open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
