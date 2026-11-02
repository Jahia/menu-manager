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
