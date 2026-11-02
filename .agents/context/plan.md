# Plan

| Phase | What | State |
|---|---|---|
| 1 | Spike: fallback on live, `jmix:navMenuComponent` in classic-templates areas, server-side GraphQL from views, Moonstone version, prefix | Done 2026-11-02 |
| 2 | Content types, resolver, save service, GraphQL API, visitor API scope, unit tests | Done 2026-11-02 (local stack, gba-hk) |
| 3 | jContent Menus screen (React 18, Moonstone 2.20, webpack, dnd-kit) | Done 2026-11-02 (local stack, gba-hk); pointer drag and drop still to check in a visible browser (phase 6) |
| 4 | `menu-manager-views` JS module: horizontal, vertical, columns | Done 2026-11-02 (local stack, exactlytest Free zone): preview and live, guest with an item locked, no cache leak root then guest |
| 5 | classic-templates PRs: areas accept `jmix:navMenuComponent`; header menu source | Built 2026-11-02 on branches `feat/nav-menu-component-areas` and `feat/header-menu-source` (classic-templates), tested together on the local stack (integration build 0.10.0-SNAPSHOT); not pushed, waiting for the user |
| 6 | Cypress: happy path, refused rights, broken target, fallback, keyboard moves, ACL leak test; accessibility | Done 2026-11-02: 6 specs, 31 tests in `tests/`, all green on the local stack; Moonstone's filled buttons left out of the contrast check (user decision) |
| 7 | Docs, icons, EN/FR, Store pack, CI, GitHub repository (Jahia/menu-manager, jahians Maintain) | |
| 8 | Demo on the Molex site | |
