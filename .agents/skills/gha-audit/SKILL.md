---
name: gha-audit
description: Audit the GitHub Actions workflows in this repo for security, speed, and correctness, and report findings with a proposed diff.
---

Load the installed `github-actions-workflow-pro` skill and read its `references/audit.md` from that skill's directory. Run its audit path against the workflow files named in the user's request, or every file under `.github/workflows/` when no file is named. Produce the report and proposed diff; leave the workflow files untouched unless the user asks you to apply the fixes.
