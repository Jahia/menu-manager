/**
 * The menu being edited, as the Menus screen holds it, and every change the screen makes to it:
 * pure functions over an immutable tree. The drag and drop works on a flattened copy (one row per
 * visible item, with its depth), as dnd-kit's sortable tree does; the keyboard moves work on the tree.
 * A menu has {@link MAX_DEPTH} levels at most: no move ever produces a fourth.
 */

export type Kind = 'page' | 'section' | 'internalLink' | 'externalLink';
export type Style = 'default' | 'highlight' | 'button';

export interface Target {
    uuid: string;
    path: string | null;
    title: string | null;
    fallbackTitle?: string | null;
    nodeType: string | null;
    available: boolean;
    inLive: boolean;
}

export interface Item {
    /** Client key: the server id for a stored item, a generated one for a new item. */
    key: string;
    /** Server id; absent for an item not saved yet. */
    id?: string;
    kind: Kind;
    label: string;
    fallbackLabel?: string | null;
    description: string;
    fallbackDescription?: string | null;
    style: Style;
    includeSubpages: boolean;
    newTab: boolean;
    url: string;
    invalidLanguages: string[];
    target?: Target | null;
    publicAccess?: boolean;
    children: Item[];
}

export interface FlatItem {
    key: string;
    parentKey: string | null;
    depth: number;
    item: Item;
}

export const MAX_DEPTH = 3;

let counter = 0;
/** A key for a new item, unique in this page. */
export const newKey = (): string => `new-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** The item as the server's editable menu returns it. */
export interface ServerItem {
    id: string;
    kind: string;
    label?: string | null;
    fallbackLabel?: string | null;
    description?: string | null;
    fallbackDescription?: string | null;
    style: string;
    includeSubpages: boolean;
    newTab: boolean;
    url?: string | null;
    invalidLanguages: string[];
    target?: Target | null;
    publicAccess: boolean;
    children?: ServerItem[];
}

export const fromServer = (items: ServerItem[] = []): Item[] =>
    items.map(i => ({
        key: i.id,
        id: i.id,
        kind: i.kind as Kind,
        label: i.label ?? '',
        fallbackLabel: i.fallbackLabel,
        description: i.description ?? '',
        fallbackDescription: i.fallbackDescription,
        style: (i.style as Style) || 'default',
        includeSubpages: i.includeSubpages,
        newTab: i.newTab,
        url: i.url ?? '',
        invalidLanguages: i.invalidLanguages ?? [],
        target: i.target ?? null,
        publicAccess: i.publicAccess,
        children: fromServer(i.children ?? [])
    }));

/** The tree in the shape the saveMenu mutation reads. */
export const toSaveTree = (items: Item[]): unknown => ({items: items.map(saveItem)});

const saveItem = (i: Item): Record<string, unknown> => {
    const out: Record<string, unknown> = {
        kind: i.kind,
        label: i.label.trim() || null,
        description: i.description.trim() || null,
        style: i.style,
        invalidLanguages: i.invalidLanguages,
        children: i.children.map(saveItem)
    };
    if (i.id) {
        out.id = i.id;
    }
    if (i.kind === 'page') {
        out.page = i.target?.uuid;
        out.includeSubpages = i.includeSubpages;
    } else if (i.kind === 'internalLink') {
        out.target = i.target?.uuid;
        out.newTab = i.newTab;
    } else if (i.kind === 'externalLink') {
        out.url = i.url.trim();
        out.newTab = i.newTab;
    }
    return out;
};

/** Levels an item takes with its descendants: 1 for an item without children. */
export const height = (item: Item): number => 1 + Math.max(0, ...item.children.map(height));

export const count = (items: Item[]): number => items.reduce((n, i) => n + 1 + count(i.children), 0);

/** One row per item, depth first; the children of a collapsed item (or of {@code hide}) are left out. */
export const flatten = (items: Item[], collapsed: Set<string> = new Set(), hide?: string, depth = 0,
                        parentKey: string | null = null): FlatItem[] =>
    items.flatMap(item => [
        {key: item.key, parentKey, depth, item},
        ...(collapsed.has(item.key) || item.key === hide ? [] : flatten(item.children, collapsed, hide, depth + 1, item.key))
    ]);

export const find = (items: Item[], key: string): Item | null => {
    for (const i of items) {
        if (i.key === key) {
            return i;
        }
        const found = find(i.children, key);
        if (found) {
            return found;
        }
    }
    return null;
};

/** Where an item sits: its parent's key (null at the top) and its index there. */
export const locate = (items: Item[], key: string, parentKey: string | null = null): {parentKey: string | null; index: number; depth: number} | null => {
    const depthOf = (list: Item[], k: string, d: number): number => {
        for (const i of list) {
            if (i.key === k) {
                return d;
            }
            const found = depthOf(i.children, k, d + 1);
            if (found >= 0) {
                return found;
            }
        }
        return -1;
    };
    const walk = (list: Item[], parent: string | null): {parentKey: string | null; index: number} | null => {
        const index = list.findIndex(i => i.key === key);
        if (index >= 0) {
            return {parentKey: parent, index};
        }
        for (const i of list) {
            const found = walk(i.children, i.key);
            if (found) {
                return found;
            }
        }
        return null;
    };
    const where = walk(items, parentKey);
    return where ? {...where, depth: depthOf(items, key, 0)} : null;
};

export const update = (items: Item[], key: string, patch: Partial<Item>): Item[] =>
    items.map(i => (i.key === key ? {...i, ...patch} : {...i, children: update(i.children, key, patch)}));

export const remove = (items: Item[], key: string): Item[] =>
    items.filter(i => i.key !== key).map(i => ({...i, children: remove(i.children, key)}));

/** Inserts {@code item} under {@code parentKey} (null: the top level) at {@code index}. */
export const insert = (items: Item[], parentKey: string | null, index: number, item: Item): Item[] => {
    if (parentKey === null) {
        const out = [...items];
        out.splice(Math.max(0, Math.min(index, out.length)), 0, item);
        return out;
    }
    return items.map(i => (i.key === parentKey ? {...i, children: insert(i.children, null, index, item)}
        : {...i, children: insert(i.children, parentKey, index, item)}));
};

/** Depth (0 for the top level) of the item {@code key}, or -1. */
const depthOfKey = (items: Item[], key: string | null): number => (key === null ? -1 : locate(items, key)?.depth ?? -1);

/** Whether {@code item} with its descendants fits under {@code parentKey}. */
export const fits = (items: Item[], item: Item, parentKey: string | null): boolean =>
    depthOfKey(items, parentKey) + 1 + height(item) <= MAX_DEPTH;

/** Moves an item, with its descendants, under {@code parentKey} at {@code index}; null when it would not fit or would go under itself. */
export const move = (items: Item[], key: string, parentKey: string | null, index: number): Item[] | null => {
    const item = find(items, key);
    if (!item || (parentKey !== null && (parentKey === key || find(item.children, parentKey)))) {
        return null;
    }
    const without = remove(items, key);
    return fits(without, item, parentKey) ? insert(without, parentKey, index, item) : null;
};

/** Keyboard moves, WordPress style: up, down, under the item above, out to the parent's level. */
export const moveUp = (items: Item[], key: string): Item[] | null => {
    const at = locate(items, key);
    return at && at.index > 0 ? move(items, key, at.parentKey, at.index - 1) : null;
};

export const moveDown = (items: Item[], key: string): Item[] | null => {
    const at = locate(items, key);
    if (!at) {
        return null;
    }
    const siblings = at.parentKey === null ? items : find(items, at.parentKey)?.children ?? [];
    return at.index < siblings.length - 1 ? move(items, key, at.parentKey, at.index + 1) : null;
};

export const indent = (items: Item[], key: string): Item[] | null => {
    const at = locate(items, key);
    if (!at || at.index === 0) {
        return null;
    }
    const siblings = at.parentKey === null ? items : find(items, at.parentKey)?.children ?? [];
    const above = siblings[at.index - 1];
    return move(items, key, above.key, above.children.length);
};

export const outdent = (items: Item[], key: string): Item[] | null => {
    const at = locate(items, key);
    if (!at || at.parentKey === null) {
        return null;
    }
    const parent = locate(items, at.parentKey);
    return parent ? move(items, key, parent.parentKey, parent.index + 1) : null;
};

/**
 * Where a dragged item lands: the depth it would take at the row it is over, from the horizontal
 * distance dragged, kept between what its neighbours allow and what the depth limit allows.
 */
export const projection = (flat: FlatItem[], activeKey: string, overKey: string, offsetX: number, indentWidth: number,
                           items: Item[]): {depth: number; parentKey: string | null} | null => {
    const activeIndex = flat.findIndex(f => f.key === activeKey);
    const overIndex = flat.findIndex(f => f.key === overKey);
    if (activeIndex < 0 || overIndex < 0) {
        return null;
    }
    const active = flat[activeIndex];
    const moved = arrayMove(flat, activeIndex, overIndex);
    const previous = moved[overIndex - 1];
    const next = moved[overIndex + 1];
    const wanted = active.depth + Math.round(offsetX / indentWidth);
    const deepest = Math.min(previous ? previous.depth + 1 : 0, MAX_DEPTH - height(active.item));
    const shallowest = next ? Math.min(next.depth, deepest) : 0;
    const depth = Math.max(shallowest, Math.min(wanted, deepest));
    let parentKey: string | null = null;
    if (depth > 0 && previous) {
        if (depth === previous.depth) {
            parentKey = previous.parentKey;
        } else if (depth > previous.depth) {
            parentKey = previous.key;
        } else {
            parentKey = moved.slice(0, overIndex).reverse().find(f => f.depth === depth)?.parentKey ?? null;
        }
    }
    return find(items, activeKey) ? {depth, parentKey} : null;
};

/** The tree after dropping {@code activeKey} over {@code overKey} at the projected parent. */
export const drop = (items: Item[], flat: FlatItem[], activeKey: string, overKey: string, parentKey: string | null): Item[] | null => {
    const activeIndex = flat.findIndex(f => f.key === activeKey);
    const overIndex = flat.findIndex(f => f.key === overKey);
    if (activeIndex < 0 || overIndex < 0) {
        return null;
    }
    const moved = arrayMove(flat, activeIndex, overIndex);
    // Its index among its new siblings: the rows before it in the flat list that share the parent.
    const index = moved.slice(0, overIndex).filter(f => f.parentKey === parentKey && f.key !== activeKey).length;
    return move(items, activeKey, parentKey, index);
};

export const arrayMove = <T, >(list: T[], from: number, to: number): T[] => {
    const out = [...list];
    const [moved] = out.splice(from, 1);
    out.splice(to, 0, moved);
    return out;
};

/**
 * The label visitors see, in the server's order (MenuResolverImpl): the item's label, its target's
 * title, then the same two in the fallback language, then the address of an external link.
 */
export const displayLabel = (item: Item): {text: string; fallback: boolean} => {
    if (item.label.trim()) {
        return {text: item.label.trim(), fallback: false};
    }
    if (item.target?.title) {
        return {text: item.target.title, fallback: false};
    }
    if (item.fallbackLabel) {
        return {text: item.fallbackLabel, fallback: true};
    }
    if (item.target?.fallbackTitle) {
        return {text: item.target.fallbackTitle, fallback: true};
    }
    return {text: item.url, fallback: false};
};

/** What a save would refuse, checked before sending: the codes the server answers. */
export const problems = (items: Item[]): string[] => {
    const out = new Set<string>();
    const walk = (list: Item[], depth: number) => list.forEach(i => {
        if (depth >= MAX_DEPTH) {
            out.add('tooDeep');
        }
        if (i.kind === 'section' && !i.label.trim() && !i.fallbackLabel) {
            out.add('sectionLabel');
        }
        if ((i.kind === 'page' || i.kind === 'internalLink') && !i.target?.uuid) {
            out.add('noTarget');
        }
        if (i.kind === 'externalLink' && !/^(https?:\/\/[^\s/?#\\]+|mailto:\S+|tel:\S+)/i.test(i.url.trim())) {
            out.add('badUrl');
        }
        walk(i.children, depth + 1);
    });
    walk(items, 0);
    return [...out];
};
