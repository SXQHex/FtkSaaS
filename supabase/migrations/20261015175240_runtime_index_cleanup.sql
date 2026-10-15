-- Keep the existing accounts.auth_user_id unique constraint; remove its duplicate index.
begin;
drop index core.runtime_active_account_auth;
commit;
