package org.jahia.community.menumanager.model;

import java.util.List;

/**
 * A menu resolved for one visitor in one language. {@link #dependencies()} lists what a cached
 * rendering of it must be flushed on: the menu's subtree, every target, and the subtree of every
 * page whose subpages are included.
 *
 * @param id           identifier of the menu node
 * @param path         path of the menu node
 * @param title        the menu's title in the language or the fallback language, or null
 * @param language     the language resolved
 * @param items        the visible top-level items, in menu order
 * @param dependencies paths a cached rendering depends on; a path ending in {@code /*} stands for
 *                     its whole subtree
 */
public record ResolvedMenu(
        String id,
        String path,
        String title,
        String language,
        List<ResolvedItem> items,
        List<String> dependencies) {

    /**
     * Copies the lists, so the record stays immutable.
     */
    public ResolvedMenu {
        items = List.copyOf(items);
        dependencies = List.copyOf(dependencies);
    }
}
