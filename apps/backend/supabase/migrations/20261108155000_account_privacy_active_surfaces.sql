begin;
-- Native Auth retired these application intent tables in 20261031074421.
-- Preserve the previous migration; narrow the installed erasure function to
-- surviving application surfaces without recreating retired Auth adapters.
do $patch$
declare body text;old text;
begin
 if to_regclass('private.account_google_link_intents') is not null
  or to_regclass('private.account_totp_removal_intents') is not null then
  raise exception 'Retired native Auth intent tables unexpectedly exist';
 end if;
 body:=pg_get_functiondef('private.account_profile_erasure(uuid)'::regprocedure);
 foreach old in array array[
  '  select ''account_google_link_intents'',account_id from private.account_google_link_intents where account_id=a.id union all'||E'\n',
  '  select ''account_totp_removal_intents'',factor_id from private.account_totp_removal_intents where account_id=a.id union all'||E'\n',
  ',''account_google_link_intents'',''account_totp_removal_intents'''
 ] loop
  if array_length(string_to_array(body,old),1)<>2 then raise exception 'Active privacy surface anchor mismatch';end if;
  body:=replace(body,old,'');
 end loop;
 execute body;
end$patch$;
commit;
