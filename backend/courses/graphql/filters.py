# backend/courses/graphql/filters.py
import strawberry
import strawberry_django
from typing import Optional
from datetime import date, datetime
from .. import models
from .enums import * # Enumlar artık güvenli bir şekilde buradan geliyor

# -----------------------------------------------------------
# FILTERS
# -----------------------------------------------------------

@strawberry_django.filter(models.Location, lookups=True)
class LocationFilter:
    id: Optional[strawberry.ID] = None
    name: Optional[str] = None
    internal_code: Optional[str] = None
    is_active: Optional[bool] = None

@strawberry_django.filter(models.Room, lookups=True)
class RoomFilter:
    id: Optional[strawberry.ID] = None
    name: Optional[str] = None
    location: Optional["LocationFilter"] = None
    is_active: Optional[bool] = None

@strawberry_django.filter(models.ParticipationRole, lookups=True)
class ParticipationRoleFilter:
    id: Optional[strawberry.ID] = None
    name: Optional[str] = None
    courses_staff: Optional[bool] = None
    impacts_capacity: Optional[bool] = None
    is_active: Optional[bool] = None

@strawberry_django.filter(models.CourseGroup, lookups=True)
class CourseGroupFilter:
    id: Optional[strawberry.ID] = None
    name: Optional[str] = None
    status: Optional[GroupStatusEnum] = None
    discipline: Optional[strawberry.ID] = None
    level: Optional[strawberry.ID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_closed_group: Optional[bool] = None # auto yerine tip belirttik
    is_active: Optional[bool] = None

@strawberry_django.filter(models.CourseGroupRoleCapacity, lookups=True)
class CourseGroupRoleCapacityFilter:
    id: Optional[strawberry.ID] = None
    role: Optional[ParticipationRoleFilter] = None
    capacity: Optional[int] = None

@strawberry_django.filter(models.GroupMember, lookups=True)
class GroupMemberFilter:
    id: Optional[strawberry.ID] = None
    group: Optional[CourseGroupFilter] = None
    user: Optional[strawberry.ID] = None
    role: Optional[ParticipationRoleFilter] = None
    is_active: Optional[bool] = None

@strawberry_django.filter(models.RecurringRule, lookups=True)
class RecurringRuleFilter:
    id: Optional[strawberry.ID] = None
    day_of_week: Optional[int] = None
    course_group: Optional[CourseGroupFilter] = None
    room: Optional[RoomFilter] = None
    is_active: Optional[bool] = None

@strawberry_django.filter(models.Seance, lookups=True)
class SeanceFilter:
    id: Optional[strawberry.ID] = None
    course_group: Optional[CourseGroupFilter] = None
    room: Optional[RoomFilter] = None
    instructor: Optional[strawberry.ID] = None
    start_time: Optional[datetime] = None
    status: Optional[SeanceStatusEnum] = None
    is_active: Optional[bool] = None

@strawberry_django.filter(models.SeanceAttendance, lookups=True)
class SeanceAttendanceFilter:
    id: Optional[strawberry.ID] = None
    seance: Optional[SeanceFilter] = None
    attender: Optional[strawberry.ID] = None
    role: Optional[strawberry.ID] = None
    status: Optional[AttendanceStatusEnum] = None
    # Attendance genellikle hard-delete olsa da tutarlılık için eklenebilir