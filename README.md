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

## Requirements

- Jahia 8.2.1.0 or later (the views module; the Java bundle itself declares 8.2.0.0), with
  jContent 3.7 to 3.x and GraphQL provider (`graphql-dxm-provider`) 3.5 or later.
- The JavaScript modules engine 1.3 to 1.x, for the views (`menu-manager-views`).
- No configuration, no external service. A template set whose areas accept the component: any area
  that takes Jahia's navigation components (`jmix:navMenuComponent`) or any droppable content (a
  classic-templates Free zone).

## Using it

1. Enable **Menu Manager** and **Menu Manager views** on the site. Site administrators hold
   **manageMenus** (it sits under `site-admin`); another role that builds menus needs it **and**
   `publish`, since a menu reaches visitors when it is published from the screen.
2. jContent > **Additional > Menus**: create a menu, add pages (chosen in the site's tree with
   jContent's own tree selector, optionally with their subpages), sections, internal links (any content, through the picker) and external links; drag
   items to order and nest them (or use each item's Move links); translate the labels by switching
   the language; **Save**, then **Publish**.
3. Add the **Menu** component to a page (a Free zone on a classic-templates site), choose the menu,
   the levels shown and its accessible name, and its layout in **Layout > View**.

In Page Builder, each Menu component says which menu it shows and links to it: **Edit this menu**
opens jContent > Menus on that menu (`/jahia/jcontent/<site>/<language>/apps/menuManager?menu=<path>`).

## Known limitations

- **manageMenus decides who uses the Menus screen and its API, not who may write the menus.** Menus
  are content under `/sites/<site>/menus`, with the site's own rights: a user who may write content
  there can change it through Jahia's generic GraphQL or REST APIs, outside the screen and its
  revision check. Restrict the folder's rights when that matters.
- With **manageMenus** but without **publish**, a user saves menus visitors never see, and a menu
  they delete stays on the live site until someone who may publish removes it.
- A page item with **Include the page's subpages** lists at most 500 subpages.
- A page item without a promotion of its own shows the page's classic-templates promotion
  (`ctplmix:navPromo`), and classic-templates' "Hide from navigation" (`ctplHideFromNav`) is honoured
  with Jahia's own flag; both are read only when classic-templates is installed.

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
and to neutral values otherwise. A theme restyles every menu by setting them on `:root`, `body` or
any element around a menu (a section of its own).

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

## Tests

`tests/` is the Cypress suite (its own Yarn 1 project, `@jahia/cypress`), run against a Jahia where
both modules, `javascript-modules-engine` 1.3 and classic-templates are installed
(`tests/provisioning-manifest-build.yml` lists them for CI). Each spec creates its sites and users
and deletes them after.

```bash
cd tests && yarn install --frozen-lockfile
JAHIA_URL=http://localhost:8080 SUPER_USER_PASSWORD=root1234 yarn e2e:ci
```

| Spec | Covers |
|---|---|
| `happy-path` | Build a menu of every kind of item through the API, publish, render on live in EN and FR (fallback), each view picked in Layout > View, the current page, a published change through the cache, the button style |
| `authorization` | Site administrators manage menus; an editor (past the API filter), another site's administrator and a guest are refused every field of the Menus screen; a guest reads `resolvedMenu` only |
| `edge-cases` | Every refusal of the save API (stale revision, addresses, depth, size, values, targets) leaves the menu as it was; markup characters stay text; fallback language; items hidden per language; depth; subpages; deleted and unpublished targets |
| `acl-and-cache` | A page with broken ACL inheritance: shown to the users who may read it only, in the API and on live; root then guest, two users with the same rights then others, a guest warming the cache first |
| `menus-screen` | The Menus screen: create a menu, pages with the ChoiceTree, a section, an external link, a Move button, a real pointer drag, save; full width; no screen for an editor |
| `accessibility` | axe (WCAG 2.1 AA) on the four views, panels closed and open, and on the Menus screen |

## CI and releases

GitHub Actions run Jahia's shared [jahia-modules-action](https://github.com/Jahia/jahia-modules-action)
workflows:

| Workflow | When | What |
|---|---|---|
| `on-code-change.yml` | every pull request that changes code | module signature, dependency vulnerabilities, lint and type-check of the Menus screen, the views and the Cypress suite (`yarn lint` carries the Sonar rules), build with unit tests, SonarQube, the Cypress suite on Jahia 8.2.3.2 |
| `on-merge.yml` | push to `main` | build, SBOM to Dependency-Track, SNAPSHOT to Nexus |
| `nightly.yml` | every night | the Cypress suite on the modules built from `main` |
| `schedule-sonar.yml` | Monday, Wednesday, Friday | full SonarQube analysis of `main` with OWASP Dependency-Check |
| `chachalog-*.yml` | pull requests, push to `main` | checks the changelog fragment, opens the release pull request |
| `on-release.yml` | a GitHub prerelease | Maven release of both modules, signature, Nexus promotion |

Dependabot keeps the three JavaScript projects and the Maven build current, and holds back what
would break jContent or the views (React 18, the Module Federation singletons, css-loader 7, the
JavaScript modules library, the Jahia parent; reasons in `.github/dependabot.yml`).

The private `jahia-security-scan` rules run locally before a release, over the whole tree:

```bash
semgrep scan --config ../jahia-security-scan/tools/semgrep-harness/rules/jahia --exclude node_modules --exclude node --exclude target --exclude dist --exclude 'src/main/resources/javascript/apps' .
```

The four GraphQL fields named like admin operations (`createMenu`, `updateMenu`, `deleteMenu`,
`editableMenu`) carry a `nosemgrep` with the reason: `manageMenus` is a site permission, checked on
the site by the server, which `@GraphQLRequiresPermission` (a check on the server root) cannot express.

Every pull request carries a changelog fragment in `.chachalog/` (`.github/changelog-fragments.md`);
the two modules share one version. To release:

1. Merge the **chore: release menu-manager @ vX.Y.Z** pull request the bot opens.
2. Create a prerelease on `main` tagged in Jahia's form, `X_Y_Z` (`1_0_0`), titled
   `menu-manager vX.Y.Z`, with the `CHANGELOG.md` section as notes.
3. `on-release.yml` runs the release. It pushes as the org CI account, which needs write access to
   this repository (a repository admin grants it). Without it the release fails at its first push and
   is done by hand (AIStartupKit `jahia-release-and-ci.md`, "Manual release when the release workflow
   cannot run").
4. The release writes the version into both `package.json` files and commits them before the poms
   (`release-prepare` profile, `.m2/sync-version.mjs`), so the views package is not shipped as a
   snapshot. Check it: `tar -xOf menu-manager-views-X.Y.Z.tgz package/package.json` shows the version
   and `"snapshot": false`.
5. Nothing attaches the packages to the GitHub release: upload `menu-manager-X.Y.Z.jar` and
   `menu-manager-views-X.Y.Z.tgz` from the Nexus release (or from a build of the tag) to it.

## Licence

MIT
