/** A top-level item's promotion (mega menu). */
export interface Promotion {
  title: string;
  text?: string | null;
  imageId?: string | null;
  imageAlt?: string | null;
  linkLabel?: string | null;
  targetId?: string | null;
  url?: string | null;
}

/** One item of a menu as menuManager.resolvedMenu returns it. */
export interface MenuItem {
  id: string;
  kind: "page" | "section" | "internalLink" | "externalLink";
  label: string;
  description?: string | null;
  style: "default" | "highlight" | "button";
  targetId?: string | null;
  url?: string | null;
  newTab: boolean;
  current: boolean;
  inTrail: boolean;
  promotion?: Promotion | null;
  children: MenuItem[];
}

/** The menu as menuManager.resolvedMenu returns it. */
export interface ResolvedMenu {
  id: string;
  title?: string | null;
  items: MenuItem[];
  dependencies: string[];
}

/** The fields of a resolved item, three levels deep (a menu has no fourth). */
const ITEM = "id kind label description style targetId url newTab current inTrail";

/**
 * The query the views run on the server, as the visitor: the resolver leaves out what the visitor may
 * not read and applies the fallback language.
 */
export const RESOLVED_MENU = `
  query MenuManagerView($menu: String!, $language: String!, $workspace: String, $currentPath: String, $maxDepth: Int) {
    menuManager {
      resolvedMenu(menu: $menu, language: $language, workspace: $workspace, currentPath: $currentPath, maxDepth: $maxDepth) {
        id title dependencies
        items { ${ITEM} promotion { title text imageId imageAlt linkLabel targetId url } children { ${ITEM} children { ${ITEM} } } }
      }
    }
  }
`;

const escapeRegex = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * A cache dependency for one entry of the resolver's list: a path ending in "/*" stands for the node
 * and its whole subtree, anything else for the node itself.
 */
export const dependencyFor = (entry: string): { path: string } | { flushOnPathMatchingRegexp: string } =>
  entry.endsWith("/*")
    ? { flushOnPathMatchingRegexp: `${escapeRegex(entry.slice(0, -2))}(/.*)?` }
    : { path: entry };

/** The items with a children list at every level: the query's third level selects none. */
export const normalize = (items: (Omit<MenuItem, "children"> & { children?: MenuItem[] | null })[] | null | undefined): MenuItem[] =>
  (items ?? []).map((item) => ({ ...item, children: normalize(item.children) }));

/** Whether an item, or one of its descendants, is the current page. */
export const holdsCurrent = (item: MenuItem): boolean => item.current || item.inTrail || item.children.some(holdsCurrent);

/** Clamps the component's "levels shown" to 1..3 (3 when unset or not a number). */
export const depthOf = (value: unknown): number => {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(3, Math.max(1, n)) : 3;
};
