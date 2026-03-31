import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onFCMMessage } from '@/lib/firebase';
import { toast } from 'sonner';

export function useFCM() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onFCMMessage((payload) => {
      // With data-only payload, values are in payload.data
      const title = payload.data?.title || 'New Notification';
      const body = payload.data?.message || '';

      // Show OS-level notification (works even when app tab is active)
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: payload.data?.type || 'general',
        });
      }

      // Also show in-app toast
      toast(title, { description: body, duration: 5000 });

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return unsubscribe;
  }, [queryClient]);
}
