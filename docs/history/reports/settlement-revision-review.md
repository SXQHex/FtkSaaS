# Settlement revision independent review

Base PR head: c1a479c72e98c5a53d949a1eb7e30e1abc6679a3.
Initial changed source: f3cd7d7d307524a84fa205f033aeea340f81a333.
One P2: partial correction of a multi-allocation payment/offset did not identify the original allocations.

Rechecked source: 6f8ef9952705a9272d17f511ea9dcbb3ccc6cf67.
Tree: b9456d327f1e24c1676f5c3a1a72fdbc4d997e9f.
Published byte-equivalent source: 66d66b5149e85ba6d0113a7c29adfffa61f6f7d9.
The correction now names original allocation IDs, current versions and amounts; record read exposes original side/amount plus current reversible amount/version. Membership, uniqueness, bounds and balanced original offset sides are specified. P2 closed; no other material finding.

Review was read-only and static; reviewer did not rerun tests. Root focused verification passed 83/83 on the source above. This is not behavior acceptance for the new unimplemented workflows. The final PR head (including these evidence-only documents) requires a final independent review and fresh mandatory clean CI; exact SHA and links are recorded in the PR conversation.
