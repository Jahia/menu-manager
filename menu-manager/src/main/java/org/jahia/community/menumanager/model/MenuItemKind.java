package org.jahia.community.menumanager.model;

import java.util.Arrays;
import java.util.Optional;

/**
 * The four kinds of menu item, each with its node type and the identifier the GraphQL API and the
 * Menus screen use for it.
 */
public enum MenuItemKind {
    /** A page of the site, optionally with its subpages. */
    PAGE("page", "mnu:pageItem"),
    /** A heading with no link. */
    SECTION("section", "mnu:sectionItem"),
    /** A link to any addressable node. */
    INTERNAL_LINK("internalLink", "mnu:internalLinkItem"),
    /** A link outside the site. */
    EXTERNAL_LINK("externalLink", "mnu:externalLinkItem");

    private final String id;
    private final String nodeType;

    MenuItemKind(String id, String nodeType) {
        this.id = id;
        this.nodeType = nodeType;
    }

    /**
     * @return the identifier used by the API ({@code page}, {@code section}, {@code internalLink},
     *         {@code externalLink})
     */
    public String id() {
        return id;
    }

    /**
     * @return the primary node type of an item of this kind
     */
    public String nodeType() {
        return nodeType;
    }

    /**
     * @param id an API identifier
     * @return the kind, or empty for an unknown identifier
     */
    public static Optional<MenuItemKind> fromId(String id) {
        return Arrays.stream(values()).filter(k -> k.id.equals(id)).findFirst();
    }

    /**
     * @param nodeType a primary node type name
     * @return the kind, or empty when the type is not a menu item
     */
    public static Optional<MenuItemKind> fromNodeType(String nodeType) {
        return Arrays.stream(values()).filter(k -> k.nodeType.equals(nodeType)).findFirst();
    }
}
