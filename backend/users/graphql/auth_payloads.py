import strawberry
from typing import Optional
from core.graphql.types import FieldError
from .types import ViewerType


@strawberry.type
class AuthPayload:
    """
    Relay-compliant auth payload.
    """
    viewer: Optional[ViewerType]
    client_mutation_id: Optional[str]
    errors: Optional[list[FieldError]]
