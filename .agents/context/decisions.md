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
