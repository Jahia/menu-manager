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
2. jContent > **Additional > Menus**: create a menu, add pages (chosen in the site's tree with
   jContent's own tree selector, optionally with their subpages), sections, internal links (any content, through the picker) and external links; drag
   items to order and nest them (or use each item's Move links); translate the labels by switching
   the language; **Save**, then **Publish**.
3. Add the **Menu** component to a page (a Free zone on a classic-templates site), choose the menu,
   the levels shown and its accessible name, and its layout in **Layout > View**.

## Layouts

Each layout is a view of its own (one file in `menu-manager-views/src/components/Navigation/`),
picked with Jahia's view field (`j:view`) like any other content; without a view, the horizontal bar.

| View | What it draws |
|---|---|
| Horizontal bar (default) | Top-level items in a bar; an item with children opens a dropdown panel (button, Escape, click outside; hover and focus without JavaScript); a **Menu** button under 768 px |
| Mega menu (`mega`) | The same bar; each panel takes the menu's full width: the item and its description, one column per child with its own items, and the item's **promotion** |
| Vertical list (`vertical`) | Every level nested |
| Columns (`columns`) | Top-level items as columns (a footer) |

## Promotions

A top-level item can carry a promotion, shown by the mega menu beside its columns: an image (with its
own text alternative, else the image's title), a title, a text and a button to a page or content of
the platform, or to an address. It is written in the Menus screen (the item's **Promotion** section),
per language like the labels. Without a title of its own, a page item shows its page's
classic-templates **Menu promotion** (`ctplmix:navPromo`) when the page has one, so promotions written
on pages keep working.

## Modules

| Module | What it does |
|---|---|
| `menu-manager` | Content types, the resolver, the GraphQL API, the visitor API scope, the `manageMenus` permission, the jContent Menus screen |
| `menu-manager-views` | The views of the Menu component (`mnu:navigation`): horizontal bar, mega menu, vertical list, columns |

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
