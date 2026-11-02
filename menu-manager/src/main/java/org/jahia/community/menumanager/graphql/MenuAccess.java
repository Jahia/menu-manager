package org.jahia.community.menumanager.graphql;

import org.jahia.api.Constants;
import org.jahia.community.menumanager.service.spi.MenuStore;
import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.services.usermanager.JahiaUser;
import org.jahia.services.usermanager.JahiaUserManagerService;

import javax.jcr.RepositoryException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authorises the Menus screen's fields on the server: the caller is signed in, holds
 * {@value MenuStore#PERMISSION} on the site, and the path is a menu of that site (its type checked,
 * so a caller-chosen path cannot reach another node). A guest, a malformed key or path, a missing
 * node and a missing permission get the same answer.
 */
final class MenuAccess {

    static final String DENIED = "Permission denied";
    private static final Pattern SITE_KEY = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    // A menu's own name: never "." or "..", which resolve to the container and to the site node
    private static final Pattern MENU_PATH = Pattern.compile("^/sites/([A-Za-z0-9_-]{1,64})/" + MenuStore.CONTAINER + "/(?!\\.{1,2}$)[^/]{1,255}$");
    private static final Pattern LANGUAGE = Pattern.compile("^[a-z]{2,3}(_[A-Za-z0-9]{2,8})*$");

    private MenuAccess() {
    }

    /**
     * @param siteKey key of the site
     * @return the site, read with the caller's session, once the permission is checked
     */
    static JCRSiteNode site(String siteKey) {
        signedIn();
        if (siteKey == null || !SITE_KEY.matcher(siteKey).matches()) {
            throw new DataFetchingException(DENIED);
        }
        try {
            JCRNodeWrapper node = JCRSessionFactory.getInstance().getCurrentUserSession(Constants.EDIT_WORKSPACE).getNode("/sites/" + siteKey);
            if (node instanceof JCRSiteNode site && site.hasPermission(MenuStore.PERMISSION)) {
                return site;
            }
        } catch (RepositoryException e) {
            // missing or unreadable: answered as denied below
        }
        throw new DataFetchingException(DENIED);
    }

    /**
     * @param menuPath path of a menu
     * @return the menu node, read with the caller's session, once its type and the site permission are checked
     */
    static JCRNodeWrapper menu(String menuPath) {
        signedIn();
        Matcher m = menuPath == null ? null : MENU_PATH.matcher(menuPath);
        if (m == null || !m.matches()) {
            throw new DataFetchingException(DENIED);
        }
        site(m.group(1));
        try {
            JCRNodeWrapper node = JCRSessionFactory.getInstance().getCurrentUserSession(Constants.EDIT_WORKSPACE).getNode(menuPath);
            if (node.isNodeType("mnu:menu")) {
                return node;
            }
        } catch (RepositoryException e) {
            // missing or unreadable: answered as denied below
        }
        throw new DataFetchingException(DENIED);
    }

    /**
     * @param language a language code from the caller
     * @return the code, when well formed
     */
    static String language(String language) {
        if (language == null || !LANGUAGE.matcher(language).matches()) {
            throw new DataFetchingException("Unknown language");
        }
        return language;
    }

    private static void signedIn() {
        JahiaUser user = JCRSessionFactory.getInstance().getCurrentUser();
        if (user == null || JahiaUserManagerService.isGuest(user)) {
            throw new DataFetchingException(DENIED);
        }
    }
}
