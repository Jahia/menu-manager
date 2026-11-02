package org.jahia.community.menumanager.service.internal;

import org.jahia.community.menumanager.model.MenuException;
import org.jahia.community.menumanager.model.MenuItemKind;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MenuTreeTest {

    private static final String PAGE = "11111111-2222-3333-4444-555555555555";
    private static final String ITEM = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    @Test
    void parsesANestedTree() throws MenuException {
        MenuTree tree = MenuTree.parse("""
                {"items": [
                  {"id": "%s", "kind": "page", "page": "%s", "label": " Products ", "includeSubpages": true, "newTab": true,
                   "children": [
                     {"kind": "section", "label": "Popular", "children": [
                       {"kind": "externalLink", "url": "https://www.example.com", "newTab": true, "invalidLanguages": ["zh"]}]}]},
                  {"kind": "internalLink", "target": "%s", "style": "button"}]}
                """.formatted(ITEM, PAGE, PAGE));
        assertThat(tree.count()).isEqualTo(4);
        MenuTree.Item page = tree.items().get(0);
        assertThat(page.id()).isEqualTo(ITEM);
        assertThat(page.kind()).isEqualTo(MenuItemKind.PAGE);
        assertThat(page.label()).isEqualTo("Products");
        assertThat(page.includeSubpages()).isTrue();
        assertThat(page.newTab()).as("new tab is for links only").isFalse();
        MenuTree.Item link = page.children().get(0).children().get(0);
        assertThat(link.url()).isEqualTo("https://www.example.com");
        assertThat(link.newTab()).isTrue();
        assertThat(link.invalidLanguages()).containsExactly("zh");
        assertThat(tree.items().get(1).style()).isEqualTo("button");
        assertThat(tree.items().get(1).reference()).isEqualTo(PAGE);
    }

    @Test
    void readsAPromotionAndChecksIt() throws MenuException {
        MenuTree tree = MenuTree.parse("""
                {"items": [{"kind": "section", "label": "Products", "promotion": {"title": " New kits ", "text": "Out now",
                  "linkLabel": "See", "image": "%s", "target": "%s", "url": null}}]}
                """.formatted(PAGE, ITEM));
        MenuTree.Promo promo = tree.items().get(0).promo();
        assertThat(promo.title()).isEqualTo("New kits");
        assertThat(promo.image()).isEqualTo(PAGE);
        assertThat(promo.target()).isEqualTo(ITEM);
        assertThat(promo.url()).isNull();
        assertThat(MenuTree.parse("{\"items\": [{\"kind\": \"section\", \"label\": \"x\"}]}").items().get(0).promo())
                .isEqualTo(MenuTree.Promo.NONE);
        assertCode("{\"items\": [{\"kind\": \"section\", \"label\": \"x\", \"promotion\": {\"url\": \"javascript:x\"}}]}",
                MenuException.BAD_URL);
        assertCode("{\"items\": [{\"kind\": \"section\", \"label\": \"x\", \"promotion\": {\"image\": \"../etc\"}}]}",
                MenuException.UNREADABLE);
    }

    @Test
    void anEmptyTreeIsAnEmptyMenu() throws MenuException {
        assertThat(MenuTree.parse("{}").count()).isZero();
        assertThat(MenuTree.parse("{\"items\": []}").items()).isEmpty();
    }

    @Test
    void aStoredSectionMayHaveNoLabelInTheSavedLanguage() throws MenuException {
        MenuTree tree = MenuTree.parse("{\"items\": [{\"id\": \"%s\", \"kind\": \"section\"}]}".formatted(ITEM));
        assertThat(tree.items().get(0).label()).isNull();
    }

    @Test
    void refusesAFourthLevel() {
        String deep = "{\"kind\": \"section\", \"label\": \"x\", \"children\": [%s]}";
        String leaf = "{\"kind\": \"externalLink\", \"url\": \"https://a.example\"}";
        String four = deep.formatted(deep.formatted(deep.formatted(leaf)));
        assertCode("{\"items\": [" + four + "]}", MenuException.TOO_DEEP);
        String three = deep.formatted(deep.formatted(leaf));
        assertThat(parseQuietly("{\"items\": [" + three + "]}")).isNotNull();
    }

    @Test
    void refusesTooManyItems() {
        String leaf = "{\"kind\": \"externalLink\", \"url\": \"https://a.example\"}";
        String items = String.join(",", java.util.Collections.nCopies(MenuTree.MAX_ITEMS + 1, leaf));
        assertCode("{\"items\": [" + items + "]}", MenuException.TOO_MANY);
    }

    @Test
    void refusesInvalidItems() {
        assertCode("not json", MenuException.UNREADABLE);
        assertCode("{\"items\": [42]}", MenuException.UNREADABLE);
        assertCode("{\"items\": [{\"id\": \"../x\", \"kind\": \"section\", \"label\": \"x\"}]}", MenuException.UNREADABLE);
        assertCode("{\"items\": [{\"kind\": \"folder\"}]}", MenuException.UNKNOWN_VALUE);
        assertCode("{\"items\": [{\"kind\": \"section\"}]}", MenuException.SECTION_LABEL);
        assertCode("{\"items\": [{\"kind\": \"page\"}]}", MenuException.NO_TARGET);
        assertCode("{\"items\": [{\"kind\": \"internalLink\", \"target\": \"/sites/x\"}]}", MenuException.NO_TARGET);
        assertCode("{\"items\": [{\"kind\": \"externalLink\", \"url\": \"javascript:alert(1)\"}]}", MenuException.BAD_URL);
        assertCode("{\"items\": [{\"kind\": \"section\", \"label\": \"x\", \"style\": \"red\"}]}", MenuException.UNKNOWN_VALUE);
        assertCode("{\"items\": [{\"kind\": \"section\", \"label\": \"x\", \"invalidLanguages\": [\"<b>\"]}]}", MenuException.UNKNOWN_VALUE);
        assertCode("{\"items\": [{\"kind\": \"section\", \"label\": \"" + "x".repeat(MenuTree.MAX_LABEL + 1) + "\"}]}", MenuException.TOO_LONG);
    }

    private static void assertCode(String json, String code) {
        assertThatThrownBy(() -> MenuTree.parse(json)).isInstanceOf(MenuException.class)
                .satisfies(e -> assertThat(((MenuException) e).code()).isEqualTo(code));
    }

    private static MenuTree parseQuietly(String json) {
        try {
            return MenuTree.parse(json);
        } catch (MenuException e) {
            return null;
        }
    }
}
