begin;

-- Keep the organization writer lock before the hold lock. Use NO KEY UPDATE
-- so a concurrent hold can commit its organization foreign key check.
do $patch$
declare body text; anchor text;
 org_lock constant text:=' perform 1 from core.organizations where id=org for update;';
 writer_lock constant text:=' perform 1 from core.organizations where id=org for no key update;';
begin
 body:=pg_get_functiondef('private.p06_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 if array_length(string_to_array(body,org_lock),1)<>2 then raise exception 'P06 claim organization lock anchor mismatch';end if;
 body:=replace(body,org_lock,writer_lock);
 anchor:=$a$ delete from private.p06_previews where org_id=org and expires_at<=clock_timestamp();
 delete from private.p06_contexts c using core.operation_receipts r where c.receipt_id=r.id and c.org_id=org and r.result_expires_at<=clock_timestamp();$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'P06 tracking expiry anchor mismatch';end if;
 execute replace(body,anchor,$a$ lock table core.retention_holds in share mode;
 delete from private.p06_previews p
 where p.org_id=org and p.expires_at<=clock_timestamp()
  and not exists(
   select 1 from core.retention_holds h
   where (h.subject_id=p.account_id and h.subject_table in ('accounts','core.accounts'))
    or (h.org_id=p.org_id and (
     (h.subject_id=p.org_id and h.subject_table in ('organizations','core.organizations'))
     or (h.subject_id=p.preview_id and h.subject_table in ('previews','core.previews','p06_previews','private.p06_previews'))
    ))
  );
 delete from private.p06_contexts c using core.operation_receipts r
 where c.receipt_id=r.id and c.org_id=org and r.result_expires_at<=clock_timestamp()
  and not exists(
   select 1 from core.retention_holds h
   where (h.subject_id=c.account_id and h.subject_table in ('accounts','core.accounts'))
    or (h.org_id=c.org_id and (
     (h.subject_id=c.org_id and h.subject_table in ('organizations','core.organizations'))
     or (h.subject_id=c.receipt_id and h.subject_table in ('operation_receipts','core.operation_receipts','p06_contexts','private.p06_contexts'))
    ))
  );$a$);

 body:=pg_get_functiondef('private.p06_expire_exports(uuid,integer)'::regprocedure);
 if array_length(string_to_array(body,org_lock),1)<>2 then raise exception 'P06 export expiry organization lock anchor mismatch';end if;
 execute replace(body,org_lock,writer_lock);
end$patch$;

commit;
