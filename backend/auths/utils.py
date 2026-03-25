# backend/auths/utils.py
import base64

def get_user_from_info(info):
    request = info.context.request
    return getattr(request, "user", None)


def to_global_id(type_name: str, internal_id: str) -> str:
    """Strawberry/Relay formatında Global ID üretir: Base64('TypeName:UUID')"""
    if not internal_id:
        return None
    s = f"{type_name}:{internal_id}"
    return base64.b64encode(s.encode()).decode()