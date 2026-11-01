-- Apply only after this source's development delivery and explicit Vault/tenant configuration.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$begin
 if not exists(select 1 from private.invitation_dispatch_config c join vault.decrypted_secrets a on a.id=c.anon_secret_id join vault.decrypted_secrets s on s.id=c.signing_secret_id where c.singleton)
 or not exists(select 1 from private.invitation_sender_config c join vault.decrypted_secrets s on s.id=c.resend_secret_id where c.enabled) then raise exception 'INVITATION_CONFIGURATION_REQUIRED';end if;
end$$;
grant usage on schema cron to ftk_ops_invitation;
grant ftk_ops_invitation to postgres;
set local role ftk_ops_invitation;
select cron.schedule('ftksaas-invitations','30 seconds',$$select private.invitation_dispatch()$$);
reset role;
revoke ftk_ops_invitation from postgres;
revoke usage on schema cron from ftk_ops_invitation;
update private.invitation_dispatch_config set enabled=true where singleton;
commit;
