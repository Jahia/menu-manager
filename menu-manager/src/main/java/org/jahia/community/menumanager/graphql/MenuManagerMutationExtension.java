package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;

/**
 * Adds {@code menuManager { ... }} to the root Mutation: writes only.
 */
@GraphQLTypeExtension(DXGraphQLProvider.Mutation.class)
public final class MenuManagerMutationExtension {

    private MenuManagerMutationExtension() {
    }

    /**
     * @return the entry point of the menu mutations
     */
    @GraphQLField
    @GraphQLName("menuManager")
    @GraphQLNonNull
    @GraphQLDescription("Menu Manager: create, change, copy, delete and save menus")
    public static GqlMenuManagerMutation menuManager() {
        return new GqlMenuManagerMutation();
    }
}
