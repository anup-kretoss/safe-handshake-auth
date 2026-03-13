
-- Fix notifications insert policy - only allow system/service role or self-insert
DROP POLICY "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);
