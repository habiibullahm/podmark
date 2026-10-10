# PodMark Branching Strategy

PodMark follows **trunk-based development**. The default branch is **`master`** (not `main`), and it is the only long-lived branch. The goal is fast, safe integration of small changes, with production deployments built from the trunk.

## Branches

| Branch | Purpose | Lifetime |
| --- | --- | --- |
| `master` | Protected integration trunk, always buildable/releasable | Permanent |
| `feat/<short-topic>` | Small feature or feature slice | Short-lived |
| `fix/<short-topic>` | Bug fix | Short-lived |
| `hotfix/<short-topic>` | Urgent production fix, based on current `master` | Short-lived |
| `refactor/<short-topic>` | Behavior-preserving cleanup | Short-lived |
| `test/<short-topic>` | Focused automated test improvements | Short-lived |
| `chore/<short-topic>` | Tooling, CI, dependencies, configuration | Short-lived |
| `docs/<short-topic>` | Documentation only | Short-lived |

Use lowercase kebab-case and a concise, descriptive topic. Optionally include an issue number, e.g. `feat/123-transcript-search`. Avoid personal, ambiguous, or date-only names.

**Do not create persistent `develop`, `staging`, `release/*`, or integration branches.** Avoid stacked PRs. If an exceptional dependency requires one, retarget the dependent PR to `master` immediately after its prerequisite merges.

## Standard change workflow

1. Update local `master` from `origin/master`; branch from that exact trunk, not another feature branch.
2. Implement one narrowly scoped change. Keep incomplete or risky functionality disabled behind a safe-default-off feature flag. For schema changes, use backward-compatible migrations and separate expand/contract steps when necessary.
3. Push the branch and open a PR **targeting `master`**. A draft PR is fine for early review but is not mergeable until ready.
4. Run the relevant checks (`npm run typecheck`, `npm run lint`, `npm run build`, and applicable automated tests). CI must pass. Review changes, security implications, database compatibility, and deployment impact.
5. Get the repository owner's approval. Prefer **squash merge** to keep `master` linear and easy to follow. Never bypass failing required checks or push directly to `master`.
6. Delete the merged branch. Start the next task from the latest `master`.

Target **one working day per branch**, at most a few days. If a branch grows stale or a PR becomes too large, split it into smaller releasable increments rather than keeping it open for weeks.

```bash
git switch master
git pull --ff-only origin master
git switch -c feat/transcript-search

# Make changes, run checks, then commit and push.
git push -u origin feat/transcript-search

# Open PR: feat/transcript-search -> master
```

To incorporate new trunk changes, fetch and rebase your **own** short-lived branch onto `origin/master`, or merge `origin/master` if others share that branch. Never rewrite a shared branch without coordination.

## Review and merge policy

- PRs must explain **what changed, why, tests run, risks, and any config/migration impact**; include UI screenshots when relevant.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.) and a descriptive PR title.
- Do not merge failing CI, changes that break existing user journeys, or schema changes that are incompatible with the current running version.
- Configure branch protection/rulesets for `master` to require PR review and passing checks; documenting the rule alone does not enforce it.
- If a regression reaches `master`, fix forward with a small PR or roll back the affected deployment/commit as appropriate.

## Releases, previews, and hotfixes

- **PR branches:** run CI and get a Vercel **preview** deployment; they must never deploy production or run production migrations.
- **`master` pushes/merges:** Vercel deploys production automatically; CI applies Neon migrations (backward-compatible only).
- **Manual workflows:** must not publish/deploy production when invoked from a non-`master` ref.
- **Versioning:** use optional release tags on commits already on `master`; tags are not separate release branches.
- **Hotfixes:** branch `hotfix/<topic>` from latest `master`, run focused tests, open an expedited PR to `master`, obtain approval, merge and redeploy. If an immediate restore is needed, use Vercel **Instant Rollback** (promote the previous production deployment) while the fix is prepared.

**One-line rule:** `master` → short-lived branch → focused PR to `master` → green CI + approval → squash merge → Vercel production → delete branch.
