package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;

/**
 * The result of a save.
 */
@GraphQLName("MenuManagerSaveResult")
@GraphQLDescription("The result of saving a menu")
public class GqlSaveResult {

    private final long revision;
    private final int itemCount;

    GqlSaveResult(long revision, int itemCount) {
        this.revision = revision;
        this.itemCount = itemCount;
    }

    /** @return the menu's new revision */
    @GraphQLField @GraphQLName("revision") @GraphQLNonNull
    public long revision() {
        return revision;
    }

    /** @return items at every level */
    @GraphQLField @GraphQLName("itemCount") @GraphQLNonNull
    public int itemCount() {
        return itemCount;
    }
}
