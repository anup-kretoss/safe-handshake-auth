import { useEffect } from 'react';
import { onFCMMessage } from '@/lib/firebase';
import { toast } from 'sonner';

export function useFCM() {
  useEffect(() => {
    // Listen for foreground messages
    const unsubscribe = onFCMMessage((payload) => {
      console.log('Received foreground message:', payload);
      
      const title = payload.notification?.title || 'New Notification';
      const body = payload.notification?.body || '';
      
      // Show toast notification
      toast(title, {
        description: body,
        duration: 5000,
      });
    });

    return unsubscribe;
  }, []);
}
