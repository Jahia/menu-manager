package org.jahia.community.menumanager.service.internal;

import org.jahia.community.menumanager.model.MenuItemKind;
import org.jahia.community.menumanager.model.ResolvedItem;
import org.jahia.community.menumanager.model.ResolvedMenu;
import org.jahia.community.menumanager.service.spi.MenuResolver;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.utils.LanguageCodeConverters;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.Node;
import javax.jcr.RepositoryException;
import javax.jcr.Value;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * {@link MenuResolver} on the calling user's own sessions: the JCR access control leaves out every item
 * and target the user cannot read, in both workspaces. Text written in the language always beats the
 * fallback language: an item shows its label in the language, else its target's title in the language,
 * else its label in the fallback language, else its target's title in the fallback language. The
 * fallback language is read through a second session, only for the nodes that need it.
 */
@Component(service = MenuResolver.class)
public class MenuResolverImpl implements MenuResolver {

    private static final Logger logger = LoggerFactory.getLogger(MenuResolverImpl.class);

    static final String MENU_TYPE = "mnu:menu";
    static final String ITEM_MIXIN = "mnumix:menuItem";
    static final String PAGE_TYPE = "jnt:page";
    static final String INVALID_LANGUAGES = "j:invalidLanguages";
    /** Jahia's own "hide in navigation menus" flag, and classic-templates' "Hide from navigation". */
    static final List<String> HIDE_FLAGS = List.of("j:hideInNavMenu", "ctplHideFromNav");

    @Override
    public Optional<ResolvedMenu> resolve(String menuIdOrPath, String workspace, String language, String currentPath, int maxDepth)
            throws RepositoryException {
        if (!"default".equals(workspace) && !"live".equals(workspace) || language == null || language.isBlank()) {
            return Optional.empty();
        }
        Locale locale = LanguageCodeConverters.languageCodeToLocale(language);
        JCRSessionFactory sessions = JCRSessionFactory.getInstance();
        JCRNodeWrapper menu = find(sessions.getCurrentUserSession(workspace, locale), menuIdOrPath);
        if (menu == null || !menu.isNodeType(MENU_TYPE)) {
            return Optional.empty();
        }
        Locale fallback = fallbackLocale(menu, language);
        JCRSessionWrapper inFallback = fallback == null ? null : sessions.getCurrentUserSession(workspace, fallback);
        FallbackLookup lookup = inFallback == null ? null : node -> inFallback.getNodeByIdentifier(node.getIdentifier());
        Context ctx = new Context(language, currentPath, Math.max(1, Math.min(MAX_DEPTH, maxDepth)), lookup);
        ctx.dependencies.add(menu.getPath() + "/*");
        List<ResolvedItem> items = children(menu, 1, ctx);
        return Optional.of(new ResolvedMenu(menu.getIdentifier(), menu.getPath(), first(text(menu, "jcr:title"), ctx.fallback(menu, "jcr:title")),
                language, items, new ArrayList<>(ctx.dependencies)));
    }

    /**
     * The visible items under {@code parent}, at {@code depth} (1 for the top level).
     */
    List<ResolvedItem> children(JCRNodeWrapper parent, int depth, Context ctx) throws RepositoryException {
        List<ResolvedItem> out = new ArrayList<>();
        if (depth > ctx.maxDepth) {
            return out;
        }
        for (JCRNodeWrapper child : parent.getNodes()) {
            if (child.isNodeType(ITEM_MIXIN) && !invalidIn(child, ctx.language)) {
                item(child, depth, ctx).ifPresent(out::add);
            }
        }
        return out;
    }

    private Optional<ResolvedItem> item(JCRNodeWrapper node, int depth, Context ctx) throws RepositoryException {
        MenuItemKind kind = MenuItemKind.fromNodeType(node.getPrimaryNodeTypeName()).orElse(null);
        if (kind == null) {
            return Optional.empty();
        }
        String label = text(node, "label");
        String fallbackLabel = label == null ? ctx.fallback(node, "label") : null;
        String description = first(text(node, "description"), ctx.fallback(node, "description"));
        String chosenStyle = text(node, "itemStyle");
        String style = chosenStyle == null ? "default" : chosenStyle;
        return switch (kind) {
            case PAGE -> pageItem(node, label, fallbackLabel, description, style, depth, ctx);
            case SECTION -> {
                List<ResolvedItem> kids = children(node, depth + 1, ctx);
                // A heading over nothing the visitor may see says nothing: left out.
                String shown = first(label, fallbackLabel);
                yield shown == null || kids.isEmpty() ? Optional.empty()
                        : Optional.of(new ResolvedItem(node.getIdentifier(), kind, shown, description, style, null, null, null,
                        false, false, false, kids));
            }
            case INTERNAL_LINK -> {
                JCRNodeWrapper target = target(node, "target");
                if (target == null || invalidIn(target, ctx.language)) {
                    yield Optional.empty();
                }
                ctx.dependencies.add(target.getPath());
                String shown = first(label, text(target, "jcr:title"), fallbackLabel, ctx.fallback(target, "jcr:title"),
                        target.getDisplayableName());
                yield Optional.of(new ResolvedItem(node.getIdentifier(), kind, shown, description, style, target.getIdentifier(),
                        target.getPath(), null, bool(node, "newTab"), ctx.isCurrent(target), ctx.inTrail(target),
                        children(node, depth + 1, ctx)));
            }
            case EXTERNAL_LINK -> {
                String url = UrlPolicy.check(text(node, "url")).orElse(null);
                yield url == null ? Optional.empty()
                        : Optional.of(new ResolvedItem(node.getIdentifier(), kind, first(label, fallbackLabel, url), description, style, null, null, url,
                        bool(node, "newTab"), false, false, children(node, depth + 1, ctx)));
            }
        };
    }

    private Optional<ResolvedItem> pageItem(JCRNodeWrapper node, String label, String fallbackLabel, String description, String style,
                                            int depth, Context ctx)
            throws RepositoryException {
        JCRNodeWrapper page = target(node, "page");
        if (page == null || !page.isNodeType(PAGE_TYPE) || invalidIn(page, ctx.language)) {
            return Optional.empty();
        }
        String shown = first(label, text(page, "jcr:title"), fallbackLabel, ctx.fallback(page, "jcr:title"));
        if (shown == null) {
            return Optional.empty();
        }
        ctx.dependencies.add(page.getPath());
        List<ResolvedItem> kids = children(node, depth + 1, ctx);
        if (bool(node, "includeSubpages")) {
            ctx.dependencies.add(page.getPath() + "/*");
            kids.addAll(subpages(page, depth + 1, ctx));
        }
        return Optional.of(new ResolvedItem(node.getIdentifier(), MenuItemKind.PAGE, shown, description, style, page.getIdentifier(),
                page.getPath(), null, false, ctx.isCurrent(page), ctx.inTrail(page), kids));
    }

    /**
     * The subpages of an included page shown in navigation: pages only, not hidden from navigation, not
     * switched off in the language, titled in the language or the fallback language.
     */
    List<ResolvedItem> subpages(JCRNodeWrapper page, int depth, Context ctx) throws RepositoryException {
        List<ResolvedItem> out = new ArrayList<>();
        if (depth > ctx.maxDepth) {
            return out;
        }
        for (JCRNodeWrapper child : page.getNodes()) {
            if (!child.isNodeType(PAGE_TYPE) || hiddenFromNavigation(child) || invalidIn(child, ctx.language)) {
                continue;
            }
            String title = first(text(child, "jcr:title"), ctx.fallback(child, "jcr:title"));
            if (title != null) {
                out.add(new ResolvedItem(child.getIdentifier(), MenuItemKind.PAGE, title, null, "default", child.getIdentifier(),
                        child.getPath(), null, false, ctx.isCurrent(child), ctx.inTrail(child), subpages(child, depth + 1, ctx)));
            }
        }
        return out;
    }


    /**
     * The node a weak reference points to, or null when it is gone, unpublished in this workspace, or
     * not readable by the caller: all three hide the item.
     */
    static JCRNodeWrapper target(JCRNodeWrapper node, String property) {
        try {
            if (!node.hasProperty(property)) {
                return null;
            }
            Node target = node.getProperty(property).getNode();
            return target instanceof JCRNodeWrapper wrapper ? wrapper : null;
        } catch (RepositoryException e) {
            logger.debug("target of {} not readable: {}", node.getPath(), e.toString());
            return null;
        }
    }

    static boolean invalidIn(JCRNodeWrapper node, String language) throws RepositoryException {
        if (!node.hasProperty(INVALID_LANGUAGES)) {
            return false;
        }
        for (Value value : node.getProperty(INVALID_LANGUAGES).getValues()) {
            if (language.equals(value.getString())) {
                return true;
            }
        }
        return false;
    }

    static boolean hiddenFromNavigation(JCRNodeWrapper page) throws RepositoryException {
        for (String flag : HIDE_FLAGS) {
            if (page.hasProperty(flag) && page.getProperty(flag).getBoolean()) {
                return true;
            }
        }
        return false;
    }

    static String text(JCRNodeWrapper node, String property) throws RepositoryException {
        if (!node.hasProperty(property)) {
            return null;
        }
        String value = node.getProperty(property).getString();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static boolean bool(JCRNodeWrapper node, String property) {
        try {
            return node.hasProperty(property) && node.getProperty(property).getBoolean();
        } catch (RepositoryException e) {
            return false;
        }
    }

    static String first(String... candidates) {
        for (String c : candidates) {
            if (c != null && !c.isBlank()) {
                return c.trim();
            }
        }
        return null;
    }

    /**
     * The menu's fallback language, else its site's default language; null when it is the language
     * being resolved.
     */
    private static Locale fallbackLocale(JCRNodeWrapper menu, String language) throws RepositoryException {
        String fallback = text(menu, "fallbackLanguage");
        if (fallback == null && menu.getResolveSite() != null) {
            fallback = menu.getResolveSite().getDefaultLanguage();
        }
        return fallback == null || fallback.equals(language) ? null : LanguageCodeConverters.languageCodeToLocale(fallback);
    }

    private static JCRNodeWrapper find(JCRSessionWrapper session, String idOrPath) {
        if (idOrPath == null || idOrPath.isBlank()) {
            return null;
        }
        try {
            return idOrPath.startsWith("/") ? session.getNode(idOrPath) : session.getNodeByIdentifier(idOrPath);
        } catch (RepositoryException e) {
            // missing, unreadable or malformed: all answered as "no menu"
            return null;
        }
    }

    /** The same node, read in the fallback language. */
    @FunctionalInterface
    interface FallbackLookup {
        /**
         * @param node a node read in the language
         * @return the same node read in the fallback language
         * @throws RepositoryException when it cannot be read
         */
        JCRNodeWrapper find(JCRNodeWrapper node) throws RepositoryException;
    }

    /**
     * What one resolution carries along: the language, the current page, the depth, the fallback
     * language's reads and the dependencies.
     */
    static final class Context {
        final String language;
        final String currentPath;
        final int maxDepth;
        final FallbackLookup fallbackLookup;
        final Set<String> dependencies = new LinkedHashSet<>();

        Context(String language, String currentPath, int maxDepth, FallbackLookup fallbackLookup) {
            this.language = language;
            this.currentPath = currentPath;
            this.maxDepth = maxDepth;
            this.fallbackLookup = fallbackLookup;
        }

        /**
         * @return the property in the fallback language, or null when there is no fallback language,
         *         no value, or the node cannot be read in it
         */
        String fallback(JCRNodeWrapper node, String property) {
            if (fallbackLookup == null) {
                return null;
            }
            try {
                return text(fallbackLookup.find(node), property);
            } catch (RepositoryException e) {
                return null;
            }
        }

        boolean isCurrent(JCRNodeWrapper target) {
            return currentPath != null && currentPath.equals(target.getPath());
        }

        boolean inTrail(JCRNodeWrapper target) {
            return currentPath != null && currentPath.startsWith(target.getPath() + "/");
        }
    }
}
