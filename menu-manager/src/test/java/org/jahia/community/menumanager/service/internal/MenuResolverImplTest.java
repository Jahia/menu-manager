package org.jahia.community.menumanager.service.internal;

import org.jahia.community.menumanager.model.MenuItemKind;
import org.jahia.community.menumanager.model.ResolvedItem;
import org.jahia.services.content.JCRNodeIteratorWrapper;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRPropertyWrapper;
import org.jahia.services.content.JCRValueWrapper;
import org.junit.jupiter.api.Test;

import javax.jcr.ItemNotFoundException;
import javax.jcr.RepositoryException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The resolver's filtering rules on mocked nodes: what a visitor may not see, or that has nothing to
 * show in the language, is left out with everything under it.
 */
class MenuResolverImplTest {

    private final MenuResolverImpl resolver = new MenuResolverImpl();

    @Test
    void aPageItemShowsItsPageTitleWhenItHasNoLabel() throws RepositoryException {
        JCRNodeWrapper page = node("p1", "/sites/s/home/products", "jnt:page").prop("jcr:title", "Products").build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu")
                .child(node("i1", "/sites/s/menus/main/page", "mnu:pageItem").ref("page", page).build()).build();

        List<ResolvedItem> items = resolve(menu, "en", "/sites/s/home/products/connectors", 3);

        assertThat(items).hasSize(1);
        assertThat(items.get(0).label()).isEqualTo("Products");
        assertThat(items.get(0).targetPath()).isEqualTo("/sites/s/home/products");
        assertThat(items.get(0).inTrail()).isTrue();
        assertThat(items.get(0).current()).isFalse();
    }

    @Test
    void anUnreadableOrMissingTargetHidesTheItemAndItsChildren() throws RepositoryException {
        JCRNodeWrapper child = node("c", "/sites/s/menus/main/page/x", "mnu:externalLinkItem").prop("url", "https://a.example").build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu")
                .child(node("i1", "/sites/s/menus/main/page", "mnu:pageItem").brokenRef("page").child(child).build()).build();

        assertThat(resolve(menu, "en", null, 3)).isEmpty();
    }

    @Test
    void anItemOrATargetSwitchedOffInTheLanguageIsLeftOut() throws RepositoryException {
        JCRNodeWrapper page = node("p1", "/sites/s/home/about", "jnt:page").prop("jcr:title", "About").values("j:invalidLanguages", "zh").build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu")
                .child(node("i1", "/sites/s/menus/main/a", "mnu:pageItem").ref("page", page).build())
                .child(node("i2", "/sites/s/menus/main/b", "mnu:externalLinkItem").prop("label", "Shop")
                        .prop("url", "https://shop.example").values("j:invalidLanguages", "ja", "zh").build())
                .build();

        assertThat(resolve(menu, "zh", null, 3)).isEmpty();
        assertThat(resolve(menu, "en", null, 3)).extracting(ResolvedItem::label).containsExactly("About", "Shop");
    }

    @Test
    void aSectionWithNothingVisibleUnderItIsLeftOut() throws RepositoryException {
        JCRNodeWrapper empty = node("s1", "/sites/s/menus/main/s1", "mnu:sectionItem").prop("label", "Empty")
                .child(node("x", "/sites/s/menus/main/s1/x", "mnu:externalLinkItem").prop("url", "javascript:alert(1)").build()).build();
        JCRNodeWrapper full = node("s2", "/sites/s/menus/main/s2", "mnu:sectionItem").prop("label", "Contact")
                .child(node("y", "/sites/s/menus/main/s2/y", "mnu:externalLinkItem").prop("url", "mailto:a@b.example").build()).build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu").child(empty).child(full).build();

        List<ResolvedItem> items = resolve(menu, "en", null, 3);

        assertThat(items).extracting(ResolvedItem::label).containsExactly("Contact");
        assertThat(items.get(0).kind()).isEqualTo(MenuItemKind.SECTION);
        assertThat(items.get(0).children()).extracting(ResolvedItem::externalUrl).containsExactly("mailto:a@b.example");
        assertThat(items.get(0).children().get(0).label()).as("no label: the address shows").isEqualTo("mailto:a@b.example");
    }

    @Test
    void aPageWithNoTitleInTheLanguageOrTheFallbackIsLeftOut() throws RepositoryException {
        JCRNodeWrapper page = node("p1", "/sites/s/home/x", "jnt:page").build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu")
                .child(node("i1", "/sites/s/menus/main/a", "mnu:pageItem").ref("page", page).build()).build();

        assertThat(resolve(menu, "en", null, 3)).isEmpty();
    }

    @Test
    void includedSubpagesSkipThoseHiddenFromNavigationAndStopAtTheDepth() throws RepositoryException {
        JCRNodeWrapper grandChild = node("g", "/sites/s/home/p/c/g", "jnt:page").prop("jcr:title", "Grandchild").build();
        JCRNodeWrapper shown = node("c", "/sites/s/home/p/c", "jnt:page").prop("jcr:title", "Child").child(grandChild).build();
        JCRNodeWrapper hidden = node("h", "/sites/s/home/p/h", "jnt:page").prop("jcr:title", "Thank you").bool("ctplHideFromNav", true).build();
        JCRNodeWrapper page = node("p", "/sites/s/home/p", "jnt:page").prop("jcr:title", "Parent").child(shown).child(hidden).build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu")
                .child(node("i1", "/sites/s/menus/main/a", "mnu:pageItem").ref("page", page).bool("includeSubpages", true).build()).build();

        List<ResolvedItem> twoLevels = resolve(menu, "en", "/sites/s/home/p/c", 2);
        assertThat(twoLevels.get(0).children()).extracting(ResolvedItem::label).containsExactly("Child");
        assertThat(twoLevels.get(0).children().get(0).current()).isTrue();
        assertThat(twoLevels.get(0).children().get(0).children()).as("level 3 cut by maxDepth 2").isEmpty();

        List<ResolvedItem> threeLevels = resolve(menu, "en", null, 3);
        assertThat(threeLevels.get(0).children().get(0).children()).extracting(ResolvedItem::label).containsExactly("Grandchild");
    }

    @Test
    void anInternalLinkFallsBackToItsTargetsTitleThenItsName() throws RepositoryException {
        JCRNodeWrapper titled = node("t1", "/sites/other/home/news", "jnt:page").prop("jcr:title", "News").build();
        JCRNodeWrapper untitled = node("t2", "/sites/s/files/brochure.pdf", "jnt:file").displayable("brochure.pdf").build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu")
                .child(node("i1", "/sites/s/menus/main/a", "mnu:internalLinkItem").ref("target", titled).bool("newTab", true).build())
                .child(node("i2", "/sites/s/menus/main/b", "mnu:internalLinkItem").ref("target", untitled).build())
                .build();

        List<ResolvedItem> items = resolve(menu, "en", null, 3);

        assertThat(items).extracting(ResolvedItem::label).containsExactly("News", "brochure.pdf");
        assertThat(items.get(0).newTab()).isTrue();
    }

    @Test
    void textInTheLanguageBeatsTheFallbackLanguage() throws RepositoryException {
        JCRNodeWrapper pageZh = node("p1", "/sites/s/home/offers", "jnt:page").prop("jcr:title", "優惠").build();
        JCRNodeWrapper pageEn = node("p1", "/sites/s/home/offers", "jnt:page").prop("jcr:title", "Offers").build();
        JCRNodeWrapper untranslatedZh = node("p2", "/sites/s/home/news", "jnt:page").build();
        JCRNodeWrapper untranslatedEn = node("p2", "/sites/s/home/news", "jnt:page").prop("jcr:title", "News").build();
        JCRNodeWrapper itemZh = node("i1", "/sites/s/menus/main/a", "mnu:pageItem").ref("page", pageZh).build();
        JCRNodeWrapper itemEn = node("i1", "/sites/s/menus/main/a", "mnu:pageItem").prop("label", "Deals").build();
        JCRNodeWrapper item2Zh = node("i2", "/sites/s/menus/main/b", "mnu:pageItem").ref("page", untranslatedZh).build();
        JCRNodeWrapper item2En = node("i2", "/sites/s/menus/main/b", "mnu:pageItem").prop("label", "Latest news").build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu").child(itemZh).child(item2Zh).build();
        java.util.Map<JCRNodeWrapper, JCRNodeWrapper> en = java.util.Map.of(pageZh, pageEn, untranslatedZh, untranslatedEn,
                itemZh, itemEn, item2Zh, item2En);
        fallback = en::get;

        assertThat(resolve(menu, "zh_HK", null, 3)).extracting(ResolvedItem::label)
                .as("the page's Chinese title beats the English label; with no Chinese title, the English label beats the English title")
                .containsExactly("優惠", "Latest news");
    }

    @Test
    void aTopLevelItemCarriesItsPromotionElseItsPagesOne() throws RepositoryException {
        JCRNodeWrapper image = node("img", "/sites/s/files/kits.jpg", "jnt:file").build();
        JCRNodeWrapper offers = node("p1", "/sites/s/home/offers", "jnt:page").prop("jcr:title", "Offers").build();
        JCRNodeWrapper about = node("p2", "/sites/s/home/about", "jnt:page").prop("jcr:title", "About")
                .prop("promoTitle", "Our story").prop("promoText", "Since 1938").prop("ctaLabel", "Read").ref("promoLink", offers)
                .extraType(MenuResolverImpl.PAGE_PROMOTION).build();
        JCRNodeWrapper own = node("i1", "/sites/s/menus/main/a", "mnu:sectionItem").prop("label", "Products")
                .prop("promoTitle", "New kits").prop("promoUrl", "https://shop.example").ref("promoImage", image).brokenRef("promoTarget")
                .child(node("c", "/sites/s/menus/main/a/c", "mnu:pageItem").ref("page", offers).prop("promoTitle", "Never shown").build())
                .build();
        JCRNodeWrapper fromPage = node("i2", "/sites/s/menus/main/b", "mnu:pageItem").ref("page", about).build();
        JCRNodeWrapper menu = node("m", "/sites/s/menus/main", "mnu:menu").child(own).child(fromPage).build();

        List<ResolvedItem> items = resolve(menu, "en", null, 3);

        assertThat(items.get(0).promotion().title()).isEqualTo("New kits");
        assertThat(items.get(0).promotion().imageId()).isEqualTo("img");
        assertThat(items.get(0).promotion().targetId()).as("an unreadable link is left out, the address takes over").isNull();
        assertThat(items.get(0).promotion().url()).isEqualTo("https://shop.example");
        assertThat(items.get(0).children().get(0).promotion()).as("promotions are for top-level items").isNull();
        assertThat(items.get(1).promotion().title()).isEqualTo("Our story");
        assertThat(items.get(1).promotion().linkLabel()).isEqualTo("Read");
        assertThat(items.get(1).promotion().targetPath()).isEqualTo("/sites/s/home/offers");
    }

    private MenuResolverImpl.FallbackLookup fallback;

    private List<ResolvedItem> resolve(JCRNodeWrapper menu, String language, String currentPath, int depth) throws RepositoryException {
        return resolver.children(menu, 1, new MenuResolverImpl.Context(language, currentPath, depth, fallback));
    }

    // ---- mocked nodes --------------------------------------------------------------------------

    private static NodeBuilder node(String id, String path, String type) throws RepositoryException {
        return new NodeBuilder(id, path, type);
    }

    private static final class NodeBuilder {
        private final JCRNodeWrapper node = mock(JCRNodeWrapper.class);
        private final List<JCRNodeWrapper> children = new ArrayList<>();

        NodeBuilder(String id, String path, String type) throws RepositoryException {
            when(node.getIdentifier()).thenReturn(id);
            when(node.getPath()).thenReturn(path);
            when(node.getPrimaryNodeTypeName()).thenReturn(type);
            when(node.getDisplayableName()).thenReturn(path.substring(path.lastIndexOf('/') + 1));
            when(node.hasProperty(anyString())).thenReturn(false);
            boolean item = type.startsWith("mnu:") && type.endsWith("Item");
            when(node.isNodeType(anyString())).thenAnswer(a -> {
                String asked = a.getArgument(0);
                return asked.equals(type) || (item && asked.equals(MenuResolverImpl.ITEM_MIXIN));
            });
        }

        NodeBuilder prop(String name, String value) throws RepositoryException {
            JCRPropertyWrapper p = mock(JCRPropertyWrapper.class);
            when(p.getString()).thenReturn(value);
            return set(name, p);
        }

        NodeBuilder bool(String name, boolean value) throws RepositoryException {
            JCRPropertyWrapper p = mock(JCRPropertyWrapper.class);
            when(p.getBoolean()).thenReturn(value);
            return set(name, p);
        }

        NodeBuilder values(String name, String... values) throws RepositoryException {
            JCRPropertyWrapper p = mock(JCRPropertyWrapper.class);
            JCRValueWrapper[] out = new JCRValueWrapper[values.length];
            for (int i = 0; i < values.length; i++) {
                out[i] = mock(JCRValueWrapper.class);
                when(out[i].getString()).thenReturn(values[i]);
            }
            when(p.getValues()).thenReturn(out);
            return set(name, p);
        }

        NodeBuilder ref(String name, JCRNodeWrapper target) throws RepositoryException {
            JCRPropertyWrapper p = mock(JCRPropertyWrapper.class);
            when(p.getNode()).thenReturn(target);
            return set(name, p);
        }

        NodeBuilder brokenRef(String name) throws RepositoryException {
            JCRPropertyWrapper p = mock(JCRPropertyWrapper.class);
            when(p.getNode()).thenThrow(new ItemNotFoundException("gone or not readable"));
            return set(name, p);
        }

        NodeBuilder extraType(String extra) throws RepositoryException {
            String primary = node.getPrimaryNodeTypeName();
            when(node.isNodeType(anyString())).thenAnswer(a -> a.getArgument(0).equals(primary) || a.getArgument(0).equals(extra));
            return this;
        }

        NodeBuilder displayable(String name) {
            when(node.getDisplayableName()).thenReturn(name);
            return this;
        }

        NodeBuilder child(JCRNodeWrapper child) {
            children.add(child);
            return this;
        }

        JCRNodeWrapper build() throws RepositoryException {
            JCRNodeIteratorWrapper iterator = mock(JCRNodeIteratorWrapper.class);
            when(iterator.iterator()).thenAnswer(a -> List.copyOf(children).iterator());
            when(node.getNodes()).thenReturn(iterator);
            return node;
        }

        private NodeBuilder set(String name, JCRPropertyWrapper p) throws RepositoryException {
            when(node.hasProperty(name)).thenReturn(true);
            when(node.getProperty(name)).thenReturn(p);
            return this;
        }
    }
}
