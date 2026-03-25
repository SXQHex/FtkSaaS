# backend/core/utils.py
import os
from uuid6 import uuid7
from django.utils import timezone

def upload_to_uuid(instance, filename: str) -> str:
    """Dosya yüklemelerinde isimleri UUIDv7 yaparak çakışmayı önler."""
    ext = filename.split('.')[-1]
    # instance._meta.model_name kullanarak klasörlere ayırırız
    return os.path.join(
        instance._meta.model_name, 
        f"{uuid7()}.{ext}"
    )