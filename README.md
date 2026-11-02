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

> Status: in development (phase 4 of 8). Next: classic-templates integration, Cypress tests, release.

## Using it

1. Enable **Menu Manager** and **Menu Manager views** on the site, and grant **manageMenus** (under
   site-admin) to the roles that build menus.
2. jContent > **Additional > Menus**: create a menu, add pages (tick them, optionally with their
   subpages), sections, internal links (any content, through the picker) and external links; drag
   items to order and nest them (or use each item's Move links); translate the labels by switching
   the language; **Save**, then **Publish**.
3. Add the **Menu** component to a page (a Free zone on a classic-templates site), choose the menu,
   its layout (horizontal bar with dropdowns, vertical list, columns), the levels shown and its
   accessible name.

## Modules

| Module | What it does |
|---|---|
| `menu-manager` | Content types, the resolver, the GraphQL API, the visitor API scope, the `manageMenus` permission, the jContent Menus screen |
| `menu-manager-views` | The views of the Menu component (`mnu:navigation`): horizontal bar with dropdowns, vertical list, columns |

## Theming

The views use their own tokens (`--mnu-text`, `--mnu-muted`, `--mnu-accent`, `--mnu-action`,
`--mnu-on-action`, `--mnu-surface`, `--mnu-border`, `--mnu-radius`, `--mnu-shadow`, `--mnu-gap`,
`--mnu-font`, `--mnu-focus`...), which default to the classic-templates tokens when the site has them
and to neutral values otherwise. A theme restyles every menu by setting them.

## GraphQL

- `menuManager { resolvedMenu(menu, language, workspace, currentPath, maxDepth) }`: a menu as the caller
  may see it. Open to the pages of a site for their visitors (API scope `menu-manager_resolve`, origin
  hosted). `dependencies` lists what a cached rendering must be flushed on.
- `menuManager { menus(siteKey, language) editableMenu(path, language) }` and the mutations `createMenu`,
  `updateMenu`, `duplicateMenu`, `deleteMenu`, `saveMenu(path, language, revision, tree)`: the Menus
  screen's API, for users holding `manageMenus` on the site. A save that names an older revision is
  refused with `conflict`.

## Build

Maven 3.8 and JDK 17 (`mise.toml`): `mvn clean install` builds both modules and runs every test (Java, the Menus screen, the views).

## Licence

MIT
