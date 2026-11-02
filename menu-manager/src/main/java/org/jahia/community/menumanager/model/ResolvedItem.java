package org.jahia.community.menumanager.model;

import java.util.List;

/**
 * One item of a menu as one visitor sees it in one language: its label already chosen (the
 * language, else the fallback language, else the target's title), its target readable by that
 * visitor, its children filtered the same way. Immutable.
 *
 * @param id          identifier of the item node; for a subpage added by "include subpages", the
 *                    identifier of the page
 * @param kind        what the item is
 * @param label       the text to show, never blank
 * @param description the description in the language or the fallback language, or null
 * @param style       {@code default}, {@code highlight} or {@code button}
 * @param targetId    identifier of the target node (page and internal link), or null
 * @param targetPath  path of the target node (page and internal link), or null
 * @param externalUrl the checked address of an external link, or null
 * @param newTab      whether the link opens in a new tab
 * @param current     whether the target is the page being rendered
 * @param inTrail     whether the page being rendered is under the target
 * @param children    the visible children, in menu order
 */
public record ResolvedItem(
        String id,
        MenuItemKind kind,
        String label,
        String description,
        String style,
        String targetId,
        String targetPath,
        String externalUrl,
        boolean newTab,
        boolean current,
        boolean inTrail,
        List<ResolvedItem> children) {

    /**
     * Copies the children list, so the record stays immutable.
     */
    public ResolvedItem {
        children = List.copyOf(children);
    }
}
