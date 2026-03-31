-- Enable pg_net (HTTP calls from Postgres triggers)
create extension if not exists pg_net with schema extensions;

-- Drop if re-running
drop trigger if exists on_notification_insert on notifications;
drop function if exists trigger_fcm_on_notification();

-- Fires notify-on-insert edge function on every new notification row
create or replace function trigger_fcm_on_notification()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url     := 'https://ciywuwcwixbvmsezppya.supabase.co/functions/v1/notify-on-insert',
    body    := to_jsonb(NEW),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    )
  );
  return NEW;
end;
$$;

create trigger on_notification_insert
  after insert on notifications
  for each row
  execute function trigger_fcm_on_notification();
