# GraphQL Architecture & Relay Contract

This project strictly follows **Relay GraphQL standards**.

The backend schema is the single source of truth.
The frontend consumes it without assumptions or shortcuts.

---

## Global ID Contract

- Frontend NEVER sees database IDs.
- All identifiers are Relay Global IDs.
- ID manipulation on the frontend is forbidden.
- Strawberry-Django automatically resolves IDs internally.

Any attempt to bypass this is a violation.

---

## Backend → Frontend Contract

- Backend defines:
  - schema
  - types
  - connections
  - mutations
- Frontend consumes schema exactly as defined.

Frontend never guesses:
- field names
- argument shapes
- ID formats

---

## Backend Workflow (MANDATORY)

1. Define Django models
2. Create and apply migrations
3. Implement Relay-compliant GraphQL types
4. Implement queries and mutations using Global IDs
5. Compose app schema
6. Compose global schema
7. Start backend server
8. Validate Relay schema
9. Run GraphQL codegen

No frontend work may start before step 9.

---

## Code Generation (Backend)

- Generated schema is authoritative.
- Relay Node and connection types must appear.
- Generated files must not be edited manually.

---

## Frontend GraphQL Architecture

Frontend uses **Apollo Client with Relay-style schema usage**.

### Generated Types

Generated file:

### frontend/apps/ftk_web/src/lib/apolloql/generated/graphql.ts

Rules:
- This file is the ONLY typing source.
- All IDs are treated as opaque strings.
- No decoding or parsing is allowed.

---

## Queries & Mutations (Frontend)

Frontend GraphQL code lives in:

frontend/apps/ftk_web/src/lib/apolloql/
├── queries.ts
└── mutations.ts


Rules:
- All queries use Relay patterns where applicable.
- All mutations pass Global IDs as-is.
- No ID transformations.
- No inline GraphQL in components.

---

## Frontend Workflow (MANDATORY)

1. Import types from `generated/graphql.ts`
2. Write queries in `queries.ts`
3. Write mutations in `mutations.ts`
4. Run GraphQL codegen again
5. Ensure type safety
6. Begin Next.js UI development

Skipping steps is forbidden.

---

## Backend–Frontend Handshake

The handshake is complete only when:

- Backend schema is Relay-compliant
- Global IDs flow end-to-end
- Codegen passes cleanly
- No TypeScript errors exist
- No ID manipulation exists in frontend code

Only then may UI work begin.

---

## Agent Rules

- NEVER invent GraphQL fields.
- NEVER assume ID structure.
- NEVER manipulate IDs.
- ALWAYS treat IDs as opaque Relay Global IDs.
- If an ID-related behavior is unclear, STOP and ask.
