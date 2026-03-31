-- Drop and recreate with correct pg_net signature (body must be text, not jsonb)
drop trigger if exists on_notification_insert on notifications;
drop function if exists trigger_fcm_on_notification();

create or replace function trigger_fcm_on_notification()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url     := 'https://ciywuwcwixbvmsezppya.supabase.co/functions/v1/notify-on-insert',
    body    := row_to_json(NEW)::text,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    )
  );
  return NEW;
exception when others then
  -- Never block the insert even if HTTP call fails
  return NEW;
end;
$$;

create trigger on_notification_insert
  after insert on notifications
  for each row
  execute function trigger_fcm_on_notification();
