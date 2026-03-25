import strawberry
import strawberry_django
from strawberry import relay, UNSET
from typing import Optional
from datetime import date
from .. import models

# 1. Profile için İlişkili Input (Profil güncelleme sırasında kullanılır)
@strawberry_django.input(models.Profile)
class ProfileRelationInput:
    # Burada 'id' genelde gerekmez çünkü User üzerinden OneToOne bağlıdır
    birth_day: Optional[date] = UNSET
    gender: Optional[str] = UNSET
    profile_image: Optional[str] = UNSET 

# 2. Kullanıcı Kayıt/Oluşturma Input
@strawberry_django.input(models.Users)
class UserCreateInput:
    username: str = UNSET
    email: str
    phone_number: Optional[str] = UNSET
    first_name: Optional[str] = UNSET
    last_name: Optional[str] = UNSET
    is_active: bool = False
    # Role ataması için GlobalID üzerinden NodeInput
    role: Optional[relay.GlobalID] = UNSET 

# 3. Profil Güncelleme Input (User + Profile birleşik)
@strawberry_django.input(models.Users)
class ProfileUpdateInput:
    id: relay.GlobalID # Hangi kullanıcı olduğunu bilmek için şart
    first_name: Optional[str] = UNSET
    last_name: Optional[str] = UNSET
    phone_number: Optional[str] = UNSET 
    username: Optional[str] = UNSET
    email: Optional[str] = UNSET
    # Profile tablosundaki verileri de buradan güncelleyebiliriz
    profile: Optional[ProfileRelationInput] = UNSET

# 4. Genel Kullanıcı Güncelleme (Admin vb. için)
@strawberry_django.input(models.Users)
class UserUpdateInput:
    id: relay.GlobalID
    username: Optional[str] = UNSET
    email: Optional[str] = UNSET
    is_active: Optional[bool] = UNSET
    phone_number: Optional[str] = UNSET 
    first_name: Optional[str] = UNSET
    last_name: Optional[str] = UNSET
    role: Optional[strawberry_django.NodeInput] = UNSET
