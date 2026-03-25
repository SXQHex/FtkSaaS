# backend/products/graphql/types.py

import strawberry
import strawberry_django
from strawberry import relay
from typing import List, Optional
from enum import Enum

from .. import models
from .filters import *
from .orders import *


# --- ENUMS ---

@strawberry.enum
class IntervalUnitEnum(Enum):
    DAY = "DAY"
    WEEK = "WEEK"
    MONTH = "MONTH"
    CREDIT = "CREDIT"

@strawberry.enum
class CurrencyEnum(Enum):
    TRY = "TRY"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"

# --- TYPES ---

@strawberry_django.type(models.Discipline, filters=DisciplineFilter, order=DisciplineOrder)
class DisciplineType(relay.Node):
    name: strawberry.auto
    description: strawberry.auto
    is_active: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    styles: List["StyleType"]
    levels: List["LevelType"]
    packages: List["PackageType"]

@strawberry_django.type(models.Style, filters=StyleFilter, order=StyleOrder)
class StyleType(relay.Node):
    name: strawberry.auto
    description: strawberry.auto
    is_active: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    discipline: "DisciplineType"
    levels: List["LevelType"]
    packages: List["PackageType"]

@strawberry_django.type(models.Level, filters=LevelFilter, order=LevelOrder)
class LevelType(relay.Node):
    name: strawberry.auto
    description: strawberry.auto
    is_active: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    order: strawberry.auto
    discipline: "DisciplineType"
    style: Optional["StyleType"]
    packages: List["PackageType"]

@strawberry_django.type(models.GroupType, filters=GroupTypeFilter, order=GroupTypeOrder)
class GroupTypeType(relay.Node):
    name: strawberry.auto
    description: strawberry.auto 
    is_active: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    is_private_lesson: strawberry.auto

@strawberry_django.type(models.PricingPlan, filters=PricingPlanFilter, order=PricingPlanOrder)
class PricingPlanType(relay.Node):
    name: strawberry.auto
    description: strawberry.auto
    is_active: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    interval_unit: IntervalUnitEnum
    unit_count: strawberry.auto
    
    @strawberry.field
    def duration_info(self) -> str:
        return self.get_duration_info()

@strawberry_django.type(models.Package, filters=PackageFilter, order=PackageOrder)
class PackageType(relay.Node):
    name: strawberry.auto
    description: strawberry.auto
    is_active: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    price: strawberry.auto
    currency: CurrencyEnum
    discipline: "DisciplineType"
    style: Optional["StyleType"]
    level: Optional["LevelType"]
    group_type: "GroupTypeType"
    pricing_plan: "PricingPlanType"

