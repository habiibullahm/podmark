# PodMark Branching Strategy

PodMark follows **trunk-based development**. The default branch is **`main`** (renamed from `master`), and it is the only long-lived branch. The goal is fast, safe integration of small changes, with production deployments built from the trunk.

## Branches

| Branch | Purpose | Lifetime |
| --- | --- | --- |
| `main` | Protected integration trunk, always buildable/releasable | Permanent |
| `feat/<short-topic>` | Small feature or feature slice | Short-lived |
| `fix/<short-topic>` | Bug fix | Short-lived |
| `hotfix/<short-topic>` | Urgent production fix, based on current `main` | Short-lived |
| `refactor/<short-topic>` | Behavior-preserving cleanup | Short-lived |
| `test/<short-topic>` | Focused automated test improvements | Short-lived |
| `chore/<short-topic>` | Tooling, CI, dependencies, configuration | Short-lived |
| `docs/<short-topic>` | Documentation only | Short-lived |

Use lowercase kebab-case and a concise, descriptive topic. Optionally include an issue number, e.g. `feat/123-transcript-search`. Avoid personal, ambiguous, or date-only names.

**Do not create persistent `develop`, `staging`, `release/*`, or integration branches.** Avoid stacked PRs. If an exceptional dependency requires one, retarget the dependent PR to `main` immediately after its prerequisite merges.

## Standard change workflow

1. Update local `main` from `origin/main`; branch from that exact trunk, not another feature branch.
2. Implement one narrowly scoped change (local setup and checks: README → **Local development**). Keep incomplete or risky functionality disabled behind a safe-default-off feature flag. For schema changes, use backward-compatible migrations and separate expand/contract steps when necessary.
3. Push the branch and open a PR **targeting `main`**. A draft PR is fine for early review but is not mergeable until ready.
4. Run the relevant checks (`npm run typecheck`, `npm run lint`, `npm run build`, and applicable automated tests). CI must pass. Review changes, security implications, database compatibility, and deployment impact.
5. Get the repository owner's approval. Prefer **squash merge** to keep `main` linear and easy to follow. Never bypass failing required checks or push directly to `main`.
6. Delete the merged branch. Start the next task from the latest `main`.

Target **one working day per branch**, at most a few days. If a branch grows stale or a PR becomes too large, split it into smaller releasable increments rather than keeping it open for weeks.

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/transcript-search

# Make changes, run checks, then commit and push.
git push -u origin feat/transcript-search

# Open PR: feat/transcript-search -> main
```

To incorporate new trunk changes, fetch and rebase your **own** short-lived branch onto `origin/main`, or merge `origin/main` if others share that branch. Never rewrite a shared branch without coordination.

## Review and merge policy

- PRs must explain **what changed, why, tests run, risks, and any config/migration impact**; include UI screenshots when relevant.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.) and a descriptive PR title.
- Do not merge failing CI, changes that break existing user journeys, or schema changes that are incompatible with the current running version.
- `main` is protected on GitHub: changes land only through a PR, the CI `test` check must pass, force pushes and deletion are blocked, and the rules apply to admins too.
- If a regression reaches `main`, fix forward with a small PR or roll back the affected deployment/commit as appropriate.

## Releases, previews, and hotfixes

- **PR branches:** run CI and get a Vercel **preview** deployment; they must never deploy production or run production migrations.
- **`main` pushes/merges:** Vercel deploys production automatically; CI applies Neon migrations (backward-compatible only).
- **Manual workflows:** must not publish/deploy production when invoked from a non-`main` ref.
- **Versioning:** use optional release tags on commits already on `main`; tags are not separate release branches.
- **Hotfixes:** branch `hotfix/<topic>` from latest `main`, run focused tests, open an expedited PR to `main`, obtain approval, merge and redeploy. If an immediate restore is needed, use Vercel **Instant Rollback** (promote the previous production deployment) while the fix is prepared.

**One-line rule:** `main` → short-lived branch → focused PR to `main` → green CI + approval → squash merge → Vercel production → delete branch.
