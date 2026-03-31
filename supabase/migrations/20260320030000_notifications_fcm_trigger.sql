-- Enable pg_net extension for HTTP calls from Postgres
create extension if not exists pg_net with schema extensions;

-- Clean up all previous attempts
drop trigger if exists on_notification_insert on notifications;
drop trigger if exists notify_after_insert on notifications;
drop trigger if exists notify_on_insert on notifications;
drop function if exists trigger_fcm_on_notification() cascade;
drop function if exists notify_on_insert_trigger() cascade;

-- Single trigger function: fires FCM push on every INSERT into notifications
create or replace function trigger_fcm_on_notification()
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
  -- Never block the insert even if HTTP fails
  return NEW;
end;
$$;

-- Attach to notifications table — fires after every INSERT
create trigger on_notification_insert
  after insert on notifications
  for each row
  execute function trigger_fcm_on_notification();
