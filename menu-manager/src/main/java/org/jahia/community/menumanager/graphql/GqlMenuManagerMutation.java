package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.community.menumanager.model.MenuException;
import org.jahia.community.menumanager.model.SaveOutcome;
import org.jahia.community.menumanager.service.spi.MenuStore;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.osgi.annotations.GraphQLOsgiService;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.jcr.RepositoryException;

/**
 * Menu mutations, for the Menus screen. Each one is authorised here, on the server: the caller holds
 * {@value MenuStore#PERMISSION} on the site and the path is a menu of that site. Writes go through
 * the caller's own session, so the JCR refuses what the caller may not write. Refusals answer a
 * code the screen translates ({@link MenuException}); every write logs the user who made it.
 */
@GraphQLName("MenuManagerMutation")
@GraphQLDescription("Menu Manager mutations")
public class GqlMenuManagerMutation {

    private static final Logger logger = LoggerFactory.getLogger(GqlMenuManagerMutation.class);
    private static final int MAX_TITLE = 200;

    // graphql-java-annotations injects OSGi services into fields only (@GraphQLOsgiService)
    @SuppressWarnings("java:S6813")
    @Inject
    @GraphQLOsgiService
    private MenuStore store;

    /**
     * @param siteKey  key of the site
     * @param title    title of the menu
     * @param language language of the title
     * @return the new menu
     */
    // manageMenus is a site permission, checked on the site by MenuAccess (tests/authorization.spec.ts):
    // @GraphQLRequiresPermission would check it on the server root and refuse site administrators.
    // nosemgrep: jahia-graphql-admin-no-permission
    @GraphQLField
    @GraphQLName("createMenu")
    @GraphQLNonNull
    @GraphQLDescription("Creates an empty menu at the end of the site's menus")
    public GqlMenuSummary createMenu(
            @GraphQLName("siteKey") @GraphQLNonNull @GraphQLDescription("Key of the site") String siteKey,
            @GraphQLName("title") @GraphQLNonNull @GraphQLDescription("Title of the menu") String title,
            @GraphQLName("language") @GraphQLNonNull @GraphQLDescription("Language of the title") String language) {
        MenuAccess.site(siteKey);
        String clean = title(title);
        try {
            String path = store.create(siteKey, clean, MenuAccess.language(language));
            logger.info("menu {} created by {}", path, user());
            JCRNodeWrapper menu = MenuAccess.menu(path);
            return new GqlMenuSummary(menu.getIdentifier(), path, clean, 0, 0L);
        } catch (RepositoryException e) {
            throw failed("create a menu on " + siteKey, e);
        }
    }

    /**
     * @param path             path of the menu
     * @param language         language of the title
     * @param title            the new title, or null to keep it
     * @param fallbackLanguage the fallback language, empty for the site's default, or null to keep it
     * @return true once saved
     */
    // manageMenus is a site permission, checked on the site by MenuAccess (tests/authorization.spec.ts):
    // @GraphQLRequiresPermission would check it on the server root and refuse site administrators.
    // nosemgrep: jahia-graphql-admin-no-permission
    @GraphQLField
    @GraphQLName("updateMenu")
    @GraphQLNonNull
    @GraphQLDescription("Changes a menu's title and fallback language")
    public boolean updateMenu(
            @GraphQLName("path") @GraphQLNonNull @GraphQLDescription("Path of the menu") String path,
            @GraphQLName("language") @GraphQLNonNull @GraphQLDescription("Language of the title") String language,
            @GraphQLName("title") @GraphQLDescription("New title; kept when absent") String title,
            @GraphQLName("fallbackLanguage") @GraphQLDescription("Fallback language; empty for the site's default, kept when absent") String fallbackLanguage) {
        JCRNodeWrapper menu = MenuAccess.menu(path);
        String fallback = fallbackLanguage;
        try {
            if (fallback != null && !fallback.isEmpty()
                    && !menu.getResolveSite().getLanguages().contains(MenuAccess.language(fallback))) {
                throw new DataFetchingException("Unknown language");
            }
            store.update(path, MenuAccess.language(language), title == null ? null : title(title), fallback);
            logger.info("menu {} renamed or its fallback changed by {}", path, user());
            return true;
        } catch (RepositoryException e) {
            throw failed("update " + path, e);
        }
    }

    /**
     * @param path     path of the menu to copy
     * @param title    title of the copy
     * @param language language of the title
     * @return the copy
     */
    @GraphQLField
    @GraphQLName("duplicateMenu")
    @GraphQLNonNull
    @GraphQLDescription("Copies a menu with all its items and translations")
    public GqlMenuSummary duplicateMenu(
            @GraphQLName("path") @GraphQLNonNull @GraphQLDescription("Path of the menu to copy") String path,
            @GraphQLName("title") @GraphQLNonNull @GraphQLDescription("Title of the copy") String title,
            @GraphQLName("language") @GraphQLNonNull @GraphQLDescription("Language of the title") String language) {
        MenuAccess.menu(path);
        String clean = title(title);
        try {
            String copy = store.duplicate(path, clean, MenuAccess.language(language));
            logger.info("menu {} copied to {} by {}", path, copy, user());
            return new GqlMenuSummary(MenuAccess.menu(copy).getIdentifier(), copy, clean, 0, 0L);
        } catch (RepositoryException e) {
            throw failed("copy " + path, e);
        }
    }

    /**
     * @param path path of the menu
     * @return true once removed from the default workspace
     */
    // manageMenus is a site permission, checked on the site by MenuAccess (tests/authorization.spec.ts):
    // @GraphQLRequiresPermission would check it on the server root and refuse site administrators.
    // nosemgrep: jahia-graphql-admin-no-permission
    @GraphQLField
    @GraphQLName("deleteMenu")
    @GraphQLNonNull
    @GraphQLDescription("Removes a menu from the default workspace; publish the site's menus to remove it from live")
    public boolean deleteMenu(@GraphQLName("path") @GraphQLNonNull @GraphQLDescription("Path of the menu") String path) {
        MenuAccess.menu(path);
        try {
            store.delete(path);
            logger.info("menu {} deleted by {}", path, user());
            return true;
        } catch (RepositoryException e) {
            throw failed("delete " + path, e);
        }
    }

    /**
     * @param path     path of the menu
     * @param language language of the labels in the tree
     * @param revision the revision the editor opened
     * @param tree     the tree as JSON
     * @return the new revision and item count
     */
    @GraphQLField
    @GraphQLName("saveMenu")
    @GraphQLNonNull
    @GraphQLDescription("Replaces a menu's items with a tree in one save; refused when the menu changed since the given revision")
    public GqlSaveResult saveMenu(
            @GraphQLName("path") @GraphQLNonNull @GraphQLDescription("Path of the menu") String path,
            @GraphQLName("language") @GraphQLNonNull @GraphQLDescription("Language of the labels") String language,
            @GraphQLName("revision") @GraphQLNonNull @GraphQLDescription("The revision the editor opened") Long revision,
            @GraphQLName("tree") @GraphQLNonNull @GraphQLDescription("The menu's items as JSON") String tree) {
        MenuAccess.menu(path);
        try {
            SaveOutcome outcome = store.save(path, MenuAccess.language(language), revision, tree);
            logger.info("menu {} saved by {} (revision {}, {} items)", path, user(), outcome.revision(), outcome.itemCount());
            return new GqlSaveResult(outcome.revision(), outcome.itemCount());
        } catch (MenuException e) {
            logger.debug("menu {} not saved: {}", path, e.getMessage());
            throw new DataFetchingException(e.code());
        } catch (RepositoryException e) {
            throw failed("save " + path, e);
        }
    }

    private static String title(String title) {
        String clean = title == null ? "" : title.trim();
        if (clean.isEmpty() || clean.length() > MAX_TITLE) {
            throw new DataFetchingException(MenuException.TOO_LONG);
        }
        return clean;
    }

    private static DataFetchingException failed(String what, RepositoryException e) {
        logger.warn("could not {} (user {}): {}", what, user(), e.toString());
        return new DataFetchingException("The menu could not be saved");
    }

    private static String user() {
        return JCRSessionFactory.getInstance().getCurrentUser() == null ? "?" : JCRSessionFactory.getInstance().getCurrentUser().getName();
    }
}
