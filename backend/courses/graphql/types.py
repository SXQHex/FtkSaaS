# backend/courses/graphql/types.py
import strawberry
import strawberry_django
from strawberry import relay
from typing import List, Optional, Annotated, TYPE_CHECKING
from datetime import datetime
from .. import models
from . import enums
from .filters import *
from .orders import *

if TYPE_CHECKING:
    from users.graphql.types import UserType
    from products.graphql.types import DisciplineType, LevelType

# Dış uygulamalardan gelenler için Annotated + Lazy şart
UserTypeLazy = Annotated["UserType", strawberry.lazy("users.graphql.types")]
DisciplineTypeLazy = Annotated["DisciplineType", strawberry.lazy("products.graphql.types")]
LevelTypeLazy = Annotated["LevelType", strawberry.lazy("products.graphql.types")]

# -----------------------------------------------------------
# BASE INTERFACE (BaseModel & SoftDeleteMixin)
# -----------------------------------------------------------

@strawberry.interface
class BaseType:
    """BaseModel ve SoftDeleteMixin'den gelen ortak alanlar"""
    id: relay.GlobalID
    created_at: datetime
    updated_at: datetime
    description: Optional[str]
    is_active: bool

# -----------------------------------------------------------
# RELAY TYPE TANIMLAMALARI
# -----------------------------------------------------------

@strawberry_django.type(models.Location, filters=LocationFilter, order=LocationOrder, pagination=True)
class LocationType(relay.Node, BaseType):
    name: strawberry.auto
    address: strawberry.auto
    phone: strawberry.auto
    email: strawberry.auto
    internal_code: strawberry.auto
    contact_info: strawberry.auto
    # Reverse Relations
    rooms: List["RoomType"]

@strawberry_django.type(models.Room, filters=RoomFilter, order=RoomOrder, pagination=True)
class RoomType(relay.Node, BaseType):
    location: LocationType
    name: strawberry.auto
    physical_capacity: strawberry.auto
    color_code: strawberry.auto
    # Reverse Relations
    course_groups: List["CourseGroupType"]
    recurring_rules: List["RecurringRuleType"]
    seances: List["SeanceType"]

@strawberry_django.type(models.ParticipationRole, filters=ParticipationRoleFilter, order=ParticipationRoleOrder)
class ParticipationRoleType(relay.Node, BaseType):
    name: strawberry.auto
    courses_staff: strawberry.auto
    impacts_capacity: strawberry.auto
    color_code: strawberry.auto
    # Reverse Relations
    group_memberships: List["GroupMemberType"]
    seance_attendances: List["SeanceAttendanceType"]
    role_capacities: List["CourseGroupRoleCapacityType"]

@strawberry_django.type(models.CourseGroup, filters=CourseGroupFilter, order=CourseGroupOrder, pagination=True)
class CourseGroupType(relay.Node, BaseType):
    name: strawberry.auto
    status: enums.GroupStatusEnum  
    discipline: DisciplineTypeLazy
    level: Optional[LevelTypeLazy]
    default_room: Optional[RoomType]
    start_date: strawberry.auto
    end_date: strawberry.auto
    is_closed_group: strawberry.auto
    
    # Reverse Relations
    role_templates: List["CourseGroupRoleCapacityType"]
    members: List["GroupMemberType"]
    seances: List["SeanceType"]
    recurring_rules: List["RecurringRuleType"]


@strawberry_django.type(models.CourseGroupRoleCapacity, filters=CourseGroupRoleCapacityFilter, order=CourseGroupRoleCapacityOrder)
class CourseGroupRoleCapacityType(relay.Node, BaseType):
    group: CourseGroupType
    role: ParticipationRoleType
    capacity: strawberry.auto

@strawberry_django.type(models.GroupMember, filters=GroupMemberFilter, order=GroupMemberOrder)
class GroupMemberType(relay.Node, BaseType):
    group: CourseGroupType
    user: UserTypeLazy
    role: ParticipationRoleType
    is_primary: strawberry.auto

@strawberry_django.type(models.RecurringRule, filters=RecurringRuleFilter, order=RecurringRuleOrder)
class RecurringRuleType(relay.Node, BaseType):
    course_group: CourseGroupType
    day_of_week: enums.DayOfWeekEnum  # Enum entegrasyonu
    start_time: strawberry.auto
    end_time: strawberry.auto
    room: RoomType
    
    # Reverse Relations
    seances: List["SeanceType"]

@strawberry_django.type(models.Seance, filters=SeanceFilter, order=SeanceOrder, pagination=True)
class SeanceType(relay.Node, BaseType):
    course_group: CourseGroupType
    instructor: UserTypeLazy
    room: RoomType
    rule: Optional[RecurringRuleType]
    start_time: strawberry.auto
    end_time: strawberry.auto
    status: enums.SeanceStatusEnum  # Enum entegrasyonu
    # Reverse Relations
    attendances: List["SeanceAttendanceType"]

@strawberry_django.type(models.SeanceAttendance, filters=SeanceAttendanceFilter, order=SeanceAttendanceOrder)
class SeanceAttendanceType(relay.Node):
    # BaseModel'den türemediği için alanlar açıkça tanımlandı
    id: relay.GlobalID
    seance: SeanceType
    attender: UserTypeLazy
    role: ParticipationRoleType
    status: enums.AttendanceStatusEnum  # Enum entegrasyonu
    check_in_time: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto