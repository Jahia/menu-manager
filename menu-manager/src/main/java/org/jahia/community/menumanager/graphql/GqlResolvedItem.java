package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.community.menumanager.model.ResolvedItem;

import java.util.List;

/**
 * One item of a resolved menu, as the caller may see it.
 */
@GraphQLName("MenuManagerResolvedItem")
@GraphQLDescription("A menu item as the caller may see it in one language")
public class GqlResolvedItem {

    private final ResolvedItem item;

    GqlResolvedItem(ResolvedItem item) {
        this.item = item;
    }

    /** @return identifier of the item (of the page, for a subpage added by "include subpages") */
    @GraphQLField @GraphQLName("id") @GraphQLNonNull
    public String id() {
        return item.id();
    }

    /** @return page, section, internalLink or externalLink */
    @GraphQLField @GraphQLName("kind") @GraphQLNonNull
    public String kind() {
        return item.kind().id();
    }

    /** @return the label to show */
    @GraphQLField @GraphQLName("label") @GraphQLNonNull
    public String label() {
        return item.label();
    }

    /** @return the description, or null */
    @GraphQLField @GraphQLName("description")
    public String description() {
        return item.description();
    }

    /** @return default, highlight or button */
    @GraphQLField @GraphQLName("style") @GraphQLNonNull
    public String style() {
        return item.style();
    }

    /** @return identifier of the target page or node, or null */
    @GraphQLField @GraphQLName("targetId")
    public String targetId() {
        return item.targetId();
    }

    /** @return path of the target page or node, or null */
    @GraphQLField @GraphQLName("targetPath")
    public String targetPath() {
        return item.targetPath();
    }

    /** @return the address of an external link, or null */
    @GraphQLField @GraphQLName("url")
    public String url() {
        return item.externalUrl();
    }

    /** @return whether the link opens in a new tab */
    @GraphQLField @GraphQLName("newTab") @GraphQLNonNull
    public boolean newTab() {
        return item.newTab();
    }

    /** @return whether the target is the current page */
    @GraphQLField @GraphQLName("current") @GraphQLNonNull
    public boolean current() {
        return item.current();
    }

    /** @return whether the current page is under the target */
    @GraphQLField @GraphQLName("inTrail") @GraphQLNonNull
    public boolean inTrail() {
        return item.inTrail();
    }

    /** @return the visible children */
    @GraphQLField @GraphQLName("children") @GraphQLNonNull
    public List<GqlResolvedItem> children() {
        return item.children().stream().map(GqlResolvedItem::new).toList();
    }
}
