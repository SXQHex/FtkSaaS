import strawberry
import strawberry_django
from strawberry import relay, UNSET
from typing import Optional
from datetime import date, datetime, time
from .. import models
from .enums import GroupStatusEnum, SeanceStatusEnum, AttendanceStatusEnum, DayOfWeekEnum

@strawberry.input
class BaseFieldsInput:
    description: Optional[str] = UNSET
    is_active: Optional[bool] = UNSET

@strawberry_django.input(models.Location, partial=True)
class LocationInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    name: Optional[str] = UNSET
    address: Optional[str] = UNSET
    phone: Optional[str] = UNSET
    email: Optional[str] = UNSET
    internal_code: Optional[str] = UNSET
    contact_info: Optional[str] = UNSET

@strawberry_django.input(models.Room, partial=True)
class RoomInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    location: Optional[relay.GlobalID] = UNSET
    name: Optional[str] = UNSET
    physical_capacity: Optional[int] = UNSET
    color_code: Optional[str] = UNSET

@strawberry_django.input(models.ParticipationRole, partial=True)
class ParticipationRoleInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    name: Optional[str] = UNSET
    courses_staff: Optional[bool] = UNSET
    impacts_capacity: Optional[bool] = UNSET
    color_code: Optional[str] = UNSET

@strawberry_django.input(models.CourseGroup, partial=True)
class CourseGroupInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    name: Optional[str] = UNSET
    status: Optional[GroupStatusEnum] = UNSET
    discipline: Optional[relay.GlobalID] = UNSET 
    level: Optional[relay.GlobalID] = UNSET      
    default_room: Optional[relay.GlobalID] = UNSET
    start_date: Optional[date] = UNSET
    end_date: Optional[date] = UNSET
    is_closed_group: Optional[bool] = UNSET

@strawberry_django.input(models.CourseGroupRoleCapacity, partial=True)
class RoleCapacityInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    group: Optional[relay.GlobalID] = UNSET
    role: Optional[relay.GlobalID] = UNSET
    capacity: Optional[int] = UNSET

@strawberry_django.input(models.GroupMember, partial=True)
class GroupMemberInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    group: Optional[relay.GlobalID] = UNSET
    user: Optional[relay.GlobalID] = UNSET 
    role: Optional[relay.GlobalID] = UNSET
    is_primary: Optional[bool] = UNSET

@strawberry_django.input(models.RecurringRule, partial=True)
class RecurringRuleInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    course_group: Optional[relay.GlobalID] = UNSET
    day_of_week: Optional[DayOfWeekEnum] = UNSET
    start_time: Optional[time] = UNSET
    end_time: Optional[time] = UNSET
    room: Optional[relay.GlobalID] = UNSET

@strawberry_django.input(models.Seance, partial=True)
class SeanceInput(BaseFieldsInput):
    id: Optional[relay.GlobalID] = UNSET
    course_group: Optional[relay.GlobalID] = UNSET
    instructor: Optional[relay.GlobalID] = UNSET 
    room: Optional[relay.GlobalID] = UNSET
    rule: Optional[relay.GlobalID] = UNSET
    start_time: Optional[datetime] = UNSET
    end_time: Optional[datetime] = UNSET
    status: Optional[SeanceStatusEnum] = UNSET

@strawberry_django.input(models.SeanceAttendance, partial=True)
class AttendanceInput:
    id: Optional[relay.GlobalID] = UNSET
    seance: Optional[relay.GlobalID] = UNSET
    attender: Optional[relay.GlobalID] = UNSET 
    role: Optional[relay.GlobalID] = UNSET
    status: Optional[AttendanceStatusEnum] = UNSET
    check_in_time: Optional[datetime] = UNSET