---
status: superseded by ADR-0004
---

# Scoped Scripts match git identity, then path

Superseded. Matching by normalized git remote would treat every clone of the same GitHub repo as one project. A second clone can be a different working setup with different Scripts, which is how SuperSet scopes terminal scripts (local `mainRepoPath` + worktrees, not remotes). See ADR-0004.
