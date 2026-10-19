begin;
-- Existing command and scoped worker entrypoints retain their grants/signatures.
-- No user/database worker role receives additional schema or table access.
commit;
