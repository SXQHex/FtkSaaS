# backend/products/graphql/orders.py

import strawberry
import strawberry_django
from .. import models

# --- ORDERING ---

@strawberry_django.ordering.order_type(models.Discipline)
class DisciplineOrder:
    name: strawberry.auto

@strawberry_django.ordering.order_type(models.Style)
class StyleOrder:
    name: strawberry.auto
    discipline: strawberry.auto

@strawberry_django.ordering.order_type(models.Level)
class LevelOrder:
    name: strawberry.auto
    order: strawberry.auto

@strawberry_django.ordering.order_type(models.GroupType)
class GroupTypeOrder:
    name: strawberry.auto

@strawberry_django.ordering.order_type(models.PricingPlan)
class PricingPlanOrder:
    name: strawberry.auto
    unit_count: strawberry.auto

@strawberry_django.ordering.order_type(models.Package)
class PackageOrder:
    name: strawberry.auto
    price: strawberry.auto
    is_active: strawberry.auto
    created_at: strawberry.auto
