begin;

alter table core.notifications add column if not exists inbox_visibility text not null default 'inbox'
 check(inbox_visibility in ('inbox','archived','deleted'));

do $patch$
declare body text; anchor text;
begin
 body:=pg_get_functiondef('private.notification_page_before_work(jsonb,uuid,uuid)'::regprocedure);
 anchor:='and created_at<=asof';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Legacy inbox visibility anchor drift';end if;
 execute replace(body,anchor,$a$and inbox_visibility='inbox' $a$||anchor);

 body:=pg_get_functiondef('private.p05_notification_page(jsonb,uuid,uuid)'::regprocedure);
 anchor:=$a$not(r?'query' or r?'work_state'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox projection routing anchor drift';end if;
 body:=replace(body,anchor,$a$not(r?'visibility' or r?'query' or r?'work_state'$a$);
 anchor:='and n.created_at<=stamp';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox projection source anchor drift';end if;
 body:=replace(body,anchor,$a$and n.inbox_visibility=coalesce(r->>'visibility','inbox') $a$||anchor);
 anchor:=$a$'email_job',private.transactional_email_status(n.id),'work',n.work) order by$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox visibility DTO anchor drift';end if;
 execute replace(body,anchor,$a$'email_job',private.transactional_email_status(n.id),'work',n.work)
   ||case when r?'visibility' then jsonb_build_object('visibility',n.inbox_visibility) else '{}'::jsonb end order by$a$);

 body:=pg_get_functiondef('private.notification_selection_read_set(jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$set read_at=case when (r->>'read')::bool then coalesce(read_at,statement_timestamp()) else null end,version=version+1$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox visibility write anchor drift';end if;
 body:=replace(body,anchor,$a$set read_at=case when r?'visibility' then read_at when (r->>'read')::bool then coalesce(read_at,statement_timestamp()) else null end,
  inbox_visibility=coalesce(r->>'visibility',inbox_visibility),version=version+1$a$);
 anchor:=$a$jsonb_build_object('read',r->'read','notifications',changes)$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox visibility audit anchor drift';end if;
 execute replace(body,anchor,$a$jsonb_strip_nulls(jsonb_build_object('read',r->'read','visibility',r->'visibility','notifications',changes))$a$);

 body:=pg_get_functiondef('private.notification_read_set(jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:='and n.read_at is null and n.created_at<=stamp';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Inbox mark-all visibility anchor drift';end if;
 execute replace(body,anchor,$a$and n.inbox_visibility='inbox' $a$||anchor);
end$patch$;

commit;
