begin;
create table private.p07_recovery_config(singleton boolean primary key default true check(singleton),window_seconds int not null check(window_seconds between 1 and 86400),max_ip int not null check(max_ip>0),max_target int not null check(max_target>0));
create table private.p07_recovery_rates(kind text not null check(kind in ('ip','target')),fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),bucket bigint not null,hits int not null,primary key(kind,fingerprint,bucket));
alter table private.p07_recovery_config enable row level security;alter table private.p07_recovery_rates enable row level security;
revoke all on private.p07_recovery_config,private.p07_recovery_rates from public,anon,authenticated;
grant select on private.p07_recovery_config to service_role;grant select,insert,update,delete on private.p07_recovery_rates to service_role;
create function private.p07_password_preflight(r jsonb,auth_id uuid,session uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare checked jsonb;
begin
 checked:=private.execute_operation('account_get_v1',r,auth_id,session,ids,null);
 if checked->>'ok' is distinct from 'true' then return checked;end if;
 return jsonb_build_object('_internal_auth_ready',true);
end$$;
create function private.p07_recovery_gate(r jsonb,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg private.p07_recovery_config;rate_bucket bigint;n int;rate_kind text;rate_fingerprint text;trace uuid:=private.new_id(ids,1);code text;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('TEMPORARY_FAILURE');end if;
 if aux->>'bot_verified' is distinct from 'true' or coalesce(aux->>'ip_hash','')!~'^[a-f0-9]{64}$' or coalesce(aux->>'target_hash','')!~'^[a-f0-9]{64}$' then perform private.fail('TEMPORARY_FAILURE');end if;
 select * into cfg from private.p07_recovery_config where singleton;
 if not found then perform private.fail('TEMPORARY_FAILURE');end if;
 rate_bucket:=floor(extract(epoch from clock_timestamp())/cfg.window_seconds)::bigint;
 -- Fixed order and shared hash keys serialize concurrent callers on both limits.
 foreach rate_kind in array array['ip','target'] loop
  rate_fingerprint:=aux->>(rate_kind||'_hash');
  perform pg_advisory_xact_lock(hashtextextended('p07.recovery.'||rate_kind||rate_fingerprint,0));
  insert into private.p07_recovery_rates values(rate_kind,rate_fingerprint,rate_bucket,1) on conflict(kind,fingerprint,bucket) do update set hits=private.p07_recovery_rates.hits+1 returning hits into n;
  if n>(case when rate_kind='ip' then cfg.max_ip else cfg.max_target end) then perform private.fail('RATE_LIMITED');end if;
 end loop;
 delete from private.p07_recovery_rates where (kind,fingerprint,bucket) in (select x.kind,x.fingerprint,x.bucket from private.p07_recovery_rates x where x.bucket<rate_bucket-2 order by x.bucket limit 1000);
 return jsonb_build_object('_internal_recovery_ready',true);
exception when others then
 code:=case when SQLSTATE='P0001' and SQLERRM='RATE_LIMITED' then 'RATE_LIMITED' else 'TEMPORARY_FAILURE' end;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code='TEMPORARY_FAILURE','trace_id',trace));
end$$;
revoke all on function private.p07_password_preflight(jsonb,uuid,uuid,uuid[],jsonb),private.p07_recovery_gate(jsonb,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.p07_password_preflight(jsonb,uuid,uuid,uuid[],jsonb),private.p07_recovery_gate(jsonb,uuid[],jsonb) to service_role;
commit;
