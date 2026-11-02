package org.jahia.community.menumanager.service.internal;

import org.jahia.community.menumanager.model.MenuException;
import org.jahia.community.menumanager.model.MenuItemKind;
import org.jahia.community.menumanager.service.spi.MenuResolver;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * A menu tree sent by the Menus screen, parsed and checked before anything is written: known kinds,
 * three levels at most, {@value #MAX_ITEMS} items at most, the reference each kind needs, an allowed
 * external address, bounded texts and well-formed identifiers. Pure: no repository access.
 *
 * <pre>
 * {"items": [{"id": "&lt;uuid, absent for a new item&gt;", "kind": "page|section|internalLink|externalLink",
 *   "label": "...", "description": "...", "style": "default|highlight|button",
 *   "page": "&lt;uuid&gt;", "includeSubpages": false, "target": "&lt;uuid&gt;", "url": "https://...",
 *   "newTab": false, "invalidLanguages": ["zh"],
 *   "promotion": {"title": "...", "text": "...", "linkLabel": "...", "imageAlt": "...", "image": "&lt;uuid&gt;",
 *                 "target": "&lt;uuid&gt;", "url": "https://..."},
 *   "children": [ ... ]}]}
 * </pre>
 */
public final class MenuTree {

    /** Most items a menu may hold. */
    public static final int MAX_ITEMS = 500;
    /** Longest label. */
    public static final int MAX_LABEL = 200;
    /** Longest description. */
    public static final int MAX_DESCRIPTION = 1000;
    /** Longest promotion text. */
    public static final int MAX_PROMO_TEXT = 1000;
    /** The styles an item may take. */
    public static final Set<String> STYLES = Set.of("default", "highlight", "button");

    private static final Pattern UUID = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern LANGUAGE = Pattern.compile("^[a-z]{2,3}(_[A-Za-z0-9]{2,8})*$");

    /**
     * An item's promotion: every field may be null (null removes it; a promotion without a title shows nothing).
     *
     * @param title     the title in the saved language
     * @param text      the text in the saved language
     * @param linkLabel the button's label in the saved language
     * @param imageAlt  the image's text alternative in the saved language
     * @param image     identifier of the image
     * @param target    identifier of the node the button opens
     * @param url       the checked address the button opens
     */
    public record Promo(String title, String text, String linkLabel, String imageAlt, String image, String target, String url) {
        /** No promotion. */
        public static final Promo NONE = new Promo(null, null, null, null, null, null, null);
    }

    /**
     * One item of the tree.
     *
     * @param id               identifier of an existing item, or null for a new one
     * @param kind             what the item is
     * @param label            the label in the saved language, or null to remove it
     * @param description      the description in the saved language, or null to remove it
     * @param style            one of {@link #STYLES}
     * @param reference        identifier of the page (page item) or target (internal link), else null
     * @param includeSubpages  for a page item, whether its subpages follow
     * @param url              for an external link, the checked address, else null
     * @param newTab           for a link, whether it opens in a new tab
     * @param invalidLanguages languages the item is hidden in
     * @param promo            its promotion
     * @param children         its items
     */
    public record Item(String id, MenuItemKind kind, String label, String description, String style, String reference,
                       boolean includeSubpages, String url, boolean newTab, List<String> invalidLanguages, Promo promo, List<Item> children) {

        /**
         * Copies the lists, so the record stays immutable.
         */
        public Item {
            invalidLanguages = List.copyOf(invalidLanguages);
            children = List.copyOf(children);
        }
    }

    private final List<Item> items;
    private final int count;

    private MenuTree(List<Item> items, int count) {
        this.items = List.copyOf(items);
        this.count = count;
    }

    /**
     * @return the top-level items, in order
     */
    public List<Item> items() {
        return items;
    }

    /**
     * @return the number of items at every level
     */
    public int count() {
        return count;
    }

    /**
     * @param json the tree as sent by the Menus screen
     * @return the checked tree
     * @throws MenuException with the code of the first problem found
     */
    public static MenuTree parse(String json) throws MenuException {
        JSONObject root;
        try {
            root = new JSONObject(json == null ? "" : json);
        } catch (JSONException e) {
            throw new MenuException(MenuException.UNREADABLE, "The menu could not be read");
        }
        int[] count = {0};
        List<Item> items = items(root.optJSONArray("items"), 1, count);
        return new MenuTree(items, count[0]);
    }

    private static List<Item> items(JSONArray array, int depth, int[] count) throws MenuException {
        List<Item> out = new ArrayList<>();
        if (array == null) {
            return out;
        }
        if (depth > MenuResolver.MAX_DEPTH) {
            throw new MenuException(MenuException.TOO_DEEP, "More than " + MenuResolver.MAX_DEPTH + " levels");
        }
        for (int i = 0; i < array.length(); i++) {
            JSONObject o = array.optJSONObject(i);
            if (o == null) {
                throw new MenuException(MenuException.UNREADABLE, "The menu could not be read");
            }
            if (++count[0] > MAX_ITEMS) {
                throw new MenuException(MenuException.TOO_MANY, "More than " + MAX_ITEMS + " items");
            }
            out.add(item(o, depth, count));
        }
        return out;
    }

    private static Item item(JSONObject o, int depth, int[] count) throws MenuException {
        String id = text(o, "id");
        if (id != null && !UUID.matcher(id).matches()) {
            throw new MenuException(MenuException.UNREADABLE, "The menu could not be read");
        }
        MenuItemKind kind = MenuItemKind.fromId(text(o, "kind")).orElseThrow(() -> new MenuException(MenuException.UNKNOWN_VALUE, "Unknown kind"));
        String label = bounded(text(o, "label"), MAX_LABEL, "Label longer than " + MAX_LABEL);
        String description = bounded(text(o, "description"), MAX_DESCRIPTION, "Description longer than " + MAX_DESCRIPTION);
        String style = text(o, "style") == null ? "default" : text(o, "style");
        if (!STYLES.contains(style)) {
            throw new MenuException(MenuException.UNKNOWN_VALUE, "Unknown style");
        }
        String reference = null;
        String url = null;
        switch (kind) {
            case PAGE -> reference = uuid(o, "page", "Page item without a page");
            case INTERNAL_LINK -> reference = uuid(o, "target", "Internal link without a target");
            case EXTERNAL_LINK -> url = UrlPolicy.check(text(o, "url"))
                    .orElseThrow(() -> new MenuException(MenuException.BAD_URL, "External address not allowed"));
            case SECTION -> {
                // A new section needs a label; a stored one may have none in this language (it falls back).
                if (label == null && id == null) {
                    throw new MenuException(MenuException.SECTION_LABEL, "Section without a label");
                }
            }
        }
        List<String> invalid = new ArrayList<>();
        JSONArray langs = o.optJSONArray("invalidLanguages");
        if (langs != null) {
            for (int i = 0; i < langs.length(); i++) {
                String lang = langs.optString(i, "");
                if (!LANGUAGE.matcher(lang).matches()) {
                    throw new MenuException(MenuException.UNKNOWN_VALUE, "Unknown language code");
                }
                invalid.add(lang);
            }
        }
        boolean link = kind == MenuItemKind.INTERNAL_LINK || kind == MenuItemKind.EXTERNAL_LINK;
        return new Item(id, kind, label, description, style, reference,
                kind == MenuItemKind.PAGE && o.optBoolean("includeSubpages", false), url,
                link && o.optBoolean("newTab", false), invalid, promo(o.optJSONObject("promotion")),
                items(o.optJSONArray("children"), depth + 1, count));
    }

    private static Promo promo(JSONObject p) throws MenuException {
        if (p == null) {
            return Promo.NONE;
        }
        String tooLong = "Promotion field too long";
        String image = text(p, "image");
        String target = text(p, "target");
        String rawUrl = text(p, "url");
        if ((image != null && !UUID.matcher(image).matches()) || (target != null && !UUID.matcher(target).matches())) {
            throw new MenuException(MenuException.UNREADABLE, "Promotion reference malformed");
        }
        String url = rawUrl == null ? null : UrlPolicy.check(rawUrl)
                .orElseThrow(() -> new MenuException(MenuException.BAD_URL, "Promotion address not allowed"));
        return new Promo(bounded(text(p, "title"), MAX_LABEL, tooLong), bounded(text(p, "text"), MAX_PROMO_TEXT, tooLong),
                bounded(text(p, "linkLabel"), MAX_LABEL, tooLong), bounded(text(p, "imageAlt"), MAX_LABEL, tooLong), image, target, url);
    }

    private static String uuid(JSONObject o, String key, String missing) throws MenuException {
        String value = text(o, key);
        if (value == null || !UUID.matcher(value).matches()) {
            throw new MenuException(MenuException.NO_TARGET, missing);
        }
        return value;
    }

    private static String text(JSONObject o, String key) {
        if (!o.has(key) || o.isNull(key)) {
            return null;
        }
        String value = String.valueOf(o.get(key)).trim();
        return value.isEmpty() ? null : value;
    }

    private static String bounded(String value, int max, String tooLong) throws MenuException {
        if (value != null && value.length() > max) {
            throw new MenuException(MenuException.TOO_LONG, tooLong);
        }
        return value;
    }
}
