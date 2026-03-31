-- Drop previous attempts
drop trigger if exists on_notification_insert on notifications;
drop trigger if exists notify_on_insert on notifications;
drop function if exists trigger_fcm_on_notification();
drop function if exists notify_on_insert_trigger();

-- Correct trigger using service role key and proper pg_net jsonb body
create or replace function trigger_fcm_on_notification()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url     := 'https://ciywuwcwixbvmsezppya.supabase.co/functions/v1/notify-on-insert',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEwMDI5NywiZXhwIjoyMDg3Njc2Mjk3fQ.3I82_fnvaeaT60r4wLsLFusFpObQbLycpXUns3xi4as'
    ),
    body    := row_to_json(NEW)::jsonb
  );
  return NEW;
exception when others then
  return NEW; -- never block the insert
end;
$$;

create trigger on_notification_insert
  after insert on notifications
  for each row
  execute function trigger_fcm_on_notification();
