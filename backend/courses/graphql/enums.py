import strawberry
from enum import Enum

@strawberry.enum
class GroupStatusEnum(Enum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

@strawberry.enum
class SeanceStatusEnum(Enum):
    SCHEDULED = "SCHEDULED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

@strawberry.enum
class AttendanceStatusEnum(Enum):
    BOOKED = "BOOKED"
    ATTENDED = "ATTENDED"
    NO_SHOW = "NO_SHOW"
    CANCELLED = "CANCELLED"
    WAITING = "WAITING"

@strawberry.enum
class DayOfWeekEnum(Enum):
    MON = 1; TUE = 2; WED = 3; THU = 4; FRI = 5; SAT = 6; SUN = 7

