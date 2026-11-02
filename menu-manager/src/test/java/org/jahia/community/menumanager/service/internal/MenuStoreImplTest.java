package org.jahia.community.menumanager.service.internal;

import org.jahia.community.menumanager.model.MenuItemKind;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class MenuStoreImplTest {

    /** The properties an item may have: no item node may be named like one (publication drops the property). */
    private static final Set<String> ITEM_PROPERTIES = Set.of("label", "description", "itemStyle", "promoImage", "promoImageAlt",
            "promoTitle", "promoText", "promoLinkLabel", "promoTarget", "promoUrl", "page", "includeSubpages", "target", "newTab", "url");

    @Test
    void namesItemNodesAfterTheirTypeNeverLikeAProperty() {
        assertThat(MenuStoreImpl.nodeName(MenuItemKind.PAGE)).isEqualTo("pageItem");
        assertThat(Arrays.stream(MenuItemKind.values()).map(MenuStoreImpl::nodeName)).doesNotContainAnyElementsOf(ITEM_PROPERTIES);
    }
}
