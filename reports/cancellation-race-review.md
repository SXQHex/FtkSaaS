# RC3 collection/cancellation regression

Baseline: main 6876d5f09c7eca54a85f2bc72ee779827e93ef05.
Failed main run: https://github.com/SXQHex/FtkSaaS/actions/runs/38820160639

The original test asserted that collection must fail when cancellation wins the organization lock. This conflicts with the accepted technical contract section 8: surplus collection becomes separate student credit and does not make debt negative. The runtime already serializes both operations and records later unallocated cash as a source_cash_id-linked surplus_add.

The fix preserves runtime and frozen migrations. It replaces the one-order assertion with:
- cancellation first, then collection: 400 debt-linked claim + 600 cash-linked surplus;
- collection first, stale apply rollback, refreshed cancellation: 1000 debt-linked claim;
- actual concurrent API calls, accepting only either complete serialized ledger outcome.

All paths verify zero event obligation, 1000 total cash and credit, exactly two cash receipts, exact source allocations, no automatic cash refund, one receipt per successful key, and byte-equivalent ledger rows on replay. The stale path verifies no apply receipt, adjustment or credit before a fresh preview is applied.

This is the implementation author's source review. GitHub CI and independent Codex review are recorded on the correction PR. Earlier RC3 reports remain historical; they do not establish merge-head CI success.
