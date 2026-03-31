-- Helper: check if trigger exists on notifications
create or replace function public.check_notification_trigger()
returns table(trigger_name text, event text, timing text)
language sql security definer
as $$
  select 
    t.trigger_name::text,
    t.event_manipulation::text,
    t.action_timing::text
  from information_schema.triggers t
  where t.event_object_table = 'notifications'
    and t.event_object_schema = 'public';
$$;

-- Helper: check recent pg_net HTTP calls
create or replace function public.check_net_http_calls(lim int default 5)
returns table(id bigint, status_code int, content text, created timestamptz)
language sql security definer
as $$
  select id, status_code, content::text, created
  from net._http_response
  order by created desc
  limit lim;
$$;

-- Re-create the FCM trigger cleanly
drop trigger if exists on_notification_insert on public.notifications;
drop function if exists public.trigger_fcm_on_notification() cascade;

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

create trigger on_notification_insert
  after insert on public.notifications
  for each row
  execute function public.trigger_fcm_on_notification();
