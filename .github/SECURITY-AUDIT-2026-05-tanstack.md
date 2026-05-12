# Supply-chain audit — TanStack npm compromise (May 2026)

**Reference incident:** "Mini Shai-Hulud" worm that compromised 84 versions across 42 `@tanstack/*` packages on 2026-05-11 (19:20–19:26 UTC). Attack chain: `pull_request_target` "Pwn Request" → GitHub Actions cache poisoning across the fork↔base trust boundary → runtime memory extraction of the npm OIDC token from the Actions runner during a trusted-publish workflow. Sources: TanStack postmortem, StepSecurity, Socket.

This document audits Vendure against the same attack patterns.

---

## TL;DR

| Area | Status |
| --- | --- |
| Exposure to compromised `@tanstack/*` versions | **Clean** — `bun.lock` was last touched 2026-05-05, six days before the compromise window. No node_modules in repo. No IOC files (`setup_bun.js`, `bun_environment.js`, `router_runtime.js`) present. |
| `bunfig.toml` `minimumReleaseAge` (7d) | **Strong** — `install.minimumReleaseAge = 604800` already blocks freshly-published malicious versions during normal `bun install`. |
| Lifecycle-script allowlist (`trustedDependencies`) | **Strong** — limited to `husky`, `better-sqlite3`, `puppeteer`. No publishable package defines `preinstall`/`postinstall`. |
| npm publishing identity | **OIDC trusted publishing** — no long-lived `NPM_TOKEN` secret. |
| `npm publish --provenance` | **Missing** — provenance attestations not generated. |
| Build runs in same job as the OIDC publish | **Yes** — `bun install` + `bun run build` execute before `npm publish` in the job that holds `id-token: write`. |
| `pull_request_target` workflows | **One** (`cla.yml`) — does not check out the PR head; risk is moderate, not critical. |
| Action pinning by commit SHA | **Partial** — first-party `actions/*` are pinned by tag; non-GitHub actions are mostly pinned by SHA. |
| Cross-fork cache poisoning (`actions/cache`) | **Low** — caches are scoped per ref by GitHub; PR caches cannot be restored by `push`-triggered jobs on `master`/`minor`. |

**No emergency action required.** The recommendations below are hardening, not remediation.

---

## 1. Were any of the compromised `@tanstack/*` versions installed?

`packages/dashboard/package.json` declares 7 direct `@tanstack/*` dependencies; 14 more come in transitively. Of these, 4 belong to families the TanStack postmortem confirmed as affected:

| Package | Family | Resolved in `bun.lock` |
| --- | --- | --- |
| `@tanstack/react-router` | router | `1.168.1` |
| `@tanstack/router-core` | router | `1.168.1` |
| `@tanstack/router-devtools` | router | `1.166.10` |
| `@tanstack/router-plugin` | router | `1.167.1` |

`@tanstack/query*`, `@tanstack/table*`, `@tanstack/virtual*`, `@tanstack/store*` are explicitly listed as clean in the postmortem. `@tanstack/start`, `@tanstack/db`, `@tanstack/pacer`, `@tanstack/ranger`, `@tanstack/config` are not in the lockfile.

`bun.lock` was last committed on 2026-05-05 (commit `3f253d3`, six days before the compromise window). The `minimumReleaseAge = 604800` (7-day) setting in `bunfig.toml` provides an additional safety net: even a `bun install` run today would not pick up versions published in the 2026-05-11 window without an explicit override.

**Repo-wide IOC sweep:** no files named `setup_bun.js`, `bun_environment.js`, or `router_runtime.js`. No occurrences of the string `bun_environment`.

**Action:** none, beyond not bumping these caret ranges until TanStack ships post-compromise patches with explicit provenance.

---

## 2. `pull_request_target` and "Pwn Request"

Only one workflow uses `pull_request_target`:

- `.github/workflows/cla.yml:5` — runs the `contributor-assistant/github-action` (pinned to commit SHA at line 30) to record CLA signatures.

Top-level permissions on `cla.yml:9-13` grant `contents: write`, `pull-requests: write`, `actions: write`, `statuses: write`, and the job mints a GitHub App token from `CI_BOT_APP_ID` / `CI_BOT_APP_PRIVATE_KEY`. The job does **not** check out the PR head or run any build/test/install of PR code — the action only reads PR metadata and writes a signature file to the base repo. That keeps it outside the canonical Pwn Request pattern.

**Residual risk:** if `contributor-assistant/github-action` is ever compromised upstream (it would have to be a re-tag of the pinned SHA, which is harder), it would inherit the broad token. The SHA pin mitigates this for the current version.

**Recommendation (low priority):** consider whether `contents: write` is genuinely required — the action writes to `license/signatures/version1/cla.json` on `master`, which it does need write access to, so this is probably correct. Document the reasoning inline in the workflow.

No other workflow uses `pull_request_target`.

---

## 3. npm publishing — trusted publishing + provenance + isolation

`.github/workflows/publish_to_npm.yml` is the single publish workflow (single-file is required for npm trusted publishing). Triggers: `release: [published]`, nightly `schedule`, and `workflow_dispatch`. The publish job has `id-token: write` (`publish_to_npm.yml:44-46`) and is correctly limited to `release`/`master`/`minor` refs in the matrix (`publish_to_npm.yml:56`).

Three concrete hardening items:

### 3.1 Add `--provenance` to every `npm publish` call

Current state (`publish_to_npm.yml:141`, `:146`, `:151`):

```bash
bunx lerna exec --no-private -- 'publish_dir=$(node -p "require(\"./package.json\").publishConfig?.directory || \".\"") && cd "$publish_dir" && npm publish --access public'
```

Without `--provenance`, the OIDC token is consumed for authentication only; npm does not record a SLSA attestation, so downstream consumers cannot independently verify that a given tarball came from this workflow on this commit. Adding `--provenance` makes the OIDC flow visibly stronger and produces a signed build attestation on every release.

### 3.2 Verify the npmjs.com trusted-publisher binding is pinned to branch + workflow

This cannot be audited from the repo — it has to be checked on npmjs.com for every Vendure package. The TanStack postmortem's primary structural finding was that OIDC trusted-publisher bindings without branch/workflow pinning let any code path in any workflow mint a publish-capable token. For every `@vendure/*` package on npm, confirm the trusted publisher is configured as:

- Repository: `vendurehq/vendure`
- Workflow file: `.github/workflows/publish_to_npm.yml`
- Environment / ref filter: pinned to `release`, `master`, and `minor` only (not `*`)

If any package has a looser binding, tighten it.

### 3.3 Reduce attack surface of the `id-token: write` job

Today, the publish job runs (in order): `bun install --frozen-lockfile` → `bun run build` (= `lerna run build`, which executes every package's `build` script) → `npm publish`. All of this happens inside the job that holds the OIDC token. Any code path reached by `bun run build` — including build scripts in workspace packages and any transitive dependency that ships a build-time plugin — can read the runner's env and exfiltrate the OIDC token. This is the exact "trusted code path can mint a publish-capable token" surface the postmortem warned about.

Two options, in order of impact:

1. **Split build from publish.** Build in a job without `id-token: write` and upload the resulting `dist/`, `lib/`, `package/` directories as artifacts. A second job downloads the artifacts and runs only `npm publish --provenance` — no `bun install`, no build scripts. Adds CI complexity but cleanly separates the OIDC trust boundary.
2. **At minimum, pass `--ignore-scripts` to `bun install`.** This won't help for the in-repo `bun run build` step, but it neutralises lifecycle scripts from any newly-introduced dependency. Note: Bun already gates lifecycle scripts via `trustedDependencies` so this is belt-and-braces.

(1) is the only option that fully closes the gap; (2) is cheap but partial.

---

## 4. Cache poisoning across fork↔base boundary

Two workflows use `actions/cache@v4`:

- `.github/workflows/build_and_test.yml:138-143` (Playwright browsers, key `playwright-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}`)
- `.github/workflows/publish_and_install.yml:174-179` (same key)

GitHub scopes caches per ref: a cache written from `refs/pull/N/merge` cannot be restored from `refs/heads/master`. The TanStack-style cross-boundary attack requires a workflow that (a) is triggered by a fork PR, (b) writes to a key, and (c) is later restored by a workflow running on `master`/`minor` with `id-token: write`. The `publish_to_npm.yml` workflow does not call `actions/cache` at all, so a PR cannot poison anything it consumes.

**No action required.**

---

## 5. `deploy_dashboard.yml` and `VERCEL_TOKEN`

`deploy_dashboard.yml:14` uses `pull_request` (not `pull_request_target`). GitHub does not expose repository secrets to workflows triggered from **fork** PRs under `pull_request`, so `secrets.VERCEL_TOKEN` is empty when a fork PR fires this workflow — the token cannot be exfiltrated by an external contributor.

For branches pushed directly to `vendurehq/vendure` (i.e. maintainer-owned feature branches), the token is available and the workflow runs untrusted-by-default repo code. The trust model here is: anyone who can push a branch to the main repo is already trusted with the Vercel token. That's a reasonable posture, but worth flagging so it's an explicit decision.

**No action required**, but if maintainer branch access ever broadens, revisit this.

---

## 6. Third-party action pinning

Non-GitHub actions are mostly pinned by commit SHA (good: `contributor-assistant/github-action`, `oven-sh/setup-bun`, `peter-evans/find-comment`, `peter-evans/create-or-update-comment`). GitHub-owned actions (`actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/create-github-app-token`) are pinned to major-version tags (`@v4`, `@v6`, `@v2`).

GitHub's hardening guide recommends SHA-pinning even GitHub-owned actions, on the theory that a compromised `actions/checkout` would be catastrophic across the ecosystem. Most projects accept the tag-pin tradeoff for these. The risk is real but low.

**Recommendation (low priority):** if you adopt SHA-pinning broadly, do it consistently across all workflows; Dependabot can automate the upgrades via the `package-ecosystem: github-actions` config.

---

## 7. Other findings

- `docs/package-lock.json` exists alongside the root `bun.lock`. The `docs/` Docusaurus build is private and not published to npm, but it is installed in `docs_ci.yml` and `generate_docs.yml` without the `minimumReleaseAge` protection that `bunfig.toml` provides for the rest of the repo. **Low priority:** migrate `docs/` to Bun, or accept the risk since the workflows have only `contents: read` permissions and no access to npm publishing.
- `SECURITY.md` is minimal (email-only intake, no disclosure timeline, no PGP key). Not directly relevant to this incident, but a good time to expand it — e.g. response SLA, public advisory process via GitHub Security Advisories.
- `@vendure/admin-ui` and `@vendure/dashboard` have no `files:` allowlist in their `package.json`. Both rely on `publishConfig.directory` or a curated source layout to control what ships. Acceptable, but an explicit `files:` field would make accidental publication of CI artifacts impossible.

---

## Recommended changes, ranked

1. **(High)** Verify trusted-publisher bindings on npmjs.com for every `@vendure/*` package pin to `vendurehq/vendure` + `.github/workflows/publish_to_npm.yml` + branch filter.
2. **(High)** Add `--provenance` to the three `npm publish` invocations in `publish_to_npm.yml`.
3. **(Medium)** Split build from publish so the `id-token: write` job runs only `npm publish --provenance` against pre-built artifacts.
4. **(Low)** SHA-pin `actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/create-github-app-token`.
5. **(Low)** Document the `cla.yml` permission scope rationale inline.
6. **(Low)** Expand `SECURITY.md` with disclosure process and SLA.
7. **(Low)** Add explicit `files:` allowlists to `@vendure/admin-ui` and `@vendure/dashboard`.

Items 1 and 2 are the only ones that meaningfully change the attacker calculus against the specific TanStack/Mini-Shai-Hulud pattern. The rest are general hardening.
