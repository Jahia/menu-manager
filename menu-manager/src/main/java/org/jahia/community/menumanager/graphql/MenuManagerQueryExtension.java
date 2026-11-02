package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;

/**
 * Adds {@code menuManager { ... }} to the root Query: reads only.
 */
@GraphQLTypeExtension(DXGraphQLProvider.Query.class)
public final class MenuManagerQueryExtension {

    private MenuManagerQueryExtension() {
    }

    /**
     * @return the entry point of the menu queries
     */
    @GraphQLField
    @GraphQLName("menuManager")
    @GraphQLNonNull
    @GraphQLDescription("Menu Manager: a site's menus, a menu to edit, a menu resolved for the caller")
    public static GqlMenuManagerQuery menuManager() {
        return new GqlMenuManagerQuery();
    }
}
