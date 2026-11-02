package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;

/**
 * What an item points to, as the editor can see it.
 */
@GraphQLName("MenuManagerTarget")
@GraphQLDescription("The page or node an item points to")
public class GqlTarget {

    private final String uuid;
    private final String path;
    private final String title;
    private final String nodeType;
    private final boolean available;
    private final boolean inLive;

    GqlTarget(String uuid, String path, String title, String nodeType, boolean available, boolean inLive) {
        this.uuid = uuid;
        this.path = path;
        this.title = title;
        this.nodeType = nodeType;
        this.available = available;
        this.inLive = inLive;
    }

    /** @return identifier of the target */
    @GraphQLField @GraphQLName("uuid") @GraphQLNonNull
    public String uuid() {
        return uuid;
    }

    /** @return path of the target, or null when it is not available */
    @GraphQLField @GraphQLName("path")
    public String path() {
        return path;
    }

    /** @return title of the target in the language, else the fallback language, else its name; null when not available */
    @GraphQLField @GraphQLName("title")
    public String title() {
        return title;
    }

    /** @return primary node type of the target, or null when it is not available */
    @GraphQLField @GraphQLName("nodeType")
    public String nodeType() {
        return nodeType;
    }

    /** @return false when the target is deleted or the editor cannot read it (both look the same) */
    @GraphQLField @GraphQLName("available") @GraphQLNonNull
    public boolean available() {
        return available;
    }

    /** @return whether the editor can read the target in the live workspace (published) */
    @GraphQLField @GraphQLName("inLive") @GraphQLNonNull
    public boolean inLive() {
        return inLive;
    }
}
