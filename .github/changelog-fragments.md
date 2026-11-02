# Changelog fragments

The changelog of this module is assembled from fragment files in `.chachalog/`. The
`Chachalog - Prepare Changelog` workflow aggregates them into `CHANGELOG.md` and opens a "prepare
next release" pull request that also bumps `.chachalog/.version`.

Add one fragment per pull request, CI and docs changes included. Name the file after the change it
describes (`mega-menu-view.md`, `promotion-switch.md`): two pull requests in flight must not
pick the same name, and a name that describes its own change rarely collides.

```markdown
---
# Allowed version bumps: patch, minor, major
menu-manager: minor
---

Added a mega menu view with one column per child and the item's promotion.
```

- The package name is `menu-manager` for every change, whichever module it touches (`menu-manager`, `menu-manager-views`, `tests/`): the two modules are released together, with one version.
- The bump matches the version line in development, read from the `-SNAPSHOT` in `pom.xml`
  (`1.1.0-SNAPSHOT` is `minor`, `1.0.1-SNAPSHOT` is `patch`, a breaking change is `major`).
  Until 1.0.0 is released, `.version` is `0.0.0` and fragments say `major`.
- Write the note per `.github/instructions/changelog.instructions.md`: one past-tense sentence
  under 120 characters, the outcome a user sees, no class or method names.

`.version` holds the last released version and is maintained by the release pull request.

This guide lives in `.github/` rather than in `.chachalog/`, because chachalog treats **every**
markdown file in that folder as a fragment: a README kept there is consumed and deleted by the
first release.
