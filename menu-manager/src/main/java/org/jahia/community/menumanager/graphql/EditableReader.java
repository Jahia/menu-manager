package org.jahia.community.menumanager.graphql;

import org.jahia.api.Constants;
import org.jahia.community.menumanager.model.MenuItemKind;
import org.jahia.services.content.JCRCallback;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.JCRTemplate;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.services.usermanager.JahiaUserManagerService;
import org.jahia.utils.LanguageCodeConverters;

import javax.jcr.RepositoryException;
import javax.jcr.Value;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Reads a menu for the Menus screen with the editor's own sessions: raw values in the edited
 * language, the fallback language's values, the state of every target, and whether a visitor who is
 * not signed in can see each item on live (checked with a guest session, which reads less than the
 * editor, never more). Not thread-safe: one instance per request.
 */
final class EditableReader {

    private final String language;
    private final String fallback;
    private final JCRSessionWrapper raw;
    private final JCRSessionWrapper fallbackRaw;
    private final JCRSessionWrapper withFallback;
    private final JCRSessionWrapper live;
    private final Locale siteDefault;
    private final List<GqlEditableItem> all = new ArrayList<>();

    private EditableReader(String language, String fallback, String siteDefault) throws RepositoryException {
        this.language = language;
        this.fallback = fallback;
        this.siteDefault = LanguageCodeConverters.languageCodeToLocale(siteDefault);
        JCRSessionFactory sessions = JCRSessionFactory.getInstance();
        Locale locale = LanguageCodeConverters.languageCodeToLocale(language);
        Locale fallbackLocale = LanguageCodeConverters.languageCodeToLocale(fallback);
        this.raw = sessions.getCurrentUserSession(Constants.EDIT_WORKSPACE, locale);
        this.fallbackRaw = sessions.getCurrentUserSession(Constants.EDIT_WORKSPACE, fallbackLocale);
        this.withFallback = sessions.getCurrentUserSession(Constants.EDIT_WORKSPACE, locale, fallbackLocale);
        this.live = sessions.getCurrentUserSession(Constants.LIVE_WORKSPACE, locale);
    }

    /**
     * @param menu     the menu, already authorised
     * @param language the edited language
     * @return the menu as the Menus screen edits it
     * @throws RepositoryException when the repository fails
     */
    static GqlEditableMenu read(JCRNodeWrapper menu, String language) throws RepositoryException {
        JCRSiteNode site = menu.getResolveSite();
        String own = text(menu, "fallbackLanguage");
        String effective = own != null ? own : site.getDefaultLanguage();
        EditableReader reader = new EditableReader(language, effective, site.getDefaultLanguage());
        JCRNodeWrapper rawMenu = reader.raw.getNodeByIdentifier(menu.getIdentifier());
        GqlEditableMenu out = new GqlEditableMenu();
        out.uuid = menu.getIdentifier();
        out.path = menu.getPath();
        out.title = text(rawMenu, "jcr:title");
        out.fallbackTitle = effective.equals(language) ? null : text(reader.fallbackRaw.getNodeByIdentifier(menu.getIdentifier()), "jcr:title");
        out.fallbackLanguage = own;
        out.effectiveFallbackLanguage = effective;
        out.revision = rawMenu.hasProperty("revision") ? rawMenu.getProperty("revision").getLong() : 0L;
        List<String> languages = new ArrayList<>();
        languages.add(site.getDefaultLanguage());
        site.getLanguages().stream().sorted().filter(l -> !l.equals(site.getDefaultLanguage())).forEach(languages::add);
        out.siteLanguages = languages;
        out.items = reader.items(rawMenu);
        reader.markPublicAccess();
        return out;
    }

    private List<GqlEditableItem> items(JCRNodeWrapper parent) throws RepositoryException {
        List<GqlEditableItem> out = new ArrayList<>();
        for (JCRNodeWrapper node : parent.getNodes()) {
            MenuItemKind kind = MenuItemKind.fromNodeType(node.getPrimaryNodeTypeName()).orElse(null);
            if (kind == null) {
                continue;
            }
            GqlEditableItem item = new GqlEditableItem();
            item.id = node.getIdentifier();
            item.kind = kind.id();
            item.label = text(node, "label");
            item.description = text(node, "description");
            if (!fallback.equals(language)) {
                JCRNodeWrapper inFallback = fallbackRaw.getNodeByIdentifier(node.getIdentifier());
                item.fallbackLabel = text(inFallback, "label");
                item.fallbackDescription = text(inFallback, "description");
            }
            String style = text(node, "itemStyle");
            item.style = style == null ? "default" : style;
            item.includeSubpages = bool(node, "includeSubpages");
            item.newTab = bool(node, "newTab");
            item.url = text(node, "url");
            item.invalidLanguages = values(node, "j:invalidLanguages");
            String reference = kind == MenuItemKind.PAGE ? "page" : kind == MenuItemKind.INTERNAL_LINK ? "target" : null;
            item.target = reference == null ? null : target(node, reference);
            item.promoTitle = text(node, "promoTitle");
            item.promoText = text(node, "promoText");
            item.promoLinkLabel = text(node, "promoLinkLabel");
            item.promoImageAlt = text(node, "promoImageAlt");
            item.promoUrl = text(node, "promoUrl");
            item.fallbackPromoTitle = fallback.equals(language) ? null : text(fallbackRaw.getNodeByIdentifier(node.getIdentifier()), "promoTitle");
            item.promoImage = target(node, "promoImage");
            item.promoTarget = target(node, "promoTarget");
            item.children = items(node);
            all.add(item);
            out.add(item);
        }
        return out;
    }

    private GqlTarget target(JCRNodeWrapper node, String property) throws RepositoryException {
        if (!node.hasProperty(property)) {
            return null;
        }
        String uuid = node.getProperty(property).getString();
        try {
            JCRNodeWrapper target = (JCRNodeWrapper) raw.getNodeByIdentifier(uuid);
            String title = text(target, "jcr:title");
            String inFallback = fallback.equals(language) ? null : text((JCRNodeWrapper) fallbackRaw.getNodeByIdentifier(uuid), "jcr:title");
            return new GqlTarget(uuid, target.getPath(), title == null && inFallback == null ? target.getDisplayableName() : title,
                    inFallback, target.getPrimaryNodeTypeName(), true, exists(live, uuid));
        } catch (RepositoryException e) {
            // deleted, or not readable by the editor: the same answer, never the target's name
            return new GqlTarget(uuid, null, null, null, null, false, false);
        }
    }

    /**
     * Sets {@code publicAccess} on every item read: true when a guest can read the item and its
     * target in live.
     */
    private void markPublicAccess() throws RepositoryException {
        Set<String> ids = new LinkedHashSet<>();
        for (GqlEditableItem item : all) {
            ids.add(item.id);
            if (item.target != null) {
                ids.add(item.target.uuid());
            }
        }
        Set<String> readable = JCRTemplate.getInstance().doExecute(
                JahiaUserManagerService.getInstance().lookupUser(JahiaUserManagerService.GUEST_USERNAME).getJahiaUser(),
                // In the site's default language: Jahia hides an item switched off in a language, and the
                // "hidden in" chip already says so.
                Constants.LIVE_WORKSPACE, siteDefault, (JCRCallback<Set<String>>) guest -> {
                    Set<String> found = new HashSet<>();
                    for (String id : ids) {
                        if (exists(guest, id)) {
                            found.add(id);
                        }
                    }
                    return found;
                });
        for (GqlEditableItem item : all) {
            item.publicAccess = readable.contains(item.id) && (item.target == null || readable.contains(item.target.uuid()));
        }
    }

    private static boolean exists(JCRSessionWrapper session, String uuid) {
        try {
            session.getNodeByIdentifier(uuid);
            return true;
        } catch (RepositoryException e) {
            return false;
        }
    }

    static String text(JCRNodeWrapper node, String property) throws RepositoryException {
        if (!node.hasProperty(property)) {
            return null;
        }
        String value = node.getProperty(property).getString();
        return value == null || value.isBlank() ? null : value;
    }

    private static boolean bool(JCRNodeWrapper node, String property) throws RepositoryException {
        return node.hasProperty(property) && node.getProperty(property).getBoolean();
    }

    private static List<String> values(JCRNodeWrapper node, String property) throws RepositoryException {
        List<String> out = new ArrayList<>();
        if (node.hasProperty(property)) {
            for (Value value : node.getProperty(property).getValues()) {
                out.add(value.getString());
            }
        }
        return out;
    }
}
