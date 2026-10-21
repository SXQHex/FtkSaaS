-- P03 physical integrity and runtime error corrections; prior migrations stay frozen.
begin;
alter table core.student_credit_movements drop constraint student_credit_movements_kind_check;
alter table core.student_credit_movements add constraint student_credit_movements_kind_check
 check(kind in ('surplus_add','refund_claim_add','offset_subtract','refund_subtract','reverse','correction_subtract'));
commit;
