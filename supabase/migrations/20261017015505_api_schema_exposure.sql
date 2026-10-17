-- Match local API configuration in hosted development: service-only RPC schema.
begin;
alter role authenticator set pgrst.db_schemas = 'api_v1';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
