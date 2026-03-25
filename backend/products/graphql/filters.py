# backend/products/graphql/filters.py

import strawberry
import strawberry_django
from .. import models
from typing import Optional


# --- FILTERS (strawberry.auto ile Relay ID uyumu sağlanır) ---

@strawberry_django.filters.filter(models.Discipline)
class DisciplineFilter:
    id: strawberry.auto
    name: strawberry.auto
    is_active: strawberry.auto

@strawberry_django.filters.filter(models.Style)
class StyleFilter:
    id: strawberry.auto
    name: strawberry.auto
    discipline: Optional[DisciplineFilter]
    is_active: strawberry.auto

@strawberry_django.filters.filter(models.Level)
class LevelFilter:
    id: strawberry.auto
    name: strawberry.auto
    discipline: Optional[DisciplineFilter]
    style: Optional[StyleFilter]
    is_active: strawberry.auto

@strawberry_django.filters.filter(models.GroupType)
class GroupTypeFilter:
    id: strawberry.auto
    name: strawberry.auto
    is_active: strawberry.auto

@strawberry_django.filters.filter(models.PricingPlan)
class PricingPlanFilter:
    id: strawberry.auto
    name: strawberry.auto
    is_active: strawberry.auto

@strawberry_django.filters.filter(models.Package)
class PackageFilter:
    id: strawberry.auto
    name: strawberry.auto
    is_active: strawberry.auto
    discipline: Optional[DisciplineFilter]
    style: Optional[StyleFilter]
    level: Optional[LevelFilter]
    group_type: Optional[GroupTypeFilter]
    pricing_plan: Optional[PricingPlanFilter]
    price: strawberry.auto
