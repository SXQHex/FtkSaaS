# Backend Architecture (Relay & Global ID First)

This backend is built with **Django + Strawberry GraphQL**  
and strictly follows **Relay specifications**.

All external-facing identifiers are **Relay Global IDs**.
Raw database IDs are NEVER exposed to the frontend.

---

## Core Principles

- GraphQL follows **Relay standards**.
- Frontend NEVER receives database IDs (UUID, int, etc.).
- All communication between:
  - frontend ↔ backend
  - user ↔ Strawberry
  uses **Global IDs exclusively**.
- Strawberry-Django automatically resolves Global IDs internally.

Any deviation from these rules is considered a bug.

---

## App Structure (MANDATORY)

Each Django app MUST follow this structure:

app/
├── models.py
├── graphql/
│   ├── filters.py
│   ├── inputs.py
│   ├── mutations.py
│   ├── permissions.py
│   ├── queries.py
│   └── types.py
├── schema.py
├── migrations/
└── __init__.py

No GraphQL logic may exist outside `graphql/`.

---

## Models

- `models.py` defines **internal persistence only**.
- Model primary keys:
  - may be UUID or integer
  - are NEVER exposed externally
- Models are NOT aware of Relay or Global IDs.

Models are the **internal source of truth only**.

---

## Relay & Global ID Rules

- All GraphQL nodes MUST implement Relay Node interface.
- All object references use Global IDs.
- No mutation or query accepts raw IDs.
- No resolver manually decodes or encodes IDs.

Strawberry-Django handles:
- Global ID ↔ model instance resolution
- Model ID mapping transparently

Manual ID manipulation is forbidden.

---

## GraphQL Layer Responsibilities

### `types.py`

- Defines Relay-compatible GraphQL types.
- Each type:
  - Implements Node
  - Uses Global ID automatically
- No business logic.
- No database queries.

---

### `filters.py`

- Filtering is applied on resolved model querysets.
- Filters must NOT accept raw IDs.
- Filters must be compatible with Relay pagination.

---

### `inputs.py`

- All mutation inputs:
  - Accept Global IDs only
  - Never accept raw model IDs
- Input objects must not decode IDs manually.

---

### `permissions.py`

- Permissions operate on:
  - resolved model instances
  - authenticated user
- Permissions never depend on raw IDs.

---

### `queries.py`

- Queries:
  - Are Relay-compliant
  - Use connections where applicable
- Object access always flows through Global IDs.

---

### `mutations.py`

- Mutations:
  - Accept Global IDs
  - Let Strawberry resolve them
  - Never manually fetch objects by ID
- Transactions must wrap multi-step writes.

---

## App Schema

### `app/schema.py`

- Composes:
  - Relay queries
  - Relay mutations
  - Node types
- No logic beyond schema composition.

---

## Global Schema

### `config/schema.py`

- Aggregates all app schemas.
- Exposes a single Relay-compliant GraphQL endpoint.
- This is the ONLY public API.

---

## Migration & Lifecycle Rules

1. Define models
2. Create migrations
3. Apply migrations
4. Implement GraphQL layer
5. Start backend server
6. Validate Relay schema
7. Proceed to frontend

Skipping steps is forbidden.

---

## Agent Rules

- NEVER expose raw IDs.
- NEVER accept UUIDs or database IDs in GraphQL.
- ALWAYS use Relay Global IDs.
- NEVER manually encode or decode IDs.
