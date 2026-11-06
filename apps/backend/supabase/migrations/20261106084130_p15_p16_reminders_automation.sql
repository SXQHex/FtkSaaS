begin;
create or replace function private.frontend_settings_fields() returns jsonb language sql immutable security invoker set search_path='' as $fields$select '[{"scope":"user","key":"honorific","schema":{"type":"string","maxLength":100},"default":"","group":"S01","consumer":"frontend"},{"scope":"user","key":"language","schema":{"type":"string","enum":["auto","tr","en"]},"default":"auto","group":"S07","consumer":"frontend"},{"scope":"user","key":"date_format","schema":{"type":"string","enum":["dd.MM.yyyy"]},"default":"dd.MM.yyyy","group":"S07","consumer":"frontend"},{"scope":"user","key":"time_format","schema":{"type":"string","enum":["12","24"]},"default":"24","group":"S07","consumer":"frontend"},{"scope":"user","key":"number_format","schema":{"type":"string","enum":["tr-TR","en-US"]},"default":"tr-TR","group":"S07","consumer":"frontend"},{"scope":"user","key":"week_start","schema":{"type":"string","enum":["monday","sunday"]},"default":"monday","group":"S07","consumer":"frontend"},{"scope":"user","key":"timezone_mode","schema":{"type":"string","enum":["auto","manual"]},"default":"auto","group":"S07","consumer":"frontend"},{"scope":"user","key":"theme","schema":{"type":"string","enum":["light","dark","system"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"contrast","schema":{"type":"string","enum":["system","high"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"motion","schema":{"type":"string","enum":["system","reduced"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"remember_context","schema":{"type":"boolean"},"default":true,"group":"S09","consumer":"frontend"},{"scope":"user","key":"calendar_view","schema":{"type":"string","enum":["day","week","month","agenda"]},"default":"week","group":"S10","consumer":"frontend"},{"scope":"user","key":"show_weekends","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"frontend"},{"scope":"user","key":"marketing_in_app","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"frontend"},{"scope":"user","key":"ad_personalization","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"ad_measurement","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"optional_analytics","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"timezone_name","schema":{"anyOf":[{"type":"string","maxLength":100},{"type":"null"}]},"default":null,"group":"S07","consumer":"frontend"},{"scope":"member","key":"profile_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"photo_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"email_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"phone_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"history_recommendations","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"schedule_calendar_preferences"},{"scope":"member","key":"interest_center_ids","schema":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"},"maxItems":100,"uniqueItems":true},"default":[],"group":"S14","consumer":"schedule_calendar_preferences"},{"scope":"member","key":"interest_discipline_ids","schema":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"},"maxItems":100,"uniqueItems":true},"default":[],"group":"S14","consumer":"schedule_calendar_preferences"},{"scope":"member","key":"in_app_reminders","schema":{"type":"boolean"},"default":true,"group":"S12","consumer":"p05_optional_allowed"},{"scope":"member","key":"in_app_marketing","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"p05_optional_allowed"},{"scope":"center","key":"description","schema":{"type":"string","maxLength":3000},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"address","schema":{"type":"string","maxLength":1000},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"contact_phone","schema":{"type":"string","maxLength":100},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"contact_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"M01","consumer":"frontend"},{"scope":"organization","key":"description","schema":{"type":"string","maxLength":3000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"address","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"contact_phone","schema":{"type":"string","maxLength":100},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"contact_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"theme_package_id","schema":{"type":"null"},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"font_package_id","schema":{"type":"null"},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_name","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_address","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"platform","key":"application_name","schema":{"type":"string","minLength":1,"maxLength":100},"default":"FtkSaaS","group":"P01","consumer":"frontend"},{"scope":"platform","key":"support_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"P01","consumer":"frontend"},{"scope":"platform","key":"support_url","schema":{"anyOf":[{"type":"string","format":"uri","pattern":"^https://","maxLength":2000},{"type":"null"}]},"default":null,"group":"P01","consumer":"frontend"},{"scope":"platform","key":"maintenance_message","schema":{"type":"string","maxLength":3000},"default":"","group":"P01","consumer":"frontend"},{"scope":"user","key":"font_scale","schema":{"anyOf":[{"type":"number","minimum":0.75,"maximum":2},{"type":"null"}]},"default":null,"group":"S08","consumer":"frontend"},{"scope":"user","key":"startup_context","schema":{"anyOf":[{"type":"object","properties":{"org_id":{"$ref":"#/$defs/FtkUuid"},"center_id":{"anyOf":[{"$ref":"#/$defs/FtkUuid"},{"type":"null"}]},"discipline_id":{"anyOf":[{"$ref":"#/$defs/FtkUuid"},{"type":"null"}]}},"required":["org_id","center_id","discipline_id"],"additionalProperties":false},{"type":"null"}]},"default":null,"group":"S09","consumer":"frontend"},{"scope":"organization","key":"program_duration_minutes","schema":{"type":"integer","minimum":1,"maximum":2147483647},"default":60,"group":"O18","consumer":"new_center_copy"},{"scope":"center","key":"program_duration_minutes","schema":{"type":"integer","minimum":1,"maximum":2147483647},"default":60,"group":"M06","consumer":"schedule_build_program"},{"scope":"member","key":"report_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"report":{"type":"string","enum":["collections_debts","lesson_attendance"]},"filters":{"type":"object","properties":{"interval":{"type":"object","properties":{"starts_at":{"type":"string","format":"date-time"},"ends_at":{"type":"string","format":"date-time"}},"required":["starts_at","ends_at"],"additionalProperties":false,"x-invariant":"starts_at < ends_at; [start,end)"},"center_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"person_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"currency":{"anyOf":[{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},{"type":"null"}]},"state":{"anyOf":[{"type":"string"},{"type":"null"}]}},"required":["interval","center_ids"],"additionalProperties":false},"columns":{"type":"array","items":{"type":"string","enum":["group_key","center_id","person_id","currency","count","amount_minor","credits","ratio_bps","basis_count","subscriber_number"]},"minItems":1,"maxItems":10,"uniqueItems":true},"report_order":{"type":"string","enum":["group_key_asc","group_key_desc"]},"group_by":{"type":"string","enum":["person","center","total"]}},"required":["key","name","report","filters","columns","report_order","group_by"],"additionalProperties":false}},"default":[],"group":"S10","consumer":"p06_report_prepare"},{"scope":"member","key":"import_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"center_id":{"$ref":"#/$defs/FtkUuid"},"mapping":{"type":"object","properties":{"columns":{"type":"array","items":{"type":"object","properties":{"source_column":{"type":"string"},"target":{"type":"string","enum":["display_name","email","phone","source_key","person_ref","opening_credits","opening_debt_minor","currency","product_version_ref","start_date","end_date","opening_credit_value_minor"]}},"required":["source_column","target"],"additionalProperties":false}},"delimiter":{"type":"string","enum":[",",";"]}},"required":["columns","delimiter"],"additionalProperties":false,"x-invariant":"unique targets except contacts, permanent source_key required; existing person only explicit person_ref, never email auto merge"},"source_namespace":{"type":"string"}},"required":["key","name","center_id","mapping","source_namespace"],"additionalProperties":false}},"default":[],"group":"S10","consumer":"p06_import_prepare"},{"scope":"center","key":"report_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"report":{"type":"string","enum":["collections_debts","lesson_attendance"]},"filters":{"type":"object","properties":{"interval":{"type":"object","properties":{"starts_at":{"type":"string","format":"date-time"},"ends_at":{"type":"string","format":"date-time"}},"required":["starts_at","ends_at"],"additionalProperties":false,"x-invariant":"starts_at < ends_at; [start,end)"},"center_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"person_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"currency":{"anyOf":[{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},{"type":"null"}]},"state":{"anyOf":[{"type":"string"},{"type":"null"}]}},"required":["interval","center_ids"],"additionalProperties":false},"columns":{"type":"array","items":{"type":"string","enum":["group_key","center_id","person_id","currency","count","amount_minor","credits","ratio_bps","basis_count","subscriber_number"]},"minItems":1,"maxItems":10,"uniqueItems":true},"report_order":{"type":"string","enum":["group_key_asc","group_key_desc"]},"group_by":{"type":"string","enum":["person","center","total"]}},"required":["key","name","report","filters","columns","report_order","group_by"],"additionalProperties":false}},"default":[],"group":"M18","consumer":"p06_report_prepare"},{"scope":"center","key":"import_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"center_id":{"$ref":"#/$defs/FtkUuid"},"mapping":{"type":"object","properties":{"columns":{"type":"array","items":{"type":"object","properties":{"source_column":{"type":"string"},"target":{"type":"string","enum":["display_name","email","phone","source_key","person_ref","opening_credits","opening_debt_minor","currency","product_version_ref","start_date","end_date","opening_credit_value_minor"]}},"required":["source_column","target"],"additionalProperties":false}},"delimiter":{"type":"string","enum":[",",";"]}},"required":["columns","delimiter"],"additionalProperties":false,"x-invariant":"unique targets except contacts, permanent source_key required; existing person only explicit person_ref, never email auto merge"},"source_namespace":{"type":"string"}},"required":["key","name","center_id","mapping","source_namespace"],"additionalProperties":false}},"default":[],"group":"M19","consumer":"p06_import_prepare"},{"scope":"organization","key":"report_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"report":{"type":"string","enum":["collections_debts","lesson_attendance"]},"filters":{"type":"object","properties":{"interval":{"type":"object","properties":{"starts_at":{"type":"string","format":"date-time"},"ends_at":{"type":"string","format":"date-time"}},"required":["starts_at","ends_at"],"additionalProperties":false,"x-invariant":"starts_at < ends_at; [start,end)"},"center_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"person_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"currency":{"anyOf":[{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},{"type":"null"}]},"state":{"anyOf":[{"type":"string"},{"type":"null"}]}},"required":["interval","center_ids"],"additionalProperties":false},"columns":{"type":"array","items":{"type":"string","enum":["group_key","center_id","person_id","currency","count","amount_minor","credits","ratio_bps","basis_count","subscriber_number"]},"minItems":1,"maxItems":10,"uniqueItems":true},"report_order":{"type":"string","enum":["group_key_asc","group_key_desc"]},"group_by":{"type":"string","enum":["person","center","total"]}},"required":["key","name","report","filters","columns","report_order","group_by"],"additionalProperties":false}},"default":[],"group":"O14","consumer":"p06_report_prepare"},{"scope":"organization","key":"import_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"center_id":{"$ref":"#/$defs/FtkUuid"},"mapping":{"type":"object","properties":{"columns":{"type":"array","items":{"type":"object","properties":{"source_column":{"type":"string"},"target":{"type":"string","enum":["display_name","email","phone","source_key","person_ref","opening_credits","opening_debt_minor","currency","product_version_ref","start_date","end_date","opening_credit_value_minor"]}},"required":["source_column","target"],"additionalProperties":false}},"delimiter":{"type":"string","enum":[",",";"]}},"required":["columns","delimiter"],"additionalProperties":false,"x-invariant":"unique targets except contacts, permanent source_key required; existing person only explicit person_ref, never email auto merge"},"source_namespace":{"type":"string"}},"required":["key","name","center_id","mapping","source_namespace"],"additionalProperties":false}},"default":[],"group":"O14","consumer":"p06_import_prepare"},{"scope":"organization","key":"public_profile_enabled","schema":{"type":"boolean"},"default":false,"group":"O01","consumer":"public_profile"},{"scope":"organization","key":"public_fields","schema":{"type":"array","items":{"type":"string","enum":["name","description","logo","address","contact","hours"]},"uniqueItems":true,"maxItems":6},"default":[],"group":"O01","consumer":"public_profile"},{"scope":"organization","key":"public_hours","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"weekdays":{"type":"array","items":{"type":"integer","minimum":1,"maximum":7},"minItems":1,"maxItems":7,"uniqueItems":true},"local_start":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"local_end":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"timezone":{"type":"string","minLength":1,"maxLength":100}},"required":["weekdays","local_start","local_end","timezone"],"additionalProperties":false}},"default":[],"group":"O01","consumer":"public_profile"},{"scope":"center","key":"public_profile_enabled","schema":{"type":"boolean"},"default":false,"group":"M16","consumer":"public_profile"},{"scope":"center","key":"public_fields","schema":{"type":"array","items":{"type":"string","enum":["name","description","logo","address","contact","hours"]},"uniqueItems":true,"maxItems":6},"default":[],"group":"M16","consumer":"public_profile"},{"scope":"center","key":"public_hours","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"weekdays":{"type":"array","items":{"type":"integer","minimum":1,"maximum":7},"minItems":1,"maxItems":7,"uniqueItems":true},"local_start":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"local_end":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"timezone":{"type":"string","minLength":1,"maxLength":100}},"required":["weekdays","local_start","local_end","timezone"],"additionalProperties":false}},"default":[],"group":"M16","consumer":"public_profile"},{"scope":"organization","key":"availability_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"rules":{"type":"array","items":{"type":"object","properties":{"weekdays":{"type":"array","items":{"type":"integer","minimum":1,"maximum":7},"uniqueItems":true,"minItems":1},"local_start":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"local_end":{"type":"string","pattern":"^(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]|24:00:00)$"},"valid_from":{"type":"string","format":"date"},"valid_until":{"anyOf":[{"type":"string","format":"date"},{"type":"null"}]}},"required":["weekdays","local_start","local_end","valid_from"],"additionalProperties":false,"x-invariant":"local_start < local_end; overnight explicitly split at 24:00:00 / next-day 00:00:00; adjacent rules jointly cover actual UTC interval; absent or ambiguous weekly boundaries are not silently shifted"},"minItems":1,"maxItems":100}},"required":["key","name","rules"],"additionalProperties":false}},"default":[],"group":"O02","consumer":"domain_preparation_resolve"},{"scope":"organization","key":"package_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"discipline_id":{"$ref":"#/$defs/FtkUuid"},"terms":{"type":"object","properties":{"name":{"type":"string"},"kind":{"type":"string","enum":["credits","timed"]},"booking_mode":{"type":"string","enum":["priority","flexible"]},"credits":{"anyOf":[{"type":"integer","minimum":1,"maximum":2147483647},{"type":"null"}]},"price_minor":{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},"currency":{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},"freeze":{"type":"object","properties":{"enabled":{"type":"boolean","enum":[false]},"extends_validity":{"type":"boolean"},"max_days":{"anyOf":[{"type":"integer","minimum":1},{"type":"null"}]}},"required":["enabled","extends_validity"],"additionalProperties":false},"refund":{"type":"object","properties":{"method":{"type":"string","enum":["none","credit_ratio","used_at_unit_price","time_ratio"]},"used_unit_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]}},"required":["method"],"additionalProperties":false,"x-invariant":"used_at_unit_price needs used_unit_minor; net actual sale basis; time_ratio uses paid local days"},"quota":{"anyOf":[{"type":"object","properties":{"period":{"enum":["week","month"],"type":"string"},"limit":{"type":"integer","minimum":1,"maximum":9007199254740991}},"required":["period","limit"],"additionalProperties":false},{"type":"null"}]}},"required":["booking_mode","credits","currency","freeze","kind","name","price_minor","quota","refund"],"additionalProperties":false},"start_date":{"type":"string","format":"date"},"end_date":{"type":"string","format":"date"}},"required":["key","name","discipline_id","terms","start_date","end_date"],"additionalProperties":false}},"default":[],"group":"O06","consumer":"domain_preparation_resolve"},{"scope":"center","key":"availability_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"rules":{"type":"array","items":{"type":"object","properties":{"weekdays":{"type":"array","items":{"type":"integer","minimum":1,"maximum":7},"uniqueItems":true,"minItems":1},"local_start":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"local_end":{"type":"string","pattern":"^(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]|24:00:00)$"},"valid_from":{"type":"string","format":"date"},"valid_until":{"anyOf":[{"type":"string","format":"date"},{"type":"null"}]}},"required":["weekdays","local_start","local_end","valid_from"],"additionalProperties":false,"x-invariant":"local_start < local_end; overnight explicitly split at 24:00:00 / next-day 00:00:00; adjacent rules jointly cover actual UTC interval; absent or ambiguous weekly boundaries are not silently shifted"},"minItems":1,"maxItems":100}},"required":["key","name","rules"],"additionalProperties":false}},"default":[],"group":"M02","consumer":"domain_preparation_resolve"},{"scope":"center","key":"package_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"discipline_id":{"$ref":"#/$defs/FtkUuid"},"terms":{"type":"object","properties":{"name":{"type":"string"},"kind":{"type":"string","enum":["credits","timed"]},"booking_mode":{"type":"string","enum":["priority","flexible"]},"credits":{"anyOf":[{"type":"integer","minimum":1,"maximum":2147483647},{"type":"null"}]},"price_minor":{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},"currency":{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},"freeze":{"type":"object","properties":{"enabled":{"type":"boolean","enum":[false]},"extends_validity":{"type":"boolean"},"max_days":{"anyOf":[{"type":"integer","minimum":1},{"type":"null"}]}},"required":["enabled","extends_validity"],"additionalProperties":false},"refund":{"type":"object","properties":{"method":{"type":"string","enum":["none","credit_ratio","used_at_unit_price","time_ratio"]},"used_unit_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]}},"required":["method"],"additionalProperties":false,"x-invariant":"used_at_unit_price needs used_unit_minor; net actual sale basis; time_ratio uses paid local days"},"quota":{"anyOf":[{"type":"object","properties":{"period":{"enum":["week","month"],"type":"string"},"limit":{"type":"integer","minimum":1,"maximum":9007199254740991}},"required":["period","limit"],"additionalProperties":false},{"type":"null"}]}},"required":["booking_mode","credits","currency","freeze","kind","name","price_minor","quota","refund"],"additionalProperties":false},"start_date":{"type":"string","format":"date"},"end_date":{"type":"string","format":"date"}},"required":["key","name","discipline_id","terms","start_date","end_date"],"additionalProperties":false}},"default":[],"group":"M07","consumer":"domain_preparation_resolve"},{"scope":"organization","key":"primary_color","schema":{"anyOf":[{"type":"string","pattern":"^#[0-9A-Fa-f]{6}$","minLength":7,"maxLength":7},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"secondary_color","schema":{"anyOf":[{"type":"string","pattern":"^#[0-9A-Fa-f]{6}$","minLength":7,"maxLength":7},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"accent_color","schema":{"anyOf":[{"type":"string","pattern":"^#[0-9A-Fa-f]{6}$","minLength":7,"maxLength":7},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"lesson_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"organization","key":"lesson_reminder_hours","schema":{"type":"integer","enum":[1,3,24]},"default":24,"group":"S10","consumer":"reminder_settings"},{"scope":"organization","key":"package_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"organization","key":"package_reminder_days","schema":{"type":"integer","enum":[3,7,14]},"default":7,"group":"S10","consumer":"reminder_settings"},{"scope":"organization","key":"payment_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"organization","key":"payment_reminder_days","schema":{"type":"integer","enum":[1,3,7]},"default":3,"group":"S10","consumer":"reminder_settings"},{"scope":"center","key":"lesson_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"center","key":"lesson_reminder_hours","schema":{"type":"integer","enum":[1,3,24]},"default":24,"group":"S10","consumer":"reminder_settings"},{"scope":"center","key":"package_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"center","key":"package_reminder_days","schema":{"type":"integer","enum":[3,7,14]},"default":7,"group":"S10","consumer":"reminder_settings"},{"scope":"center","key":"payment_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"center","key":"payment_reminder_days","schema":{"type":"integer","enum":[1,3,7]},"default":3,"group":"S10","consumer":"reminder_settings"},{"scope":"organization","key":"reminder_center_overrides_enabled","schema":{"type":"boolean"},"default":false,"group":"S10","consumer":"reminder_settings"},{"scope":"member","key":"lesson_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"member","key":"package_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"member","key":"payment_reminders_enabled","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"reminder_settings"},{"scope":"user","key":"quiet_hours_enabled","schema":{"type":"boolean"},"default":false,"group":"S10","consumer":"reminder_quiet_until"},{"scope":"user","key":"quiet_hours_weekdays","schema":{"type":"array","items":{"type":"integer","minimum":1,"maximum":7},"maxItems":7,"uniqueItems":true},"default":[],"group":"S10","consumer":"reminder_quiet_until"},{"scope":"user","key":"quiet_hours_start","schema":{"anyOf":[{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},{"type":"null"}]},"default":null,"group":"S10","consumer":"reminder_quiet_until"},{"scope":"user","key":"quiet_hours_end","schema":{"anyOf":[{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},{"type":"null"}]},"default":null,"group":"S10","consumer":"reminder_quiet_until"}]'::jsonb$fields$;
commit;
begin;
create function private.reminder_licensed(org uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(private.current_plan_name(org),'') not in ('pro','business') then return false;end if;
 perform private.require_feature(org,'F27');return true;
exception when sqlstate 'P0001' then if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','POLICY_NOT_CONFIGURED') then return false;end if;raise;
end$$;
-- Migration compatibility uses source time even when the recipient is opted
-- out. Eligibility must never erase dedupe evidence for an already-sent event.
create function private.reminder_source_generation(org uuid,kind text,target uuid) returns text language sql stable security invoker set search_path='' as $$
 select extract(epoch from expires_at)::text from (
  select s.starts_at expires_at from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where $2='lesson' and r.org_id=$1 and r.id=$3
  union all select s.valid_until from core.sales s where $2='entitlement' and s.org_id=$1 and s.id=$3
  union all select e.starts_at from core.event_registrations r join core.events e on e.org_id=r.org_id and e.id=r.event_id where $2='event' and r.org_id=$1 and r.id=$3
  union all select d.due_at from core.debts d where $2='payment' and d.org_id=$1 and d.id=$3
 ) source
$$;
-- Only reminder email observes this window. ISO weekdays name the day on which
-- an interval starts; PostgreSQL resolves DST gaps/folds using the IANA zone.
create function private.reminder_quiet_until(settings jsonb,at_time timestamptz) returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare tz text:=settings->>'timezone_name';local_time timestamp;day date;start_time time;end_time time;finish timestamptz;
begin
 if coalesce((settings->>'quiet_hours_enabled')::bool,false)=false then return at_time;end if;
 if tz is null or not exists(select 1 from pg_timezone_names where name=tz) then return null;end if;
 start_time:=(settings->>'quiet_hours_start')::time;end_time:=(settings->>'quiet_hours_end')::time;
 if start_time is null or end_time is null or start_time=end_time or coalesce(jsonb_array_length(settings->'quiet_hours_weekdays'),0)=0 then return null;end if;
 local_time:=at_time at time zone tz;
 for day in select (local_time::date-i)::date from generate_series(0,1) i loop
  if not coalesce(settings->'quiet_hours_weekdays' @> to_jsonb(array[extract(isodow from day)::int]),false) then continue;end if;
  finish:=(day+end_time+case when end_time<start_time then interval '1 day' else interval '0' end) at time zone tz;
  if at_time>=(day+start_time) at time zone tz and at_time<finish then
   return greatest(at_time,finish);
  end if;
 end loop;
 return at_time;
end$$;
create function private.reminder_settings(org uuid,center uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with template as(select private.frontend_settings_defaults('organization')||coalesce((select values from private.frontend_settings where scope_key='organization:'||$1),'{}') v)
 select v||case when private.current_plan_name($1)='business' and (v->>'reminder_center_overrides_enabled')::bool then
 coalesce((select jsonb_object_agg(key,value) from private.frontend_settings s cross join lateral jsonb_each(s.values) where s.scope_key='center:'||$1||':'||$2 and key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days')),'{}') else '{}'::jsonb end from template
$$;
create function private.reminder_member_allowed(org uuid,person uuid,kind text) returns boolean language sql stable security invoker set search_path='' as $$
 select private.p05_optional_allowed($1,$2,'reminder') and coalesce((select (s.values->>(case $3 when 'lesson' then 'lesson_reminders_enabled' when 'event' then 'lesson_reminders_enabled' when 'entitlement' then 'package_reminders_enabled' when 'payment' then 'payment_reminders_enabled' end))::bool from core.account_links l join private.frontend_settings s on s.scope_key='member:'||$1||':'||l.account_id where l.org_id=$1 and l.person_id=$2 and l.state='active' and l.verified_at is not null order by l.created_at,l.id limit 1),true)
$$;
-- A closed source projection is shared by scheduling, execution and email
-- authorization. All calendar-day offsets use the source center's time zone.
create function private.reminder_context(org uuid,center uuid,person uuid,kind text,target uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg jsonb:=private.reminder_settings(org,center);tz text;expires timestamptz;due timestamptz;ver text;subject text;title text;enabled bool;
begin
 if not private.center_accessible(org,center) or not private.reminder_member_allowed(org,person,kind) then return null;end if;
 select timezone into tz from core.centers where org_id=org and id=center and state='active';if tz is null then return null;end if;
 if kind='lesson' then
  select s.starts_at,r.version::text||':'||s.version::text into expires,ver from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=person and r.id=target and r.state='active' and s.state='planned' and s.actual_started_at is null;
  subject:='reservations';title:='Ders hatırlatması';enabled:=(cfg->>'lesson_reminders_enabled')::bool;due:=expires-make_interval(hours=>(cfg->>'lesson_reminder_hours')::int);
 elsif kind='event' then
  begin perform private.require_feature(org,'F29');exception when sqlstate 'P0001' then if sqlerrm='PLAN_FEATURE_UNAVAILABLE' then return null;end if;raise;end;
  select e.starts_at,r.version::text||':'||e.version::text into expires,ver from core.event_registrations r join core.events e on e.org_id=r.org_id and e.id=r.event_id where r.org_id=org and r.center_id=center and r.person_id=person and r.id=target and r.state='active' and e.state='published' and e.actual_started_at is null;
  subject:='event_registrations';title:='Etkinlik hatırlatması';enabled:=(cfg->>'lesson_reminders_enabled')::bool;due:=expires-make_interval(hours=>(cfg->>'lesson_reminder_hours')::int);
 elsif kind='entitlement' then
  select s.valid_until,s.version::text into expires,ver from core.sales s where s.org_id=org and s.center_id=center and s.person_id=person and s.id=target and s.state='active' and not exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=s.id and n.state='active');
  subject:='sales';title:='Paket bitişi hatırlatması';enabled:=(cfg->>'package_reminders_enabled')::bool;due:=((expires at time zone tz)-make_interval(days=>(cfg->>'package_reminder_days')::int)) at time zone tz;
 elsif kind='payment' then
  select d.due_at,d.version::text into expires,ver from core.debts d where d.org_id=org and d.center_id=center and d.person_id=person and d.id=target and d.state='open' and private.debt_remaining(org,d.id)>0;
  subject:='debts';title:='Ödeme vadesi hatırlatması';enabled:=(cfg->>'payment_reminders_enabled')::bool;due:=((expires at time zone tz)-make_interval(days=>(cfg->>'payment_reminder_days')::int)) at time zone tz;
 else return null;end if;
 if not coalesce(enabled,false) or expires is null or expires<=clock_timestamp() or not private.p07_due_allowed(org,due) then return null;end if;
 ver:=extract(epoch from expires)::text;
 return jsonb_build_object('center_id',center,'version',1,'source_version',ver,'due_at',due,'expires_at',expires,'title',title,'subject_type',subject,'kind',kind,'target_id',target);
end$$;
create function private.reminder_settings_validate(r jsonb,v jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if r->>'scope'='user' and v->>'quiet_hours_enabled'='true' and (v->>'quiet_hours_start' is null or v->>'quiet_hours_end' is null or v->>'quiet_hours_start'=v->>'quiet_hours_end' or coalesce(jsonb_array_length(v->'quiet_hours_weekdays'),0)=0 or v->>'timezone_name' is null or not exists(select 1 from pg_timezone_names where name=v->>'timezone_name')) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.reminder_field_writable(scope text,key text,org uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select case when $2 not in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days','reminder_center_overrides_enabled') then true
 when not private.reminder_licensed($3) then false
 when $1='center' then private.current_plan_name($3)='business' and coalesce((select (values->>'reminder_center_overrides_enabled')::bool from private.frontend_settings where scope_key='organization:'||$3),false)
 else true end
$$;
create table private.reminder_reset_versions(preview_id uuid primary key references private.frontend_settings_previews(id),org_id uuid not null references core.organizations(id),organization_version bigint not null);
alter table private.reminder_reset_versions enable row level security;
revoke all on private.reminder_reset_versions from public,anon,authenticated;
grant select,insert on private.reminder_reset_versions to service_role;
create function private.reminder_reset_defaults(r jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.frontend_settings_defaults($1->>'scope')||case when $1->>'scope'='center' then
 coalesce((select jsonb_object_agg(key,value) from jsonb_each(private.frontend_settings_defaults('organization')||coalesce((select values from private.frontend_settings where scope_key='organization:'||($1->>'org_id')::uuid),'{}')) where key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days')),'{}') else '{}'::jsonb end
$$;
-- Settings stay on the existing versioned update/reset/history surface.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 a:='  if scope=''organization'' and key like ''billing_%''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder field authority anchor drift';end if;
 execute replace(b,a,$a$  if key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days','reminder_center_overrides_enabled') and scope in ('organization','center','member') then
   perform private.require_feature(org,'F27');
   if private.current_plan_name(org) not in ('pro','business') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
   if scope='center' and (private.current_plan_name(org)<>'business' or not coalesce((select (values->>'reminder_center_overrides_enabled')::bool from private.frontend_settings where scope_key='organization:'||org),false)) then perform private.fail('FORBIDDEN');end if;
  end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='perform private.frontend_settings_patch(r,patch,person);';
 if strpos(b,a)=0 then raise exception 'Quiet effective validation anchor drift';end if;
 execute replace(b,a,a||'perform private.reminder_settings_validate(r,before||patch);');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='private.frontend_settings_defaults(r->>''scope'')->field';
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Reminder inherited reset default drift';end if;
 b:=replace(b,a,'private.reminder_reset_defaults(r)->field');
 a:='  return jsonb_build_object(''id'',pid,''token'',token,';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder reset parent snapshot drift';end if;
 b:=replace(b,a,$a$  if r->>'scope'='center' and exists(select 1 from jsonb_array_elements_text(keys) k where k like '%reminder%') then
   insert into private.reminder_reset_versions values(pid,org,coalesce((select version from private.frontend_settings where scope_key='organization:'||org),0));
  end if;
$a$||a);
 a:='  keys:=p.fields;patch:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder reset parent validation drift';end if;
 b:=replace(b,a,$a$  if exists(select 1 from private.reminder_reset_versions z where z.preview_id=p.id and z.organization_version<>coalesce((select version from private.frontend_settings where scope_key='organization:'||org),0)) then perform private.fail('PREVIEW_STALE');end if;
$a$||a);execute b;
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:='ver:=coalesce(doc.version,0);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder settings inheritance view drift';end if;
 execute replace(b,a,a||$a$
 if r->>'scope'='center' then
  if not private.reminder_field_writable('center','lesson_reminder_hours',org) then doc.values:=doc.values-array['lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days'];end if;
  values:=values||(select jsonb_object_agg(key,value) from jsonb_each(private.reminder_settings(org,(r->>'center_id')::uuid)) where key in ('lesson_reminders_enabled','lesson_reminder_hours','package_reminders_enabled','package_reminder_days','payment_reminders_enabled','payment_reminder_days'));
 end if;
$a$);
 b:=pg_get_functiondef('private.notification_delivery_support(uuid)'::regprocedure);
 b:=replace(b,'''timing_controls_available'',false','''timing_controls_available'',reminders');
 b:=replace(b,'''quiet_hours'',jsonb_build_object(''controls_available'',false','''quiet_hours'',jsonb_build_object(''controls_available'',org is null or reminders');execute b;
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''writable'',(';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder writable descriptor drift';end if;
 b:=replace(b,a,'''writable'',private.reminder_field_writable(r->>''scope'',f->>''key'',org) and (');
 a:='''catalog_version'',10';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder catalog version drift';end if;execute replace(b,a,'''catalog_version'',11');
end$patch$;
revoke all on function private.reminder_licensed(uuid),private.reminder_source_generation(uuid,text,uuid),private.reminder_reset_defaults(jsonb),private.reminder_field_writable(text,text,uuid),private.reminder_settings_validate(jsonb,jsonb),private.reminder_quiet_until(jsonb,timestamptz),private.reminder_settings(uuid,uuid),private.reminder_member_allowed(uuid,uuid,text),private.reminder_context(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.reminder_licensed(uuid),private.reminder_source_generation(uuid,text,uuid),private.reminder_reset_defaults(jsonb),private.reminder_field_writable(text,text,uuid),private.reminder_settings_validate(jsonb,jsonb),private.reminder_quiet_until(jsonb,timestamptz),private.reminder_settings(uuid,uuid),private.reminder_member_allowed(uuid,uuid,text),private.reminder_context(uuid,uuid,uuid,text,uuid) to service_role;
commit;
begin;
alter table private.p05_jobs add column reminder_source_version text;
alter table private.p05_jobs add column safe_error_code text;
create function private.reminder_jobs_seed(org uuid,ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare item record;ctx jsonb;idx int:=1;jid uuid;fingerprint text;
begin
 if not private.reminder_licensed(org) then return;end if;
 for item in
  select q.* from (
   select id,center_id,person_id,'lesson'::text kind from core.reservations where org_id=org and state='active'
   union all select id,center_id,person_id,'entitlement' from core.sales where org_id=org and state='active'
   union all select id,center_id,person_id,'event' from core.event_registrations where org_id=org and state='active'
   union all select id,center_id,person_id,'payment' from core.debts where org_id=org and state='open'
  ) q cross join lateral(select private.reminder_context(org,q.center_id,q.person_id,q.kind,q.id) context) live
  where live.context is not null and (live.context->>'due_at')::timestamptz<=clock_timestamp()
  and not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.reminder' and j.dedupe_key='p05.'||q.kind||':'||q.id::text||':'||md5(live.context->>'source_version'))
  order by (live.context->>'expires_at')::timestamptz,q.id limit 200
 loop
  ctx:=private.reminder_context(org,item.center_id,item.person_id,item.kind,item.id);
  if ctx is null or (ctx->>'due_at')::timestamptz>clock_timestamp() then continue;end if;
  fingerprint:='p05.'||item.kind||':'||item.id::text||':'||md5(ctx->>'source_version');
  if exists(select 1 from core.outbox_jobs where org_id=org and kind='p05.reminder' and dedupe_key=fingerprint) then continue;end if;
  jid:=private.new_id(ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.reminder',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
  if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,event_key,reminder_source_version) values(jid,org,'reminder_schedule_v1',item.id,item.center_id,item.person_id,item.kind,ctx->>'source_version');end if;
 end loop;
end$$;
-- Rebind pre-migration generations conservatively, preserving existing success
-- evidence. Future start/expiry changes get a new generation, retries do not.
update private.p05_jobs c set reminder_source_version=private.reminder_source_generation(c.org_id,c.event_key,c.target_id)
 where c.operation='reminder_schedule_v1' and c.reminder_source_version is null;
update core.outbox_jobs j set dedupe_key=dedupe_key||':'||md5(c.reminder_source_version)
 from private.p05_jobs c where c.job_id=j.id and c.operation='reminder_schedule_v1' and c.reminder_source_version is not null and j.dedupe_key='p05.'||c.event_key||':'||c.target_id::text;
-- Keep the mature claim, scope, lease, billing and audit paths. Replace only
-- the former hardcoded reminder seed and source eligibility branch.
do $patch$
declare b text;a text;z text;start_at int;end_at int;
begin
 b:=pg_get_functiondef('private.p05_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 a:=' if exists(select 1 from core.saas_subscriptions';z:=' for cfg in select a.*';start_at:=strpos(b,a);end_at:=strpos(b,z);
 if start_at=0 or end_at<=start_at then raise exception 'Reminder seed branch drift';end if;
 b:=overlay(b placing ' perform private.reminder_jobs_seed(org,ids[301:500]);'||E'\n' from start_at for end_at-start_at);
 a:=' for j in select j.*';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker exhausted lease diagnostic drift';end if;
 b:=replace(b,a,' update private.p05_jobs c set safe_error_code=''TEMPORARY_FAILURE'' from core.outbox_jobs j where j.id=c.job_id and c.org_id=org and j.state=''failed'' and c.safe_error_code is null;'||E'\n'||a);execute b;
 b:=pg_get_functiondef('private.p05_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:='allowed boolean:=true;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder execution context drift';end if;
 b:=replace(b,a,a||'reminder jsonb;');
 a:='   allowed:=private.p05_optional_allowed(org,c.person_id,''reminder'');';z:='  elsif op=''automation_run_v1'' then';start_at:=strpos(b,a);end_at:=strpos(b,z);
 if start_at=0 or end_at<=start_at then raise exception 'Reminder execution branch drift';end if;
 b:=overlay(b placing $a$   reminder:=private.reminder_context(org,c.center_id,c.person_id,c.event_key,c.target_id);
   allowed:=reminder is not null and (c.reminder_source_version is null or reminder->>'source_version'=c.reminder_source_version);
   if allowed and (reminder->>'due_at')::timestamptz>clock_timestamp() then
    update core.outbox_jobs set state='pending',attempts=greatest(attempts-1,0),lease_until=null,next_attempt_at=(reminder->>'due_at')::timestamptz,version=version+1 where id=j.id;
    return jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','pending'),'trace_id',private.new_id(ids,1));
   end if;
   if allowed then
    insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(nid,org,c.person_id,'reminder',c.target_id,jsonb_build_object('template_key','p05.'||c.event_key,'reminder_center_id',c.center_id,'reminder_source_version',reminder->>'source_version','subject',jsonb_build_object('type',reminder->>'subject_type','id',c.target_id)));
    did:=nid;subject:='notifications';
   else did:=j.id;subject:='outbox_jobs';end if;
$a$ from start_at for end_at-start_at);
 a:='when SQLSTATE=''P0001'' then SQLERRM else ''INTEGRITY_VIOLATION''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker safe diagnostic allowlist drift';end if;
 b:=replace(b,a,'when SQLSTATE=''P0001'' and SQLERRM in (''FORBIDDEN'',''NOT_FOUND'',''VALIDATION_FAILED'',''PLAN_FEATURE_UNAVAILABLE'',''PLAN_LIMIT_REACHED'',''POLICY_NOT_CONFIGURED'',''SERVICE_UNAVAILABLE'',''BILLING_OPERATION_RESTRICTED'',''INVALID_STATE_TRANSITION'',''SUBSCRIPTION_NOT_STARTED'') then SQLERRM else ''INTEGRITY_VIOLATION''');
 a:='update private.p05_jobs set result=out_data,';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker success error reset drift';end if;
 b:=replace(b,a,'update private.p05_jobs set safe_error_code=null,result=out_data,');
 a:=' update core.outbox_jobs set state=case when attempts>=3';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker failure diagnostic drift';end if;
 b:=replace(b,a,' update private.p05_jobs set safe_error_code=code where job_id=j.id;'||E'\n'||a);execute b;
end$patch$;
revoke all on function private.reminder_jobs_seed(uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.reminder_jobs_seed(uuid,uuid[]) to service_role;
commit;
begin;
alter table private.transactional_email_jobs add column purpose text not null default 'transactional' check(purpose in ('transactional','reminder'));
alter table private.transactional_email_jobs add column reminder_source_version text;
create function private.reminder_email_ready(org uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.transactional_email_ready(org) then return false;end if;perform private.require_feature(org,'F27');return true;
exception when sqlstate 'P0001' then if sqlerrm='PLAN_FEATURE_UNAVAILABLE' then return false;end if;raise;
end$$;
create function private.reminder_email_not_before(n core.notifications) returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare account uuid;settings jsonb;ctx jsonb;quiet timestamptz;
begin
 if n.kind<>'reminder' then return clock_timestamp();end if;
 ctx:=private.transactional_email_context(n);if ctx is null then return null;end if;
 select l.account_id into account from core.account_links l where l.org_id=n.org_id and l.person_id=n.recipient_person_id and l.state='active' and l.verified_at is not null order by l.created_at,l.id limit 1;
 select private.frontend_settings_defaults('user')||coalesce((select values from private.frontend_settings where scope_key='user:'||account),'{}') into settings;
 quiet:=private.reminder_quiet_until(settings,greatest(clock_timestamp(),(ctx->>'due_at')::timestamptz));
 if quiet is null or quiet>=(ctx->>'expires_at')::timestamptz then return null;end if;return quiet;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.transactional_email_context(core.notifications)'::regprocedure);
 a:=' title:=case';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder email context anchor drift';end if;
 execute replace(b,a,$a$ if n.kind='reminder' then
  if n.payload->>'template_key' not in ('p05.lesson','p05.entitlement','p05.event','p05.payment') or n.payload->>'reminder_center_id' is null then return null;end if;
  return private.reminder_context(n.org_id,(n.payload->>'reminder_center_id')::uuid,n.recipient_person_id,substr(n.payload->>'template_key',5),n.subject_id);
 end if;
$a$||a);
 b:=pg_get_functiondef('private.transactional_email_enqueue()'::regprocedure);
 b:=replace(b,'declare ctx jsonb;','declare ctx jsonb;delivery_purpose text:=case when new.kind=''reminder'' then ''reminder'' else ''transactional'' end;');
 a:=' if not private.transactional_email_ready(new.org_id)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder enqueue readiness drift';end if;
 b:=replace(b,a,' if (delivery_purpose=''reminder'' and not private.reminder_email_ready(new.org_id)) or not private.transactional_email_ready(new.org_id)');
 a:='p.purpose=''transactional''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder opt-in enqueue drift';end if;b:=replace(b,a,'p.purpose=delivery_purpose');
 a:='values(new.id,new.org_id,(ctx->>''center_id'')::uuid,(ctx->>''version'')::bigint);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder queue metadata drift';end if;
 b:=replace(b,'(job_id,org_id,center_id,subject_version)', '(job_id,org_id,center_id,subject_version,purpose,reminder_source_version)');
 b:=replace(b,a,'values(new.id,new.org_id,(ctx->>''center_id'')::uuid,(ctx->>''version'')::bigint,delivery_purpose,ctx->>''source_version'');');execute b;
 b:=pg_get_functiondef('private.transactional_email_allowed(core.outbox_jobs,private.transactional_email_jobs)'::regprocedure);
 a:=' return coalesce(';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder email authorization drift';end if;
 b:=replace(b,a,$a$ if s.purpose='reminder' and (not private.reminder_email_ready(j.org_id) or ctx->>'source_version' is distinct from s.reminder_source_version or ctx->>'source_version' is distinct from n.payload->>'reminder_source_version' or private.reminder_email_not_before(n) is null) then return false;end if;
$a$||a);b:=replace(b,'p.purpose=''transactional''','p.purpose=s.purpose');execute b;
 b:=pg_get_functiondef('private.transactional_email_worker(jsonb,jsonb)'::regprocedure);
 a:='ok boolean;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder worker variable drift';end if;b:=replace(b,a,a||'not_before timestamptz;');
 a:='  select * into cfg from private.invitation_sender_config';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Quiet preclaim anchor drift';end if;
 b:=replace(b,a,$a$  select * into n from core.notifications where org_id=j.org_id and id=j.notification_id;
  not_before:=private.reminder_email_not_before(n);
  if s.purpose='reminder' and not_before>clock_timestamp() then
   update core.outbox_jobs set state='pending',lease_until=null,next_attempt_at=not_before,version=version+1 where id=j.id;
   return jsonb_build_object('_internal_invitation',null);
  end if;
$a$||a);
 a:='if phase=''authorize'' then return jsonb_build_object(''authorized'',ok);end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Quiet final authorization drift';end if;
 b:=replace(b,a,$a$select * into n from core.notifications where org_id=j.org_id and id=j.notification_id;
 not_before:=private.reminder_email_not_before(n);
 if phase='authorize' then return jsonb_build_object('authorized',ok and (s.purpose<>'reminder' or not_before<=clock_timestamp()));end if;
 if ok and s.purpose='reminder' and not_before>clock_timestamp() and aux->>'provider_reference' is null then
  update core.outbox_jobs set state='retry_wait',attempts=greatest(attempts-1,0),lease_until=null,next_attempt_at=not_before,version=version+1 where id=j.id;
  return jsonb_build_object('state','retry_wait');
 end if;$a$);execute b;
 b:=pg_get_functiondef('private.notification_channel_guard(jsonb)'::regprocedure);
 a:='r->>''purpose''<>''transactional''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder email preference availability drift';end if;
 execute replace(b,a,'(r->>''purpose'' not in (''transactional'',''reminder'') or (r->>''purpose''=''reminder'' and not private.reminder_email_ready((r->>''org_id'')::uuid)))');
 b:=pg_get_functiondef('private.p05_notification_page(jsonb,uuid,uuid)'::regprocedure);
 a:='''email_preference'',jsonb_build_object';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder preference read drift';end if;
 execute replace(b,a,$a$'reminder_email_preference',jsonb_build_object('enabled',coalesce((select p.enabled from core.notification_preferences p where p.org_id=org and p.person_id=actor and p.channel='email' and p.purpose='reminder'),false),'version',coalesce((select p.version from core.notification_preferences p where p.org_id=org and p.person_id=actor and p.channel='email' and p.purpose='reminder'),1),'available',private.reminder_email_ready(org)),$a$||a);
end$patch$;
revoke all on function private.reminder_email_ready(uuid),private.reminder_email_not_before(core.notifications) from public,anon,authenticated;
grant execute on function private.reminder_email_ready(uuid),private.reminder_email_not_before(core.notifications) to service_role;
commit;
begin;
alter table private.p05_jobs add column domain_result jsonb;
-- Human API helpers retain SECURITY INVOKER. Only the server role may inspect
-- job outcomes and reset a validated failed job; native worker LOGINs keep
-- using their existing fenced SECURITY DEFINER entrypoints.
grant select,update on private.p05_jobs to service_role;
create function private.automation_retry_eligible(c private.p05_jobs,a core.automations,x private.p05_configuration_scopes) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not coalesce(x.enabled and a.state='active' and private.current_plan_name(c.org_id) in ('pro','business') and private.access_mode(c.org_id) in ('normal','grace') and c.center_id=any(x.execution_center_ids) and private.center_accessible(c.org_id,c.center_id) and private.is_manager(c.org_id,x.creator_person_id,c.center_id) and split_part(c.event_key,':',1)=a.version::text,false) then return false;end if;
 perform private.require_feature(c.org_id,'F24');
 return private.p05_segment_matches(c.org_id,c.center_id,c.person_id,a.segment_id) and private.p07_automation_allowed(c.org_id,c.center_id,a.trigger,c.target_id) and exists(select 1 from private.p05_automation_candidates(c.org_id,c.center_id,a.trigger) z where z.person_id=c.person_id and z.target_id=c.target_id and a.version::text||':'||z.event_key=c.event_key);
exception when sqlstate 'P0001' then if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','POLICY_NOT_CONFIGURED','NOT_FOUND','FORBIDDEN','SUBSCRIPTION_NOT_STARTED') then return false;end if;raise;
end$$;
create function private.automation_recent_jobs(org uuid,automation uuid,actor uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'version',q.version,'center_id',q.center_id,'person_id',q.person_id,'state',q.state,'attempts',q.attempts,'next_attempt_at',q.next_attempt_at,'safe_error_code',q.safe_error_code,'result_reference',coalesce(q.domain_result,q.result#>'{data,result_reference}'),'retry_available',q.state='failed' and q.eligible and q.no_result) order by q.created_at desc,q.id desc),'[]') from (
 select j.*,c.center_id,c.person_id,c.safe_error_code,c.result,c.domain_result,private.automation_retry_eligible(c,a,x) eligible,
 not exists(select 1 from core.automation_runs z where z.org_id=$1 and z.automation_id=$2 and z.person_id=c.person_id and z.event_key=c.event_key) no_result
 from private.p05_jobs c join core.outbox_jobs j on j.id=c.job_id join core.automations a on a.org_id=c.org_id and a.id=c.automation_id join private.p05_configuration_scopes x on x.entity_id=a.id
 where c.org_id=$1 and c.automation_id=$2 and private.is_manager($1,$3,c.center_id) order by j.created_at desc,j.id desc limit 20
 ) q
$$;
create function private.automation_retry(r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a core.automations;x private.p05_configuration_scopes;c private.p05_jobs;j core.outbox_jobs;definition jsonb;
begin
 perform private.require_feature(org,'F24');
 select * into a from core.automations where org_id=org and id=(r->>'automation_id')::uuid for update;
 select * into x from private.p05_configuration_scopes where org_id=org and entity_id=a.id;
 if a.id is null or x.entity_id is null or x.center_id is distinct from (r#>>'{scope,center_id}')::uuid then perform private.fail('NOT_FOUND');end if;
 if a.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if not x.enabled or a.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 definition:=jsonb_build_object('name',a.name,'trigger',a.trigger,'action',a.action,'segment_id',a.segment_id,'execution_center_ids',x.execution_center_ids,'enabled',x.enabled);
 if coalesce(r->'definition','{}')||jsonb_build_object('segment_id',coalesce(r#>'{definition,segment_id}','null'::jsonb)) is distinct from definition then perform private.fail('VALIDATION_FAILED');end if;
 select * into c from private.p05_jobs where org_id=org and automation_id=a.id and job_id=(r#>>'{retry_job,id}')::uuid;
 if c.job_id is null or (center is not null and c.center_id<>center) or not private.is_manager(org,actor,c.center_id) then perform private.fail('NOT_FOUND');end if;
 select * into j from core.outbox_jobs where org_id=org and id=c.job_id for update;
 if j.version is distinct from (r#>>'{retry_job,version}')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if j.state<>'failed' or split_part(c.event_key,':',1)<>a.version::text or exists(select 1 from core.automation_runs z where z.org_id=org and z.automation_id=a.id and z.person_id=c.person_id and z.event_key=c.event_key) then perform private.fail('INVALID_STATE_TRANSITION');end if;
 if not private.automation_retry_eligible(c,a,x) then perform private.fail('INVALID_STATE_TRANSITION');end if;
 update core.outbox_jobs set state='pending',attempts=0,lease_until=null,next_attempt_at=clock_timestamp(),version=version+1 where id=j.id;
 -- Invalidate every old lease before the next claim; successful domain effects
 -- are never retried, even with a new operation key.
 update private.p05_jobs set lease_hash=null,operation_key=null,payload_hash=null,result=null,domain_result=null,safe_error_code=null where job_id=j.id;
 return jsonb_build_object('data',null,'primary_id',a.id,'subject','automations','version',a.version);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p05_notifications(text,jsonb,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:='  c:=private.p05_configuration(org,center,actor,r->''scope'');definition:=r->''definition'';';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation retry dispatch drift';end if;
 execute replace(b,a,a||$a$
  if op='automation_save_v1' and r?'retry_job' then return private.automation_retry(r,org,center,actor);end if;
$a$);
 b:=pg_get_functiondef('private.p05_management(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:='jsonb_build_object(''automation_id'',a.id,''definition''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation jobs projection drift';end if;
 execute replace(b,a,'jsonb_build_object(''recent_jobs'',private.automation_recent_jobs(org,a.id,actor),''automation_id'',a.id,''definition''');
 -- A claimed job must still respect closure epochs immediately before effects.
 b:=pg_get_functiondef('private.p05_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:='    update core.automation_runs set state=';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation result reference drift';end if;
 b:=replace(b,a,$a$    update private.p05_jobs set domain_result=case when a.action->>'kind'='create_followup' then jsonb_build_object('type','crm_activities','id',nid) when exists(select 1 from core.notifications n where n.org_id=org and n.id=nid) then jsonb_build_object('type','notifications','id',nid) end where job_id=j.id;
$a$||a);
 a:='   allowed:=exists(select 1 from private.p05_automation_candidates';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation final closure recheck drift';end if;
 execute replace(b,a,'   allowed:=private.p07_automation_allowed(org,c.center_id,a.trigger,c.target_id) and exists(select 1 from private.p05_automation_candidates');
end$patch$;
revoke all on function private.automation_retry_eligible(private.p05_jobs,core.automations,private.p05_configuration_scopes),private.automation_recent_jobs(uuid,uuid,uuid),private.automation_retry(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.automation_retry_eligible(private.p05_jobs,core.automations,private.p05_configuration_scopes),private.automation_recent_jobs(uuid,uuid,uuid),private.automation_retry(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
