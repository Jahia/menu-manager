# Decisions

## 2026-11-02: the module (user)

| Topic | Decision |
|---|---|
| Name | `menu-manager`, prefix `mnu` / `mnumix` (free on the local stack and the Molex cloud) |
| Packaging | Monorepo: Java bundle (types, resolver, GraphQL, Menus screen) + JS module (views), Formidable's layout |
| Languages | One tree shared by every language; labels per language; an item can be switched off per language (`j:invalidLanguages`) |
| classic-templates | Both: its areas accept components marked `jmix:navMenuComponent`, and its header gets a menu source (page tree or a custom menu); two PRs on classic-templates |
| Repository | Jahia org, public, `org.jahia.community` group; jahians Maintain access when created |
| Access rights | Preserved at rendering (user): a target or item the visitor cannot read is left out with its children |
| Defaults (agent, not objected) | A page item whose page is switched off in a language is hidden in it; internal links may point to other sites; Save is explicit; three levels at most |

## 2026-11-02: spike results (local stack, Jahia 8.2.3.2, jContent 3.8.1)

| Question | Result |
|---|---|
| Does an untranslated node vanish on live? | No: English-only content nodes stay visible on live in zh_HK, for guest too (gba-hk, `j:mixLanguage` false). A label is never mandatory; the resolver reads the fallback language itself |
| Marker for template-set areas | `jmix:navMenuComponent` (core, no properties). A second residual child definition `+ * (jmix:navMenuComponent)` added to an area type holding content installs as a minor change and accepts the component. Jahia's legacy `jnt:navMenu` wears it too: a template set filters the editor with its area's allowed types |
| Header reading a custom menu | Through `server.gql.executeQuerySync` on `menuManager.resolvedMenu` (one resolver); not verified yet that it runs as the visitor (phase 4) |
| Host versions | jContent 3.8.1, Moonstone 2.20.3, React 18.3.1, react-i18next 11, app-shell 3.3.0 on the local stack and the Molex cloud: webpack, Vite-ready. Moonstone has no drag-and-drop tree: dnd-kit |
| Where menus live | `/sites/<site>/menus` (the site node accepts any child) |
| Component's menu picker | `choicelist[nodes='$currentSite/menus;mnu:menu']` on a weakreference (not checked in the editor yet) |

## 2026-11-02: phase 2 checks (local stack, gba-hk)

- Save, stale revision (`conflict`), refused address (`badUrl`), editable read in zh_HK with fallback labels.
- Resolution on live in en_HK and zh_HK: included subpages, current page and trail, an item switched off in zh_HK, a Chinese-only section label.
- Label order (fixed after the first run): the page's Chinese title beat the English label once the order put the language first.
- Visitors: `menuManager.resolvedMenu` answers through the module's API scope with the site as `Origin`; without it, and for `editableMenu`, `saveMenu` and `jcr`, `Permission denied`.
- Access rights: an item whose ACL inheritance is broken disappears from the guest's menu, stays in root's, and the editor view reports `publicAccess: false`.
- Left on the local stack for phase 3: the test menu `/sites/gba-hk/menus/main-menu-test` (published).

## 2026-11-02: phase 3, the Menus screen (local stack, gba-hk)

| Topic | Decision or finding |
|---|---|
| Place | jContent > Additional > Menus (`adminRoute` on `jcontent:85`), gated by jContent with `manageMenus` and the module enabled on the site; remounts per site |
| Layout | Jahia's panel layout; left: Add items (pages with search and ticks, section, internal link through `CE_API.openPicker` type `editoriallink`, external link); right: structure, preview, settings. Stacks under 1100 px |
| Editing language | Opens in jContent's content language; menu and language pickers locked while there are unsaved changes |
| Label shown to the editor | The server's order (label, target title, then both in the fallback language): `GqlTarget.title` is the edited language only, `fallbackTitle` the fallback language |
| Not public chip | The guest check runs in the site's default language: Jahia hides an item switched off in a language (`j:invalidLanguages`) at the JCR level, and the "Hidden in" chip says so |
| Apollo cache | jContent's cache keys JCR nodes on `uuid` + `workspace`: every node selection asks for both |
| Icon | `toIconComponent` needs a filled SVG with width and height (a stroke icon renders as a speck) |
| LayoutContent | `content` is deprecated in Moonstone 2.20 and clashes with the div attribute in the types: pass children |
| Checked in the browser | open and edit an item, Move links (up, under), Save (revision, order read back), switch to zh_HK (Chinese titles, fallback chips, hidden chip), external link validation, Discard, Publish (live read as guest), New menu, Delete with confirmation |
| Not checked | Pointer drag and drop: the browser pane runs as a hidden page and dnd-kit cancels drags on visibility changes; the drop logic is unit-tested, the real drag goes into the Cypress suite (phase 6) |

## 2026-11-02: phase 4, the views (local stack, exactlytest)

| Topic | Decision or finding |
|---|---|
| Data | One server-side `useGQLQuery` on `menuManager.resolvedMenu`, as the visitor: on live, an anonymous visitor's page leaves out an item locked to guests and a target never published; the API scope is in place, whether the server-side call needs it is not isolated yet |
| Cache | `cache.mainResource` (current page), the resolver's dependency list declared one by one (`/*` entries as a subtree regexp); root then guest on the same page: no leak |
| URLs | `buildNodeUrl` on the target read with the render session; external addresses as the resolver checked them |
| Layouts | Horizontal: disclosure buttons and panels (static/js/menu-manager.js: one open at a time, Escape, click outside; without it, hover and focus-within), a Menu button under 768 px. Vertical: nested lists. Columns: a grid. Edit mode: every level open, a note naming the menu |
| Tokens | `--mnu-*`, defaulting to the classic-templates tokens, then neutral values |
| Placement today | classic-templates areas refuse it until phase 5; its Free zone accepts it |
| Trap | The query's third level selects no `children`: the view normalises every level to a list (a first render failed with `Cannot read property 'some' of undefined`, a 500 for the whole page) |

## 2026-11-02: mega menu and promotions (user)

| Topic | Decision |
|---|---|
| Mega menu | A fourth layout (`mega`, added to the `layout` choice list: a widening, installed as a minor change): the horizontal bar's behaviour, each panel the full width of the menu with the item's intro, one column per child, and the promotion |
| Promotion (user asked whether it is page-level) | On the **menu item** (`promo*` properties of `mnumix:menuItem`, top-level items only, edited in the Menus screen, per language): a custom menu points to any page or to a section with no page. A page item without a promotion title of its own shows its page's classic-templates `ctplmix:navPromo` (`promoTitle`, `promoText`, `image`, `imageAlt`, `ctaLabel`, `promoLink`, `promoUrl`), read only when that type exists, so promotions already written on pages keep working and nothing depends on classic-templates |
| Access | The promotion's image and link are read with the visitor's session: one the visitor may not read is left out (the button then falls back to the address, else the item's link); both are cache dependencies |

## 2026-11-02: phase 5, classic-templates (local, not pushed)

| Change | What | Checked on the local stack (exactlytest) |
|---|---|---|
| A, `feat/nav-menu-component-areas` | `ctpl:pageArea`, `ctpl:headerArea`, `ctpl:footerArea` take a second residual line `+ * (jmix:navMenuComponent)` | Installs over content with no major-change refusal; the page area accepts `mnu:navigation`; a menu placed directly in the main area renders on live |
| B, `feat/header-menu-source` | `ctpl:mainNavigation` gets `menuSource` (`pageTree`, `menu`) and `menu` (weakreference with `choicelist[nodes='$currentSite/menus;mnu:menu']`, no type constraint: Menu Manager's type); the view reads `menuManager.resolvedMenu` (no current page: the header is shared, the script marks it) and maps the items onto the page-tree items, so the dropdown and mega styles, the script and the promotion slot are unchanged; top-level promotions in the mega style; page tree plus an edit-mode note when the menu cannot be read | Header in the mega style from the custom menu on live as guest: items, promotion, new-tab text, the guest-locked item left out; root then guest: no leak |
| Open | Whether `choicelist[nodes=...;mnu:menu]` behaves on an instance without Menu Manager (the form's menu list) is not checked: it needs an instance without the module |

## 2026-11-02: Jahia's own selector and view mechanism (user)

| Topic | Decision |
|---|---|
| Pages in the Menus screen | jContent's **ChoiceTree** selector (the Content Editor's tree behind categories), read from the registry (`registry.get('selectorType', 'ChoiceTree').cmp`) with `rootPath: /sites/{site}` and `types: jnt:page`, several pages at once; replaces the hand-made list of ticks. Its children sort by label, as in the content forms |
| Layouts | **One view, one file** per rendering: `default.server.tsx` (horizontal bar), `mega.server.tsx`, `vertical.server.tsx`, `columns.server.tsx`; what they share sits in `parts.tsx`, not registered. The editor picks one in Layout > View (`j:view`): `jmix:renderable` is a supertype of `mnu:navigation`, so the field has no switch. The `layout` property is gone (never released; the local components were moved to `j:view` first, both workspaces) |
| View labels | `jmix_renderable.j_view.<view>` in the resource bundle of the type's module (menu-manager); the core `link` view stays in the list, as on every content |
| Removing `layout` | A removal is a major change even with no value left: the local stack took it through provisioning with `ignoreChecks: true`, which an unreleased type may do and a released one never |
| Resource bundles | Every non-ASCII character is a `\uXXXX` escape (native2ascii reads ISO-8859-1: every French label read `affichÃ©s`); `ResourceBundlesTest` fails the build on a non-ASCII line |

## 2026-11-02: phase 6, the Cypress suite (local stack)

| Finding | Change |
|---|---|
| jContent 3.8 has no `window.jahia.toastDispatcher`: the screen never confirmed a save, publish or delete | Notifications through `useNotifications` of the host's shared `@jahia/react-material` (`import: false`); the screen spec asserts "Menu saved" |
| Moonstone's `AccordionItem` renders `role="accordion-item"` and an `aria-controls` to an id it never sets (axe critical) | Add items is a Moonstone `Tab` (tablist, tab, arrow keys) over a `tabpanel` |
| ChoiceTree's listbox has no accessible name (Moonstone's `Dropdown` takes no label) | `aria-label` set on it from the panel's name |
| Muted text at `--color-gray_dark60` (3.8:1), unselected tabs (#7a7f88, 4.0:1), the fallback dropdown's placeholder, outlined danger buttons (#f44053, 3.7:1) | Full-strength `--color-gray_dark`; unselected tabs recoloured (the screen's one Moonstone recolouring); "Site default" a real option; Delete and Remove neutral outlined buttons with the Delete icon |
| Filled buttons (user, 2026-11-02) | Moonstone's filled accent (white on #00a0e3, 2.9:1) and danger buttons fail AA; they are Jahia's own back-office colours and stay as jContent draws them. The accessibility spec leaves out `.moonstone-button_accent` and `.moonstone-button_danger` only, with the reason in the test; to raise with Moonstone |

## 2026-11-02: phase 7, CI and release preparation

| Topic | Decision |
|---|---|
| CI | content-governance's Jahia standard workflows; a lint job for the Menus screen (ESLint with the Sonar block, added in this phase: 40 findings fixed), the views and the Cypress suite (type-check); the Cypress suite on every PR (one Jahia start, about 1 minute of specs) and nightly |
| Sonar | The Java module's `sonar.sources` includes `src/javascript`, its `*.test.ts` counted as tests |
| Security scan | `jahia-security-scan` clean; `createMenu`, `updateMenu`, `deleteMenu`, `editableMenu` matched the admin-name heuristic of `jahia-graphql-admin-no-permission`: triaged inline (`nosemgrep` with the reason), the per-site check being tested by `authorization.spec.ts` |
| Version | One version for both modules; `.chachalog/.version` 0.0.0 until 1.0.0 (it said 1.0.0, which a major fragment would have turned into 2.0.0); the first release's notes are five fragments |
| Store | One pack, `store-submissions/menu-manager/`, two listings (the module, its views); packages from the CI-built GitHub release |
