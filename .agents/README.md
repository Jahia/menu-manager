# Menu Manager harness

Project harness of `menu-manager`: menus built by hand in jContent, independent of the page tree, and
placed on pages by a component. Generic Jahia knowledge lives in AIStartupKit (`../AIStartupKit`, the
sole reference): read its `CLAUDE.md` first. This folder keeps only what is specific to this module.

| File | What it holds |
|---|---|
| `context/decisions.md` | Dated decisions, the spike's results, open questions |
| `context/plan.md` | Phases and their state |

## Layout

| Folder | What it is |
|---|---|
| `menu-manager/` | Java bundle (`org.jahia.community`): content types (`mnu`, `mnumix`), the resolver, the save service, the GraphQL API, the API scope for visitors, the `manageMenus` permission; the jContent Menus screen joins it in phase 3 |
| `menu-manager-views/` | JavaScript module (React 19): the views of `mnu:navigation` (phase 4) |

## Rules of this project

1. One resolver, in Java (`MenuResolverImpl`): views, the classic-templates header and headless clients
   all read `menuManager.resolvedMenu`. No view or client re-implements label fallback or access checks.
2. Everything runs with the caller's own session. The only other session is a guest one, used to tell
   an editor that an item is not public: it reads less than the editor, never more.
3. Text in the visitor's language beats the fallback language: label, then target title in the
   language, then label, then target title in the fallback language.
4. Refusals answer a code (`MenuException`), translated by the Menus screen; logs carry English.
