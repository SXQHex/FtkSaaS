begin;
do $patch$
declare body text:=pg_get_functiondef('private.tracking_operation_module(text)'::regprocedure);
 anchor text:='"attendance_correct_preview_v1":"M05"';
begin
 if array_length(string_to_array(body,anchor),1)<>2 then
  raise exception 'Attendance audit module mapping drift';
 end if;
 execute replace(body,anchor,anchor||',"attendance_correction_request_v1":"M05"');
end$patch$;
commit;
