package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.community.menumanager.model.Promotion;

/**
 * A top-level item's promotion, as the caller may see it.
 */
@GraphQLName("MenuManagerPromotion")
@GraphQLDescription("A top-level item's promotion (mega menu), as the caller may see it")
public class GqlPromotion {

    private final Promotion promotion;

    GqlPromotion(Promotion promotion) {
        this.promotion = promotion;
    }

    /** @return the title */
    @GraphQLField @GraphQLName("title") @GraphQLNonNull
    public String title() {
        return promotion.title();
    }

    /** @return the text, or null */
    @GraphQLField @GraphQLName("text")
    public String text() {
        return promotion.text();
    }

    /** @return identifier of the image, or null */
    @GraphQLField @GraphQLName("imageId")
    public String imageId() {
        return promotion.imageId();
    }

    /** @return the image's text alternative for the promotion, or null (the image's title then) */
    @GraphQLField @GraphQLName("imageAlt")
    public String imageAlt() {
        return promotion.imageAlt();
    }

    /** @return the button's label, or null */
    @GraphQLField @GraphQLName("linkLabel")
    public String linkLabel() {
        return promotion.linkLabel();
    }

    /** @return identifier of the node the button opens, or null */
    @GraphQLField @GraphQLName("targetId")
    public String targetId() {
        return promotion.targetId();
    }

    /** @return path of the node the button opens, or null */
    @GraphQLField @GraphQLName("targetPath")
    public String targetPath() {
        return promotion.targetPath();
    }

    /** @return the address the button opens, or null */
    @GraphQLField @GraphQLName("url")
    public String url() {
        return promotion.url();
    }
}
