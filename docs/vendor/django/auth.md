# Authentication Architecture

Authentication is handled using Django + django-allauth.

## Core Concepts

- Django's User model is the source of truth.
- Allauth manages login, registration, and account flows.
- Authentication logic must remain backend-driven.

## Sessions vs Tokens

- Session authentication is supported.
- Token/JWT authentication may be layered on top.
- Do not mix auth mechanisms within the same request flow.

## Permissions

- Permissions should be explicit.
- Avoid magic permission checks.
- Prefer service-layer authorization logic.

## Security

- Password handling must always use Django utilities.
- Never manually hash passwords.
- Sensitive auth logic must not be duplicated.

## Agent Rules

- Do not invent authentication flows.
- Always integrate with existing allauth configuration.
- If unsure, ask before generating auth-related code.
