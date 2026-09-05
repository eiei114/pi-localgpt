# Roadmap — pi-localgpt

This roadmap tracks the current state of `pi-localgpt` and lists bounded
maintenance seeds for the weekly maintenance planner. It is written to match
the **current unified MCP bridge architecture** (stable since `v0.3.0`); the
pre-`v0.3.0` direct-filesystem memory access pattern has been removed and is
not a target for future work.

> **Last refreshed:** 2026-09-05 (DOT-1010) — re-enabled roadmap-driven seeding
> after workspace repair; current-state table verified against `package.json`,
> CI workflows, and `npm audit`.

> Scope note: this file is a living planning document, not a release contract.
> Seed items are intentionally small (30–90 minutes each). Promote a seed into
> a tracked issue when you intend to work on it, then mark it ✅ here.

---

## 1. Current state

| Area | Status |
|---|---|
| Latest release | **`v0.10.5`** (`package.json`; npm tag pending until publish workflow runs) |
| Architecture | Unified **1-shot MCP bridge** — each tool spawns `localgpt-gen mcp-server --connect`, sends one request, exits. No persistent process. |
| Tool surface | **51 curated gen wrappers** (canonical `genToolMeta` count; excludes `localgpt_design_log_*` and legacy `localgpt_memory_save`/`localgpt_memory_log`) + `localgpt_gen_call` + design-log / vault / worldgen helpers |
| Design log | 4 `localgpt_design_log_*` tools on the bridge (`memory_search`/`_get`/`_save`/`_log`); `localgpt_memory_search`/`_get` read aliases; `localgpt_memory_save`/`_log` write aliases |
| Code health | `npm run typecheck` clean; **209 `node:test` cases** pass; strict TypeScript (`ES2022`, `NodeNext`) |
| CI/Release | Node 24 on `ci.yml` + `publish.yml` (`actions/checkout@v7`, `setup-node@v7`); auto-release + Trusted Publishing (no `NPM_TOKEN`) |
| Dependencies | `npm audit` reports **0 vulnerabilities** (dev tree via `@earendil-works/pi-coding-agent`; not shipped to npm consumers) |
| Skills | `skills/localgpt-gen/SKILL.md` + `skills/localgpt-memory/SKILL.md` |

### Release history (architecture-relevant)

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
- **Theme B — Bridge robustness (mostly done).** Stderr capture, configurable
  timeout, and failure-path tests landed in `v0.10.x` (DOT-1245, DOT-1683).
  Residual work: richer offline/unreachable hints in `gen-status`.
- **Theme C — Docs accuracy & onboarding.** Headline counts are self-checked via
  `tests/package-metadata.test.mjs`; remaining gaps are examples, bilingual
  SKILL coverage, and vault workflow discoverability.
- **Theme D — Dependency hygiene (monitoring).** `npm audit` is clean as of
  `v0.10.5`; re-run after `@earendil-works/pi-*` bumps and record blast radius.

### Tentative release mapping

- **`v0.11.0`** — Theme C: examples directory + English SKILL summary (or
  explicit Japanese-only decision).
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

- **Done (2026-09-05):** `npm audit` reports **0 vulnerabilities** on the
  current dev tree. Blast radius remains dev-only (`files:` excludes
  `node_modules` from the npm tarball). Re-check after `@earendil-works/pi-*`
  bumps; no fix required at `v0.10.5`.

### 🌱 Seed 8 — Add English summary to `skills/localgpt-gen/SKILL.md`

- **What:** `skills/localgpt-gen/SKILL.md` is Japanese-only while README and
  other docs are English. Add a short English summary section at the top, or
  document in ROADMAP/CONTRIBUTING that Japanese-only is intentional.
- **Why:** Reduces onboarding friction for non-Japanese contributors and aligns
  with the English-first docs elsewhere in the repo.
- **Acceptance:** English summary block **or** explicit maintainer decision
  recorded in CONTRIBUTING; skill still loads in Pi.
- **Theme:** C · **Estimate:** 30–45 min

### 🌱 Seed 9 — Add `examples/` WorldGen pipeline transcript

- **What:** Create `examples/worldgen-pipeline.md` with one end-to-end transcript
  (plan → blockout → populate → evaluate → refine) using the curated tool names.
- **Why:** New users lack a concrete walkthrough; README quick start is terse.
- **Acceptance:** Markdown example committed; README links to it; no runtime code
  changes required.
- **Theme:** C · **Estimate:** 45–60 min

### 🌱 Seed 10 — Improve unreachable-bridge hint in `gen-status`

- **What:** When `localgpt-gen` relay is unreachable, extend
  `formatGenStatus`/`inspectGenStatus` output with setup steps (start Bevy window,
  verify port 9878, check binary on PATH).
- **Why:** Users hit relay failures often; current messages are terse compared
  to README prerequisites.
- **Acceptance:** Status output includes actionable next steps; unit test covers
  the unreachable path.
- **Theme:** B · **Estimate:** 30–60 min

### Backlog seeds (lower priority / needs maintainer input)

- 🌱 **ROADMAP self-check in CI.** Optionally extend
  `tests/package-metadata.test.mjs` to assert at least three 🌱 seeds exist
  so planner drift is caught automatically. *(Theme C, ~30 min.)*
- 🌱 **Publish smoke for v0.10.5.** Confirm npm tag matches `package.json` after
  Trusted Publishing run; update Section 1 release note if tag lags. *(Theme D,
  ~20 min — human npm publish may be required.)*

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
