# Menu Manager

Menus built by hand in jContent, independent of the page tree, for Jahia 8.2.

- A site holds as many menus as it needs. Each is a tree of **pages** (optionally followed by their
  subpages), **sections** (a heading with no link), **internal links** and **external links**, three
  levels deep.
- Labels are translated per language. A label missing in a language falls back: the label in the
  language, then the target's title in the language, then the label in the menu's fallback language,
  then the target's title in it. Any item can be switched off in a language.
- What a visitor may not read (an item, or the page it points to) is left out of the menu they see,
  with everything under it.

> Status: in development (phase 2 of 8). The jContent Menus screen and the component's views come next.

## Modules

| Module | What it does |
|---|---|
| `menu-manager` | Content types, the resolver, the GraphQL API, the visitor API scope, the `manageMenus` permission |

## GraphQL

- `menuManager { resolvedMenu(menu, language, workspace, currentPath, maxDepth) }`: a menu as the caller
  may see it. Open to the pages of a site for their visitors (API scope `menu-manager_resolve`, origin
  hosted). `dependencies` lists what a cached rendering must be flushed on.
- `menuManager { menus(siteKey, language) editableMenu(path, language) }` and the mutations `createMenu`,
  `updateMenu`, `duplicateMenu`, `deleteMenu`, `saveMenu(path, language, revision, tree)`: the Menus
  screen's API, for users holding `manageMenus` on the site. A save that names an older revision is
  refused with `conflict`.

## Build

Maven 3.8 and JDK 17 (`mise.toml`): `mvn clean install`.

## Licence

MIT
