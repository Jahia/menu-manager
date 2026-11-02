package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;

/**
 * One menu of a site, as the Menus screen lists it.
 */
@GraphQLName("MenuManagerMenu")
@GraphQLDescription("A menu of a site")
public class GqlMenuSummary {

    private final String uuid;
    private final String path;
    private final String title;
    private final int itemCount;
    private final long revision;

    GqlMenuSummary(String uuid, String path, String title, int itemCount, long revision) {
        this.uuid = uuid;
        this.path = path;
        this.title = title;
        this.itemCount = itemCount;
        this.revision = revision;
    }

    /** @return identifier of the menu */
    @GraphQLField @GraphQLName("uuid") @GraphQLNonNull
    public String uuid() {
        return uuid;
    }

    /** @return path of the menu */
    @GraphQLField @GraphQLName("path") @GraphQLNonNull
    public String path() {
        return path;
    }

    /** @return title in the requested language, else the fallback language, else the node name */
    @GraphQLField @GraphQLName("title") @GraphQLNonNull
    public String title() {
        return title;
    }

    /** @return items at every level */
    @GraphQLField @GraphQLName("itemCount") @GraphQLNonNull
    public int itemCount() {
        return itemCount;
    }

    /** @return the revision a save must name */
    @GraphQLField @GraphQLName("revision") @GraphQLNonNull
    public long revision() {
        return revision;
    }
}
