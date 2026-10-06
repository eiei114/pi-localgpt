# Roadmap — pi-localgpt

This roadmap tracks the current state of `pi-localgpt` and lists bounded
maintenance seeds for the weekly maintenance planner. It is written to match
the **current unified MCP bridge architecture** (stable since `v0.3.0`); the
pre-`v0.3.0` direct-filesystem memory access pattern has been removed and is
not a target for future work.

> **Last refreshed:** 2026-10-06 (DOT-2155) — current release state, test suite,
> CI workflow, npm registry, and dependency audit re-verified.

> Scope note: this file is a living planning document, not a release contract.
> Seed items are intentionally small (30–90 minutes each). Promote a seed into
> a tracked issue when you intend to work on it, then mark it ✅ here.

---

## 1. Current state

| Area | Status |
|---|---|
| Staged release | **`v0.10.12`** (`package.json`; npm latest is `v0.10.12`) |
| Architecture | Unified **1-shot MCP bridge** — each tool spawns `localgpt-gen mcp-server --connect`, sends one request, exits. No persistent process. |
| Tool surface | **51 curated gen wrappers** (canonical `genToolMeta` count; excludes `localgpt_design_log_*` and legacy `localgpt_memory_save`/`localgpt_memory_log`) + `localgpt_gen_call` + design-log / vault / worldgen helpers |
| Design log | 4 `localgpt_design_log_*` tools on the bridge (`memory_search`/`_get`/`_save`/`_log`); `localgpt_memory_search`/`_get` read aliases; `localgpt_memory_save`/`_log` write aliases |
| Code health | `npm run typecheck` clean; **213 `node:test` cases** pass; strict TypeScript (`ES2022`, `NodeNext`) |
| CI/Release | Node 24 on `ci.yml` + `publish.yml` (`actions/checkout@v7`, `setup-node@v7`); auto-release + Trusted Publishing (no `NPM_TOKEN`) |
| Dependencies | `npm audit` reports **1 high transitive dev-only vulnerability** in `brace-expansion`; not shipped to npm consumers; follow-up seed recorded below |
| Skills | `skills/localgpt-gen/SKILL.md` + `skills/localgpt-memory/SKILL.md` |

### Release and staged work history

- **`v0.10.12` (published)** — Updated the Pi SDK dependencies to `0.99.1`;
  npm latest is verified at `v0.10.12`.
- **`v0.10.11`** — Completed unreachable-relay recovery hints (DOT-2049).
- **Post-release maintenance (2026-10-01–03)** — Deferred stderr sanitization
  until failures, preserved the bounded sanitized stderr tail (DOT-2085/DOT-2093),
  and added one-shot timeout cleanup coverage (DOT-2044).

- **`v0.1.0`** — Direct filesystem memory access. **Removed in `v0.3.0`.**
- **`v0.2.0`** — Gen MCP 1-shot bridge + first 27 curated gen tools.
- **`v0.3.0`** — **Breaking pivot:** removed v1 filesystem tools; unified all
  memory + gen tools onto the 1-shot MCP bridge.
- **`v0.4.0`** — Game-mechanics wrappers (player, NPC, triggers, physics,
  terrain, audio); reached ~50 curated tools.
- **`v0.4.1`** — Removed stale memory wording from README.
- **`v0.4.2`** — Renamed "memory" → "design log" user-facing wording; added
  backward-compatible `localgpt_memory_*` aliases; added local workspace helper
  libraries (`localgpt-config.ts`, `localgpt-workspace.ts`).

---

## 2. Themes for the next 1–2 releases

These themes guide which seeds to promote each week. They are deliberately
**post-pivot**: every item assumes the unified MCP bridge is the architecture.

- **Theme A — Finish the design-log rename.** Legacy `localgpt_memory_*` aliases
  have a documented removal target (`v0.12.0`); remaining work is migration
  nudges and eventual removal.
- **Theme B — Bridge robustness (done for current scope).** Stderr capture,
  configurable timeout, failure-path tests, timeout cleanup, and actionable
  offline/unreachable hints are covered in `v0.10.x` (DOT-1245, DOT-1683,
  DOT-2044, DOT-2049, DOT-2085, DOT-2093).
- **Theme C — Docs accuracy & onboarding.** Headline counts are self-checked via
  `tests/package-metadata.test.mjs`; remaining gaps are examples, bilingual
  SKILL coverage, and vault workflow discoverability.
- **Theme D — Dependency hygiene (follow-up needed).** The current dev tree has
  one high transitive `brace-expansion` advisory under
  `@earendil-works/pi-coding-agent`; it is not shipped to npm consumers and
  needs re-checking after the next Pi SDK update.

### Tentative release mapping

- **`v0.11.0`** — Theme C: examples directory + English SKILL summary —
  completed by DOT-1861/DOT-2015; retain as release history rather than an
  active target.
- **`v0.12.0`** — Theme A: remove `localgpt_memory_*` aliases per deprecation
  timeline; migration guide in CHANGELOG.

---

## 3. Candidate maintenance seeds

Each seed is bounded to **30–90 minutes** and written so the weekly planner can
promote it directly into an issue. Format: **What / Why / Acceptance / Theme /
Estimate**.

### ✅ Seed 1 — Decide the fate of the unwired local design-log libraries (DOT-1240)

- **Decision (2026-07-28):** **Remove** the unused `lib/design-log-*.ts`
  modules. All `localgpt_design_log_*` tools stay on the unified 1-shot MCP
  bridge (`memory_search`/`_get`/`_save`/`_log`). Offline filesystem fallback
  is out of scope — it would reintroduce the pre-`v0.3.0` direct-access path
  this project intentionally removed.
- **Kept:** `localgpt-config.ts` and `localgpt-workspace.ts` (used by
  `localgpt_status`, vault exports, and path guards).
- **PR:** DOT-1240

### ✅ Seed 2 — Reconcile the curated tools count (DOT-941 / DOT-1197)

- **Done:** Canonical count is **51 curated gen wrappers** (`scripts/count-curated-tools.mjs` +
  `npm run metadata:check`). README, `package.json`, `skills/localgpt-gen/SKILL.md`, and
  `tests/package-metadata.test.mjs` enforce the same number.

### ✅ Seed 3 — Set a deprecation timeline for `localgpt_memory_*` aliases (DOT-1554)

- **Done:** Documented planned removal in **`v0.12.0`** across `CHANGELOG.md`, `README.md`,
  and tool descriptions. Added a one-time `console.warn` on first legacy alias use
  (`lib/localgpt-memory-alias-deprecation.ts` + tests).

### ✅ Seed 4 — Capture stderr in the 1-shot MCP client (DOT-1245)

- **Done:** Failed bridge calls append a sanitized stderr excerpt; regression tests in
  `tests/gen-tools.test.mjs` cover initialize, tools/list, timeout, and empty-stderr paths.

### ✅ Seed 5 — Make the 1-shot client timeout configurable per tool (DOT-1683)

- **Done:** `localgpt_gen_call`, `localgpt_gen_blockout`, `localgpt_gen_refine`, and
  `localgpt_gen_regenerate` accept optional `timeoutMs`; `LOCALGPT_GEN_TIMEOUT_MS`
  env overrides the 30s default. Regression tests in `tests/gen-tools.test.mjs` prove
  param and env overrides reach the MCP client.

### ✅ Seed 6 — Add failure-path tests for the 1-shot client (DOT-1245)

- **Done:** `tests/gen-tools.test.mjs` covers MCP initialize errors, tools/list errors,
  tools/call timeout (with pre-timeout stderr), and empty-stderr failures.

### ✅ Seed 7 — Triage transitive dependency advisories (DOT-1010 refresh)

- **Baseline (2026-09-05):** `npm audit` reported **0 vulnerabilities**. The
  current audit now finds one high `brace-expansion` advisory under the dev-only
  Pi SDK tree; `files:` excludes `node_modules` from the npm tarball. Re-check
  after the next `@earendil-works/pi-*` bump; remediation remains a follow-up
  seed because the package is transitive and not shipped to consumers.

### ✅ Seed 8 — Add English usage summary to `skills/localgpt-gen/SKILL.md` (DOT-1861)

- **Done (2026-09-20):** `skills/localgpt-gen/SKILL.md` now starts with an
  English usage summary covering prerequisites, the WorldGen flow, direct scene
  edits, save/export tools, and design-log capture.
- **Acceptance:** English summary block is present; skill front matter remains
  unchanged so Pi can still load the skill.
- **Theme:** C

### ✅ Seed 9 — Add `examples/` WorldGen pipeline transcript (DOT-2015)

- **Done (2026-09-29):** Added `examples/worldgen-pipeline.md` with an end-to-end
  plan → blockout → populate → evaluate → refine transcript and linked it from
  the README. No runtime code changes were required.
- **Theme:** C · **Estimate:** 45–60 min

### Backlog seeds (lower priority / needs maintainer input)

- 🌱 **Remove deprecated memory aliases.** Remove the `localgpt_memory_*` aliases
  at the planned `v0.12.0` boundary, add the migration note, and update tests.
  *(Theme A, 60–90 min; maintainer review required.)*
- 🌱 **ROADMAP self-check in CI.** Extend `tests/package-metadata.test.mjs` to
  assert at least three 🌱 seeds exist so planner drift is caught automatically.
  *(Theme C, ~30 min.)*
- 🌱 **Re-check transitive audit after the next Pi SDK bump.** Verify whether
  `brace-expansion` is fixed upstream; if not, document why no direct override
  is safe. *(Theme D, 30–45 min.)*

---

## 4. Triaged / out of scope

- **Pre-`v0.3.0` direct filesystem memory access** — intentionally removed; do
  not restore. Any imported issue referencing `localgpt:search`,
  `localgpt:remember`, `localgpt:init`, or `lib/memory-*.ts` predates the pivot
  and should be re-scoped or closed against the current bridge architecture.
- **`DOT-207` (backlog, imported)** — originates from a pre-pivot import and is
  unlikely to reflect the unified MCP bridge. **Validate against the current
  codebase before referencing or acting on it**; re-scope or close if it
  assumes the removed filesystem pattern.

---

## 5. How to use this roadmap

1. The weekly maintenance seed planner reads **Section 3** and promotes 1–3
   seeds into issues per week.
2. When a seed is completed, mark it ✅ with the PR/issue link and move it under
   the relevant release in **Section 2**.
3. Keep release versions and the "Current state" table in sync with
   `package.json` / `CHANGELOG.md` after each release.
4. Add new seeds under Section 3 as debt is discovered; retire stale ones into
   Section 4.
