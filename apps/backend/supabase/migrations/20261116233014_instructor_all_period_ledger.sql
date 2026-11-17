-- W1-BE-19 remaining all-period rows reuse the native earning projection.
begin;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.earnings_read(uuid,uuid,uuid,jsonb)'::regprocedure);
 a:=$a$and e.created_at>=(r#>>'{interval,starts_at}')::timestamptz and e.created_at<(r#>>'{interval,ends_at}')::timestamptz$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Native earning interval anchor drift';end if;
 b:=replace(b,a,'and (not r?''interval'' or (e.created_at>=(r#>>''{interval,starts_at}'')::timestamptz and e.created_at<(r#>>''{interval,ends_at}'')::timestamptz))');
 a:='e.person_id=(r->>''person_id'')::uuid';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Native earning alias anchor drift';end if;
 execute replace(b,a,'private.p07_same_person(org,e.person_id,(r->>''person_id'')::uuid)');
 b:=pg_get_functiondef('private.instructor_self_account(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:='view_name not in (''agreements'',''payments'')';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Self account view anchor drift';end if;
 b:=replace(b,a,'view_name not in (''agreements'',''payments'',''earnings'')');
 a:='h:=encode(extensions.digest(';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Self account paging anchor drift';end if;
 b:=replace(b,a,$a$if view_name='earnings' then
  -- The original endpoint still requires interval. Only this guarded native
  -- self reader may omit it; row versions, adjustments and payments stay native.
  select p->'items',p->>'next_cursor' into items,token from (select private.earnings_read(org,center,account,r) p) q;
 else
 $a$||a);
 a:=' -- Flow totals use each ledger''s own timestamp.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Self account totals anchor drift';end if;
 execute replace(b,a,' end if;'||E'\n'||a);
end$patch$;
commit;
