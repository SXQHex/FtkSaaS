begin;
-- P08: a number is never recycled. Erasure can remove its person link, not the org counter.
create table private.subscriber_counters (
 org_id uuid primary key references core.organizations(id) on delete cascade,
 last_number bigint not null default 1000 check(last_number>=1000)
);
create table private.subscriber_numbers (
 org_id uuid not null references core.organizations(id) on delete cascade,
 number bigint not null check(number>=1001),person_id uuid,
 assigned_at timestamptz not null default clock_timestamp(),primary key(org_id,number),
 foreign key(org_id,person_id) references core.people(org_id,id) on delete set null(person_id)
);
create index subscriber_person on private.subscriber_numbers(org_id,person_id,number);
alter table private.subscriber_counters enable row level security;
alter table private.subscriber_numbers enable row level security;
revoke all on private.subscriber_counters,private.subscriber_numbers from public,anon,authenticated;
grant select,insert,update on private.subscriber_counters,private.subscriber_numbers to service_role;
create function private.subscriber_number(org uuid,pid uuid) returns text
language sql stable security invoker set search_path='' as $$
 select min(n.number)::text from private.subscriber_numbers n where n.org_id=org and n.person_id=private.p07_person_root(org,pid)
$$;
create function private.subscriber_allocate(org uuid,pid uuid) returns bigint
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare canonical uuid;result bigint;
begin
 -- Same lock and ordering as commands, merge and the repeatable backfill.
 perform 1 from core.organizations o where o.id=org for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 canonical:=private.p07_person_root(org,pid);
 if canonical is null then perform private.fail('NOT_FOUND');end if;
 select min(n.number) into result from private.subscriber_numbers n where n.org_id=org and n.person_id=canonical;
 if result is not null then return result;end if;
 insert into private.subscriber_counters(org_id) values(org) on conflict(org_id) do nothing;
 update private.subscriber_counters c set last_number=c.last_number+1 where c.org_id=org returning last_number into result;
 insert into private.subscriber_numbers(org_id,number,person_id) values(org,result,canonical);
 return result;
end$$;
create function private.subscriber_student() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='student' then perform private.subscriber_allocate(new.org_id,new.person_id);end if;
 return new;
end$$;
create trigger subscriber_student after insert or update of kind,person_id,org_id on core.center_relationships
 for each row execute function private.subscriber_student();
create function private.subscriber_number_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.org_id is distinct from old.org_id or new.number is distinct from old.number or new.assigned_at is distinct from old.assigned_at then perform private.fail('INVALID_STATE_TRANSITION');end if;
 return new;
end$$;
create trigger subscriber_number_immutable before update on private.subscriber_numbers
 for each row execute function private.subscriber_number_immutable();
create function private.subscriber_backfill(org uuid) returns void language plpgsql security invoker set search_path='' as $$
declare student record;
begin
 perform 1 from core.organizations o where o.id=org for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 for student in
  select private.p07_person_root(org,r.person_id) pid,min(r.created_at) first_at
  from core.center_relationships r where r.org_id=org and r.kind='student'
  group by private.p07_person_root(org,r.person_id) order by first_at,pid
 loop
  if student.pid is not null then perform private.subscriber_allocate(org,student.pid);end if;
 end loop;
end$$;
do $backfill$
declare org uuid;
begin
 for org in select o.id from core.organizations o order by o.id loop perform private.subscriber_backfill(org);end loop;
end$backfill$;
do $patch$
declare b text;anchor text;replacement text;
begin
 -- Merge aliases BEFORE moving student relationships, so one-number merges cannot mint a second number.
 b:=pg_get_functiondef('private.p07_merge(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:='members:=private.p07_person_members(org,source);';
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber merge anchor drift';end if;
 execute replace(b,anchor,anchor||' update private.subscriber_numbers n set person_id=target where n.org_id=org and n.person_id=any(members);');
 b:=pg_get_functiondef('private.p07_merge_snapshot(uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$return jsonb_build_object('hash',$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber merge snapshot anchor drift';end if;
 execute replace(b,anchor,$a$all_data:=all_data||jsonb_build_array(jsonb_build_object('table','subscriber_numbers','rows',
  (select coalesce(jsonb_agg(to_jsonb(n) order by n.number),'[]'::jsonb) from private.subscriber_numbers n where n.org_id=org and n.person_id=any(ids))));
 return jsonb_build_object('hash',$a$);
 b:=pg_get_functiondef('private.person_projection(uuid,uuid,uuid,boolean,boolean)'::regprocedure);
 anchor:=$a$'display_name',p.display_name,$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber person projection anchor drift';end if;
 execute replace(b,anchor,anchor||$a$'subscriber_number',private.subscriber_number(org,p.id),$a$);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$and (r->>'query' is null or strpos(lower(p.display_name),lower(r->>'query'))>0)$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber person search anchor drift';end if;
 execute replace(b,anchor,$a$and (r->>'query' is null or strpos(lower(p.display_name),lower(r->>'query'))>0 or exists(
  select 1 from private.subscriber_numbers sn where sn.org_id=org and sn.person_id=p.id and sn.number::text=btrim(r->>'query')))$a$);
 b:=pg_get_functiondef('private.p06_report_rows(jsonb,uuid,uuid[])'::regprocedure);
 anchor:=$a$'person_id',person_id,'currency',currency$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber report projection anchor drift';end if;
 execute replace(b,anchor,$a$'person_id',person_id,'subscriber_number',private.subscriber_number(org,person_id),'currency',currency$a$);
 b:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$["group_key","center_id","person_id","currency","count","amount_minor","credits","basis_count","ratio_bps"]$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber default report columns anchor drift';end if;
 execute replace(b,anchor,$a$["group_key","center_id","person_id","currency","count","amount_minor","credits","basis_count","ratio_bps","subscriber_number"]$a$);
 b:=pg_get_functiondef('private.work_report_csv(jsonb,jsonb,bigint)'::regprocedure);
 anchor:='jsonb_array_length(columns)>9';
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber selected CSV width anchor drift';end if;
 b:=replace(b,anchor,'jsonb_array_length(columns)>10');
 anchor:=$a$'credits','basis_count','ratio_bps'))$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber selected CSV columns anchor drift';end if;
 execute replace(b,anchor,$a$'credits','basis_count','ratio_bps','subscriber_number'))$a$);
 b:=pg_get_functiondef('private.p06_worker_execute(text,jsonb,uuid[])'::regprocedure);
 anchor:=$a$group_key,center_id,person_id,currency,count,amount_minor,credits,basis_count,ratio_bps$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber export header anchor drift';end if;
 b:=replace(b,anchor,anchor||',subscriber_number');
 anchor:=$a$'credits','basis_count','ratio_bps']$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber export field anchor drift';end if;
 execute replace(b,anchor,$a$'credits','basis_count','ratio_bps','subscriber_number']$a$);
end$patch$;
revoke all on function private.subscriber_number(uuid,uuid),private.subscriber_allocate(uuid,uuid),private.subscriber_student(),private.subscriber_number_immutable(),private.subscriber_backfill(uuid) from public,anon,authenticated;
grant execute on function private.subscriber_number(uuid,uuid),private.subscriber_allocate(uuid,uuid),private.subscriber_student(),private.subscriber_number_immutable(),private.subscriber_backfill(uuid) to service_role;
notify pgrst,'reload schema';
commit;
