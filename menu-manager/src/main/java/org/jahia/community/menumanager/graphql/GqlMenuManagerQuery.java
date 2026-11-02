package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.api.Constants;
import org.jahia.community.menumanager.model.MenuItemKind;
import org.jahia.community.menumanager.service.spi.MenuResolver;
import org.jahia.community.menumanager.service.spi.MenuStore;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.modules.graphql.provider.dxm.osgi.annotations.GraphQLOsgiService;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.utils.LanguageCodeConverters;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.jcr.RepositoryException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Menu queries. {@code menus} and {@code editableMenu} serve the Menus screen and need
 * {@value MenuStore#PERMISSION} on the site; {@code resolvedMenu} serves views and headless clients
 * and runs with the caller's own rights, whoever the caller is.
 */
@GraphQLName("MenuManagerQuery")
@GraphQLDescription("Menu Manager queries")
public class GqlMenuManagerQuery {

    private static final Logger logger = LoggerFactory.getLogger(GqlMenuManagerQuery.class);

    // graphql-java-annotations injects OSGi services into fields only (@GraphQLOsgiService)
    @SuppressWarnings("java:S6813")
    @Inject
    @GraphQLOsgiService
    private MenuResolver resolver;

    /**
     * @param siteKey  key of the site
     * @param language language of the titles
     * @return the site's menus, in order
     */
    @GraphQLField
    @GraphQLName("menus")
    @GraphQLNonNull
    @GraphQLDescription("The menus of a site, in order; needs the manageMenus permission")
    public List<GqlMenuSummary> menus(
            @GraphQLName("siteKey") @GraphQLNonNull @GraphQLDescription("Key of the site") String siteKey,
            @GraphQLName("language") @GraphQLNonNull @GraphQLDescription("Language of the titles") String language) {
        JCRSiteNode site = MenuAccess.site(siteKey);
        MenuAccess.language(language);
        List<GqlMenuSummary> out = new ArrayList<>();
        try {
            Locale locale = LanguageCodeConverters.languageCodeToLocale(language);
            Locale fallback = LanguageCodeConverters.languageCodeToLocale(site.getDefaultLanguage());
            JCRNodeWrapper siteNode = JCRSessionFactory.getInstance().getCurrentUserSession(Constants.EDIT_WORKSPACE, locale, fallback)
                    .getNode(site.getPath());
            if (!siteNode.hasNode(MenuStore.CONTAINER)) {
                return out;
            }
            for (JCRNodeWrapper menu : siteNode.getNode(MenuStore.CONTAINER).getNodes()) {
                if (menu.isNodeType("mnu:menu")) {
                    String title = EditableReader.text(menu, "jcr:title");
                    long revision = menu.hasProperty("revision") ? menu.getProperty("revision").getLong() : 0L;
                    out.add(new GqlMenuSummary(menu.getIdentifier(), menu.getPath(), title != null ? title : menu.getName(),
                            count(menu), revision));
                }
            }
            return out;
        } catch (RepositoryException e) {
            logger.warn("could not list the menus of {}: {}", siteKey, e.toString());
            throw new DataFetchingException("The menus could not be read");
        }
    }

    /**
     * @param path     path of the menu
     * @param language the edited language
     * @return the menu as the Menus screen edits it
     */
    @GraphQLField
    @GraphQLName("editableMenu")
    @GraphQLNonNull
    @GraphQLDescription("A menu as the Menus screen edits it in one language; needs the manageMenus permission")
    public GqlEditableMenu editableMenu(
            @GraphQLName("path") @GraphQLNonNull @GraphQLDescription("Path of the menu") String path,
            @GraphQLName("language") @GraphQLNonNull @GraphQLDescription("The edited language") String language) {
        JCRNodeWrapper menu = MenuAccess.menu(path);
        try {
            return EditableReader.read(menu, MenuAccess.language(language));
        } catch (RepositoryException e) {
            logger.warn("could not read the menu {}: {}", path, e.toString());
            throw new DataFetchingException("The menu could not be read");
        }
    }

    /**
     * @param menu        identifier or path of the menu
     * @param language    the language to resolve
     * @param workspace   EDIT or LIVE (LIVE when absent)
     * @param currentPath path of the page being rendered, or null
     * @param maxDepth    levels to return, 1 to 3 (3 when absent)
     * @return the menu as the caller may see it, or null when there is no such menu the caller can read
     */
    @GraphQLField
    @GraphQLName("resolvedMenu")
    @GraphQLDescription("A menu as the caller may see it in one language: unreadable items and targets left out, labels fallen back")
    public GqlResolvedMenu resolvedMenu(
            @GraphQLName("menu") @GraphQLNonNull @GraphQLDescription("Identifier or path of the menu") String menu,
            @GraphQLName("language") @GraphQLNonNull @GraphQLDescription("The language to resolve") String language,
            @GraphQLName("workspace") @GraphQLDescription("EDIT or LIVE; LIVE when absent") String workspace,
            @GraphQLName("currentPath") @GraphQLDescription("Path of the page being rendered") String currentPath,
            @GraphQLName("maxDepth") @GraphQLDescription("Levels to return, 1 to 3; 3 when absent") Integer maxDepth) {
        String ws = "EDIT".equals(workspace) ? Constants.EDIT_WORKSPACE : Constants.LIVE_WORKSPACE;
        try {
            return resolver.resolve(menu, ws, MenuAccess.language(language), currentPath,
                            maxDepth == null ? MenuResolver.MAX_DEPTH : maxDepth)
                    .map(GqlResolvedMenu::new).orElse(null);
        } catch (RepositoryException e) {
            logger.warn("could not resolve the menu {}: {}", menu, e.toString());
            throw new DataFetchingException("The menu could not be read");
        }
    }

    private static int count(JCRNodeWrapper parent) throws RepositoryException {
        int n = 0;
        for (JCRNodeWrapper child : parent.getNodes()) {
            if (MenuItemKind.fromNodeType(child.getPrimaryNodeTypeName()).isPresent()) {
                n += 1 + count(child);
            }
        }
        return n;
    }
}
