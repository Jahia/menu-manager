package org.jahia.community.menumanager.service.internal;

import org.jahia.api.Constants;
import org.jahia.community.menumanager.model.MenuException;
import org.jahia.community.menumanager.model.MenuItemKind;
import org.jahia.community.menumanager.model.SaveOutcome;
import org.jahia.community.menumanager.service.spi.MenuStore;
import org.jahia.services.content.JCRContentUtils;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.utils.LanguageCodeConverters;
import org.osgi.service.component.annotations.Component;

import javax.jcr.RepositoryException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * {@link MenuStore} on the calling user's session in the default workspace, opened in the language
 * being written: i18n properties set or removed through it change that translation only.
 */
@Component(service = MenuStore.class)
public class MenuStoreImpl implements MenuStore {

    /** The page item's reference to its page. */
    private static final String PAGE_PROPERTY = "page";

    static final String MENUS_TYPE = "mnu:menus";
    static final String REVISION = "revision";
    private static final String TITLE = "jcr:title";

    @Override
    public String create(String siteKey, String title, String language) throws RepositoryException {
        JCRSessionWrapper session = session(language);
        JCRNodeWrapper site = session.getNode("/sites/" + siteKey);
        JCRNodeWrapper menus = site.hasNode(CONTAINER) ? site.getNode(CONTAINER) : site.addNode(CONTAINER, MENUS_TYPE);
        String name = JCRContentUtils.findAvailableNodeName(menus, JCRContentUtils.generateNodeName(title));
        JCRNodeWrapper menu = menus.addNode(name, MenuResolverImpl.MENU_TYPE);
        menu.setProperty(TITLE, title);
        session.save();
        return menu.getPath();
    }

    @Override
    public void update(String menuPath, String language, String title, String fallbackLanguage) throws RepositoryException {
        JCRSessionWrapper session = session(language);
        JCRNodeWrapper menu = session.getNode(menuPath);
        if (title != null && !title.isBlank()) {
            menu.setProperty(TITLE, title.trim());
        }
        if (fallbackLanguage != null) {
            if (fallbackLanguage.isBlank()) {
                if (menu.hasProperty("fallbackLanguage")) {
                    menu.getProperty("fallbackLanguage").remove();
                }
            } else {
                menu.setProperty("fallbackLanguage", fallbackLanguage);
            }
        }
        session.save();
    }

    @Override
    public String duplicate(String menuPath, String title, String language) throws RepositoryException {
        JCRSessionWrapper session = session(language);
        JCRNodeWrapper menu = session.getNode(menuPath);
        JCRNodeWrapper menus = menu.getParent();
        String name = JCRContentUtils.findAvailableNodeName(menus, JCRContentUtils.generateNodeName(title));
        menu.copy(menus, name, false);
        JCRNodeWrapper copy = menus.getNode(name);
        copy.setProperty(TITLE, title);
        copy.setProperty(REVISION, 0L);
        session.save();
        return copy.getPath();
    }

    @Override
    public void delete(String menuPath) throws RepositoryException {
        JCRSessionWrapper session = JCRSessionFactory.getInstance().getCurrentUserSession(Constants.EDIT_WORKSPACE);
        session.getNode(menuPath).remove();
        session.save();
    }

    @Override
    public SaveOutcome save(String menuPath, String language, long expectedRevision, String treeJson)
            throws MenuException, RepositoryException {
        MenuTree tree = MenuTree.parse(treeJson);
        JCRSessionWrapper session = session(language);
        JCRNodeWrapper menu = session.getNode(menuPath);
        long revision = menu.hasProperty(REVISION) ? menu.getProperty(REVISION).getLong() : 0L;
        if (revision != expectedRevision) {
            throw new MenuException(MenuException.CONFLICT, "Menu " + menuPath + " is at revision " + revision + ", not " + expectedRevision);
        }
        Map<String, JCRNodeWrapper> existing = new HashMap<>();
        collect(menu, existing);
        Set<String> kept = new HashSet<>();
        try {
            apply(session, menu, tree.items(), existing, kept);
            for (Map.Entry<String, JCRNodeWrapper> entry : existing.entrySet()) {
                if (!kept.contains(entry.getKey()) && stillThere(session, entry.getKey())) {
                    session.getNodeByIdentifier(entry.getKey()).remove();
                }
            }
            menu.setProperty(REVISION, revision + 1);
            session.save();
        } catch (MenuException | RepositoryException e) {
            // a refusal halfway leaves nothing pending in the request's session for another call to save
            session.refresh(false);
            throw e;
        }
        return new SaveOutcome(revision + 1, tree.count());
    }

    private void apply(JCRSessionWrapper session, JCRNodeWrapper parent, List<MenuTree.Item> items,
                       Map<String, JCRNodeWrapper> existing, Set<String> kept) throws MenuException, RepositoryException {
        List<String> order = new ArrayList<>();
        for (MenuTree.Item item : items) {
            JCRNodeWrapper node = item.id() == null ? null : existing.get(item.id());
            if (node != null && (!node.isNodeType(item.kind().nodeType()) || kept.contains(item.id()))) {
                // another kind, or the same id twice: a new node; the old one goes with the removals
                node = null;
            }
            if (node == null) {
                node = parent.addNode(JCRContentUtils.findAvailableNodeName(parent, nodeName(item.kind())), item.kind().nodeType());
            } else if (!node.getParent().getIdentifier().equals(parent.getIdentifier()) || node.getName().equals(PAGE_PROPERTY)) {
                // moved under another item, or named "page" by an earlier version (see nodeName)
                String name = JCRContentUtils.findAvailableNodeName(parent, nodeName(item.kind()));
                session.move(node.getPath(), parent.getPath() + "/" + name);
                node = session.getNodeByIdentifier(node.getIdentifier());
            }
            kept.add(node.getIdentifier());
            write(session, node, item);
            apply(session, node, item.children(), existing, kept);
            order.add(node.getName());
        }
        for (int i = order.size() - 1; i >= 0; i--) {
            parent.orderBefore(order.get(i), i + 1 < order.size() ? order.get(i + 1) : null);
        }
    }

    /**
     * The name of a new item node: its type's local name ({@code pageItem}), never a name an item's
     * property also has. A page item's first page item was once named {@code page}, beside the item's own
     * {@code page} property: publication then dropped that property in live, and the item vanished from
     * the visitors' menu while the editor showed it published (tests/edge-cases.spec.ts).
     *
     * @param kind the item's kind
     * @return the base name, made unique by the caller
     */
    static String nodeName(MenuItemKind kind) {
        String type = kind.nodeType();
        return type.substring(type.indexOf(':') + 1);
    }

    private static void write(JCRSessionWrapper session, JCRNodeWrapper node, MenuTree.Item item) throws MenuException, RepositoryException {
        setOrRemove(node, "label", item.label());
        setOrRemove(node, "description", item.description());
        node.setProperty("itemStyle", item.style());
        if (item.invalidLanguages().isEmpty()) {
            if (node.hasProperty(MenuResolverImpl.INVALID_LANGUAGES)) {
                node.getProperty(MenuResolverImpl.INVALID_LANGUAGES).remove();
            }
        } else {
            if (!node.isNodeType("jmix:i18n")) {
                node.addMixin("jmix:i18n");
            }
            node.setProperty(MenuResolverImpl.INVALID_LANGUAGES, item.invalidLanguages().toArray(new String[0]));
        }
        writePromo(session, node, item.promo());
        switch (item.kind()) {
            case PAGE -> {
                if (!keeps(node, PAGE_PROPERTY, item.reference())) {
                    JCRNodeWrapper page = reference(session, item.reference());
                    if (!page.isNodeType(MenuResolverImpl.PAGE_TYPE)) {
                        throw new MenuException(MenuException.BAD_TARGET, "Not a page: " + item.reference());
                    }
                    node.setProperty(PAGE_PROPERTY, session.getValueFactory().createValue(page, true));
                }
                node.setProperty("includeSubpages", item.includeSubpages());
            }
            case INTERNAL_LINK -> {
                if (!keeps(node, "target", item.reference())) {
                    node.setProperty("target", session.getValueFactory().createValue(reference(session, item.reference()), true));
                }
                node.setProperty("newTab", item.newTab());
            }
            case EXTERNAL_LINK -> {
                node.setProperty("url", item.url());
                node.setProperty("newTab", item.newTab());
            }
            case SECTION -> {
                // a label and children only
            }
        }
    }

    private static void writePromo(JCRSessionWrapper session, JCRNodeWrapper node, MenuTree.Promo promo) throws MenuException, RepositoryException {
        setOrRemove(node, "promoTitle", promo.title());
        setOrRemove(node, "promoText", promo.text());
        setOrRemove(node, "promoLinkLabel", promo.linkLabel());
        setOrRemove(node, "promoImageAlt", promo.imageAlt());
        setOrRemove(node, "promoUrl", promo.url());
        if (promo.image() == null) {
            setOrRemove(node, "promoImage", null);
        } else if (!keeps(node, "promoImage", promo.image())) {
            JCRNodeWrapper image = reference(session, promo.image());
            if (!image.isNodeType("jmix:image")) {
                throw new MenuException(MenuException.BAD_TARGET, "Not an image: " + promo.image());
            }
            node.setProperty("promoImage", session.getValueFactory().createValue(image, true));
        }
        if (promo.target() == null) {
            setOrRemove(node, "promoTarget", null);
        } else if (!keeps(node, "promoTarget", promo.target())) {
            node.setProperty("promoTarget", session.getValueFactory().createValue(reference(session, promo.target()), true));
        }
    }

    /**
     * Whether the item already holds this reference, unchanged: it is then kept without being read, so a
     * target deleted since, or one this editor cannot read (another editor linked it), never blocks the
     * save of the rest of the menu. Only a new or changed reference is checked.
     */
    private static boolean keeps(JCRNodeWrapper node, String property, String id) throws RepositoryException {
        return node.hasProperty(property) && node.getProperty(property).getString().equals(id);
    }

    private static JCRNodeWrapper reference(JCRSessionWrapper session, String id) throws MenuException {
        try {
            return session.getNodeByIdentifier(id);
        } catch (RepositoryException e) {
            // gone, or not readable by the editor: the same answer
            throw new MenuException(MenuException.BAD_TARGET, "Target not found: " + id);
        }
    }

    private static void setOrRemove(JCRNodeWrapper node, String property, String value) throws RepositoryException {
        if (value != null) {
            node.setProperty(property, value);
        } else if (node.hasProperty(property)) {
            node.getProperty(property).remove();
        }
    }

    private static void collect(JCRNodeWrapper parent, Map<String, JCRNodeWrapper> into) throws RepositoryException {
        for (JCRNodeWrapper child : parent.getNodes()) {
            if (MenuItemKind.fromNodeType(child.getPrimaryNodeTypeName()).isPresent()) {
                into.put(child.getIdentifier(), child);
                collect(child, into);
            }
        }
    }

    private static boolean stillThere(JCRSessionWrapper session, String id) {
        try {
            session.getNodeByIdentifier(id);
            return true;
        } catch (RepositoryException e) {
            return false;
        }
    }

    private static JCRSessionWrapper session(String language) throws RepositoryException {
        return JCRSessionFactory.getInstance().getCurrentUserSession(Constants.EDIT_WORKSPACE,
                LanguageCodeConverters.languageCodeToLocale(language));
    }
}
