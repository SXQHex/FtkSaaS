def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def safe_json(data):
    if not isinstance(data, dict):
        return {}
    return {k: str(v)[:256] for k, v in data.items()}
