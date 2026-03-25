# backend/courses/graphql/unions.py
import strawberry
from typing import Optional, Annotated, Union
from .types import *
from core.types import MutationError  # noqa: F401 — re-exported

# Her model için başarı ve hata durumunu birleştiren Union'lar
LocationResponse = Annotated[Union[LocationType, MutationError], strawberry.union("LocationResponse")]
RoomResponse = Annotated[Union[RoomType, MutationError], strawberry.union("RoomResponse")]
CourseGroupResponse = Annotated[Union[CourseGroupType, MutationError], strawberry.union("CourseGroupResponse")]
ParticipationRoleResponse = Annotated[Union[ParticipationRoleType, MutationError], strawberry.union("ParticipationRoleResponse")]
RoleCapacityResponse = Annotated[Union[CourseGroupRoleCapacityType, MutationError], strawberry.union("RoleCapacityResponse")]
GroupMemberResponse = Annotated[Union[GroupMemberType, MutationError], strawberry.union("GroupMemberResponse")]
SeanceResponse = Annotated[Union[SeanceType, MutationError], strawberry.union("SeanceResponse")]
AttendanceResponse = Annotated[Union[SeanceAttendanceType, MutationError], strawberry.union("AttendanceResponse")]
RecurringRuleResponse = Annotated[Union[RecurringRuleType, MutationError], strawberry.union("RecurringRuleResponse")]
