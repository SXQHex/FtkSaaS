begin;
-- Nested FK actions (users -> sessions -> refresh_tokens) may still be queued
-- during a regular AFTER users trigger. Verify absence at transaction end,
-- after every cascade, while preserving atomic failure/rollback of native DELETE.
drop trigger zzz_ftk_account_native_delete_proof on auth.users;
create constraint trigger zzz_ftk_account_native_delete_proof
 after delete on auth.users deferrable initially deferred
 for each row execute function private.account_native_delete_proof();
commit;
