# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-06-06

### Added

- Direct LocalGPT workspace memory access (no `localgpt` binary spawn).
- Tools: `localgpt_status`, `localgpt_memory_search`, `localgpt_memory_get`, `localgpt_memory_save`, `localgpt_memory_log`.
- Commands: `/localgpt:status`, `/localgpt:search`, `/localgpt:remember`.
- Skill: `localgpt-memory`.
- Keyword search over `MEMORY.md` and `memory/*.md`.

### Notes

- Search is keyword-based; upstream hybrid semantic/sqlite-vec ranking is not replicated.
