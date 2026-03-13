// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: 'AIzaSyDjrmOL-H7FPmho3bDROkw_qIe1IVEsz3Y',
  authDomain: 'souk-it-app.firebaseapp.com',
  projectId: 'souk-it-app',
  storageBucket: 'souk-it-app.firebasestorage.app',
  messagingSenderId: '803513142685',
  appId: '1:803513142685:web:bbc8ddf7d856b69f8eb374'
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
