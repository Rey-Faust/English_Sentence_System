begin;
create table public.training_records (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<50000),
 created_at timestamptz not null default now()
);
alter table public.training_records enable row level security;
revoke all on public.training_records from anon;
grant select,insert,delete on public.training_records to authenticated;
create policy own_select on public.training_records for select to authenticated using ((select auth.uid())=user_id);
create policy own_insert on public.training_records for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_delete on public.training_records for delete to authenticated using ((select auth.uid())=user_id);
create index training_records_user_created on public.training_records(user_id,created_at);
create table public.coach_usage (user_id uuid not null references auth.users(id) on delete cascade, day date not null, calls integer not null, primary key(user_id,day));
alter table public.coach_usage enable row level security;
revoke all on public.coach_usage from anon,authenticated;
create function public.consume_coach_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null then return false; end if;
 insert into public.coach_usage(user_id,day,calls) values(auth.uid(),current_date,1)
 on conflict(user_id,day) do update set calls=public.coach_usage.calls+1 where public.coach_usage.calls<100
 returning calls into n;
 return n is not null;
end;
$$;
revoke all on function public.consume_coach_quota() from public,anon;
grant execute on function public.consume_coach_quota() to authenticated;
commit;
