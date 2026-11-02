package org.jahia.community.menumanager.service.spi;

import org.jahia.community.menumanager.model.MenuException;
import org.jahia.community.menumanager.model.SaveOutcome;

import javax.jcr.RepositoryException;

/**
 * Writes menus in the default workspace with the calling user's session: the JCR refuses what that
 * user may not write. Callers check the {@value #PERMISSION} permission on the site first, and that
 * the path they pass is a menu of that site. Thread-safe: holds no session.
 */
public interface MenuStore {

    /** Site permission to manage the site's menus (imported under site-admin). */
    String PERMISSION = "manageMenus";
    /** Name of the container of a site's menus, under the site node. */
    String CONTAINER = "menus";

    /**
     * Creates a menu at the end of the site's menus, creating their container on first use.
     *
     * @param siteKey  key of the site
     * @param title    title of the menu in {@code language}
     * @param language the language of the title
     * @return the path of the new menu
     * @throws RepositoryException when the repository fails or refuses the write
     */
    String create(String siteKey, String title, String language) throws RepositoryException;

    /**
     * Changes a menu's title (in {@code language}) and its fallback language.
     *
     * @param menuPath         path of the menu
     * @param language         the language of the title
     * @param title            the new title, or null to keep it
     * @param fallbackLanguage the fallback language, an empty string for the site's default, or null to keep it
     * @throws RepositoryException when the repository fails or refuses the write
     */
    void update(String menuPath, String language, String title, String fallbackLanguage) throws RepositoryException;

    /**
     * Copies a menu, with all its items and translations, under a new title.
     *
     * @param menuPath path of the menu to copy
     * @param title    title of the copy in {@code language}
     * @param language the language of the title
     * @return the path of the copy
     * @throws RepositoryException when the repository fails or refuses the write
     */
    String duplicate(String menuPath, String title, String language) throws RepositoryException;

    /**
     * Removes a menu in the default workspace; publishing the site's menus container removes it from
     * live.
     *
     * @param menuPath path of the menu
     * @throws RepositoryException when the repository fails or refuses the write
     */
    void delete(String menuPath) throws RepositoryException;

    /**
     * Replaces a menu's items with a tree in one save: items keep their identity (and their other
     * translations) when the tree names their id, new ones are created, missing ones are removed.
     * Labels and descriptions are written in {@code language} only.
     *
     * @param menuPath         path of the menu
     * @param language         language of the labels and descriptions in the tree
     * @param expectedRevision the revision the editor opened; another one refuses the save
     * @param treeJson         the tree, as documented in {@code MenuTree}
     * @return the new revision and the number of items
     * @throws MenuException       when the tree is invalid, a target does not exist or the menu changed
     * @throws RepositoryException when the repository fails or refuses the write
     */
    SaveOutcome save(String menuPath, String language, long expectedRevision, String treeJson)
            throws MenuException, RepositoryException;
}
