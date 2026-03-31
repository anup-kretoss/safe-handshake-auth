-- ============================================================
-- RUN THIS IN: https://supabase.com/dashboard/project/ciywuwcwixbvmsezppya/sql/new
-- ============================================================

-- Step 1: Enable pg_net
create extension if not exists pg_net with schema extensions;

-- Step 2: Clean up ALL old trigger versions
drop trigger if exists on_notification_insert on public.notifications;
drop trigger if exists notify_after_insert on public.notifications;
drop trigger if exists notify_on_insert on public.notifications;
drop function if exists public.trigger_fcm_on_notification() cascade;
drop function if exists public.notify_on_insert_trigger() cascade;

-- Step 3: Create the trigger function
create or replace function public.trigger_fcm_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://ciywuwcwixbvmsezppya.supabase.co/functions/v1/notify-on-insert',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEwMDI5NywiZXhwIjoyMDg3Njc2Mjk3fQ.3I82_fnvaeaT60r4wLsLFusFpObQbLycpXUns3xi4as'
    ),
    body := row_to_json(NEW)::jsonb
  );
  return NEW;
exception when others then
  return NEW;
end;
$$;

-- Step 4: Attach trigger to notifications table
create trigger on_notification_insert
  after insert on public.notifications
  for each row
  execute function public.trigger_fcm_on_notification();

-- Step 5: Verify it's there
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_table = 'notifications'
  and event_object_schema = 'public';
