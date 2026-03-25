# backend/memberships/schema.py

import strawberry
from memberships.graphql.queries import MembershipsQuery
from memberships.graphql.mutations import MembershipsMutation

__all__ = ['MembershipsQuery', 'MembershipsMutation']
