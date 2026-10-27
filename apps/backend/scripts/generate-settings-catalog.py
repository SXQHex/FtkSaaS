from pathlib import Path
import json,sys
config=json.loads(Path('config/frontend-settings.json').read_text());fields=config['fields']
sql="begin;\ncreate or replace function private.frontend_settings_fields() returns jsonb language sql immutable security invoker set search_path='' as $fields$select '"+json.dumps(fields,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb$fields$;\ncommit;\n"
target=Path(f"database/settings-catalog-v{config['version']}.sql")
if '--check' in sys.argv:
 assert target.read_text()==sql,'Settings catalog drift'
else:
 target.write_text(sql)
