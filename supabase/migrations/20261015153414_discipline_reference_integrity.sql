begin;
alter table core.classes add constraint classes_scoped_identity unique(org_id,center_id,discipline_id,id);
alter table core.sessions add constraint session_class_discipline foreign key(org_id,center_id,discipline_id,class_id)
 references core.classes(org_id,center_id,discipline_id,id) deferrable initially deferred;
alter table core.program_versions add constraint program_class_identity unique(org_id,center_id,class_id,id);
alter table core.sessions add constraint session_program_class foreign key(org_id,center_id,class_id,program_id)
 references core.program_versions(org_id,center_id,class_id,id) deferrable initially deferred;
alter table core.sessions add constraint program_requires_class check(program_id is null or class_id is not null);
commit;
