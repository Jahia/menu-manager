package org.jahia.community.menumanager.service.spi;

import org.jahia.community.menumanager.model.ResolvedMenu;

import javax.jcr.RepositoryException;
import java.util.Optional;

/**
 * Turns a menu into what the calling user may see in one language. Runs with the calling user's own
 * session (never a system session), so a target or an item that user cannot read is left out, with
 * everything under it. Labels fall back to the menu's fallback language (the site's default language
 * when none is set), then to the target's title; an item left with no label is left out, and so is a
 * section left with no visible item. Thread-safe: holds no session.
 */
public interface MenuResolver {

    /** Deepest level a menu may have. */
    int MAX_DEPTH = 3;

    /**
     * @param menuIdOrPath identifier or path of an {@code mnu:menu} node
     * @param workspace    {@code default} or {@code live}
     * @param language     the language to resolve, as a Jahia language code ({@code en}, {@code zh_HK})
     * @param currentPath  path of the page being rendered, to mark the current item and its trail; may be null
     * @param maxDepth     levels to return, 1 to {@value #MAX_DEPTH}; out-of-range values are clamped
     * @return the resolved menu, or empty when the node does not exist, the caller cannot read it, or it
     *         is not a menu
     * @throws RepositoryException when the repository fails
     */
    Optional<ResolvedMenu> resolve(String menuIdOrPath, String workspace, String language, String currentPath, int maxDepth)
            throws RepositoryException;
}
