# backend/products/graphql/inputs.py

import strawberry_django
from strawberry import relay, UNSET
from typing import Optional
from decimal import Decimal
from .. import models
from .types import IntervalUnitEnum, CurrencyEnum

# --- INPUTLAR ---

@strawberry_django.input(models.Discipline, partial=True)
class DisciplineInput:
    id: Optional[relay.GlobalID] = UNSET
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
    is_active: Optional[bool] = UNSET

@strawberry_django.input(models.Style, partial=True)
class StyleInput:
    id: Optional[relay.GlobalID] = UNSET
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET 
    discipline: Optional[relay.GlobalID] = UNSET
    is_active: Optional[bool] = UNSET

@strawberry_django.input(models.Level, partial=True)
class LevelInput:
    id: Optional[relay.GlobalID] = UNSET    
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
    order: Optional[int] = UNSET
    discipline: Optional[relay.GlobalID] = UNSET
    style: Optional[relay.GlobalID] = UNSET
    is_active: Optional[bool] = UNSET

@strawberry_django.input(models.GroupType, partial=True)
class GroupTypeInput:
    id: Optional[relay.GlobalID] = UNSET    
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
    is_private_lesson: Optional[bool] = UNSET
    is_active: Optional[bool] = UNSET

@strawberry_django.input(models.PricingPlan, partial=True)
class PricingPlanInput:
    id: Optional[relay.GlobalID] = UNSET    
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET 
    interval_unit: Optional[IntervalUnitEnum] = UNSET
    unit_count: Optional[int] = UNSET
    is_active: Optional[bool] = UNSET

@strawberry_django.input(models.Package, partial=True)
class PackageInput:
    id: Optional[relay.GlobalID] = UNSET    
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
    price: Optional[Decimal] = UNSET
    currency: Optional[CurrencyEnum] = UNSET
    discipline: Optional[relay.GlobalID] = UNSET
    style: Optional[relay.GlobalID] = UNSET 
    level: Optional[relay.GlobalID] = UNSET 
    group_type: Optional[relay.GlobalID] = UNSET 
    pricing_plan: Optional[relay.GlobalID] = UNSET 
    is_active: Optional[bool] = UNSET
