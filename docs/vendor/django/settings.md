# Django Settings Conventions

This document describes how Django settings are structured and used in this project.

## Environment Management

- Environment variables are mandatory.
- `.env` files are used locally but NOT committed.
- Settings must not hardcode secrets.

## Installed Apps

Key installed apps include:
- django.contrib.auth
- django.contrib.contenttypes
- django.contrib.sessions
- django.contrib.sites
- corsheaders
- allauth
- strawberry_graphql
- strawberry_graphql_django

## Authentication

- `django-allauth` is the primary authentication framework.
- Email-based authentication is preferred.
- Session auth may coexist with token/JWT-based auth.

## CORS

- `django-cors-headers` is enabled.
- CORS settings must explicitly list allowed origins.
- Wildcard CORS is not allowed in production.

## Database

- PostgreSQL is used via `psycopg3`.
- Raw SQL should be avoided unless strictly necessary.
- Transactions should be explicit when modifying critical data.

## Agent Rules

- Do not introduce new settings without documenting them.
- Follow existing settings patterns.
- Avoid global settings changes unless explicitly requested.
