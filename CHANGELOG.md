# Changes

## 0.2.0-rc.2 — 2026-10-16

Implements accepted Q-E01 payment preparation against existing debt/collection/credit journals. Prepared paid registrations atomically register or commit a typed capacity_closed financial resolution. Prestart full operator cancellation reverses obligations and creates only unclaimed student credit; earlier discounts/refunds and explicit offsets/refunds do not duplicate claims. Adds service-only preparation read/write RPCs and activates the existing debt adjustment/student credit refund/offset contracts. Shared DTOs, examples and Claude handover updated. Started/partial event monetary cancellation remains blocked pending a separate product decision.

## Previous continuation — 2026-10-16

Clean acceptance is now one CI command with explicit local migration replay and empty-fixture checks. Race assertions inspect persisted balances, registrations, receipts, debt and allocations. Health JSON output is parsed during clean acceptance. Q-E01 is accepted but its schema/API/shared-type and financial acceptance transfer remains pending.

## 0.2.0-rc.1 — 2026-10-15

Persistent GitHub development branch, pinned CI/devcontainer and reproducible local Supabase stack. Verified Auth gateway creates domain UUIDv7 IDs and calls service-only named transaction RPCs. Identity, billing gates, shared entitlement pool, event save/read/preview/register/cancel/attendance/corrections and duty verification implemented for the explicitly listed runtime capabilities. Runtime schema validators are generated before execution. See docs/claude-handover.md for supported paths, acceptance evidence and unresolved product decisions.

## 0.1.0 / 2.2-tech.2

Historical static contracts, UUID/discipline schema transfer and private Q-D01 scope predicates. No operational endpoint claim for that snapshot.
