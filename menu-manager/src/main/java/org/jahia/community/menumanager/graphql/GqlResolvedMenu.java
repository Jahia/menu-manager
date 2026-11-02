package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.community.menumanager.model.ResolvedMenu;

import java.util.List;

/**
 * A menu resolved for the caller in one language.
 */
@GraphQLName("MenuManagerResolvedMenu")
@GraphQLDescription("A menu as the caller may see it in one language, with what a cached rendering depends on")
public class GqlResolvedMenu {

    private final ResolvedMenu menu;

    GqlResolvedMenu(ResolvedMenu menu) {
        this.menu = menu;
    }

    /** @return identifier of the menu */
    @GraphQLField @GraphQLName("id") @GraphQLNonNull
    public String id() {
        return menu.id();
    }

    /** @return path of the menu */
    @GraphQLField @GraphQLName("path") @GraphQLNonNull
    public String path() {
        return menu.path();
    }

    /** @return title of the menu, or null */
    @GraphQLField @GraphQLName("title")
    public String title() {
        return menu.title();
    }

    /** @return the language resolved */
    @GraphQLField @GraphQLName("language") @GraphQLNonNull
    public String language() {
        return menu.language();
    }

    /** @return the visible top-level items */
    @GraphQLField @GraphQLName("items") @GraphQLNonNull
    public List<GqlResolvedItem> items() {
        return menu.items().stream().map(GqlResolvedItem::new).toList();
    }

    /** @return paths a cached rendering depends on; a trailing {@code /*} stands for a subtree */
    @GraphQLField @GraphQLName("dependencies") @GraphQLNonNull
    public List<String> dependencies() {
        return menu.dependencies();
    }
}
