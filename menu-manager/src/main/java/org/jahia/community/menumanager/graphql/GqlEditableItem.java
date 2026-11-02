package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;

import java.util.List;

/**
 * One item of a menu as the Menus screen edits it: its own values in the edited language, the
 * fallback language's values next to them, and the state of its target.
 */
@GraphQLName("MenuManagerEditableItem")
@GraphQLDescription("A menu item as the Menus screen edits it")
public class GqlEditableItem {

    String id;
    String kind;
    String label;
    String fallbackLabel;
    String description;
    String fallbackDescription;
    String style;
    boolean includeSubpages;
    boolean newTab;
    String url;
    List<String> invalidLanguages;
    GqlTarget target;
    boolean publicAccess;
    String promoTitle;
    String fallbackPromoTitle;
    String promoText;
    String promoLinkLabel;
    String promoImageAlt;
    GqlTarget promoImage;
    GqlTarget promoTarget;
    String promoUrl;
    List<GqlEditableItem> children;

    /** @return identifier of the item */
    @GraphQLField @GraphQLName("id") @GraphQLNonNull
    public String id() {
        return id;
    }

    /** @return page, section, internalLink or externalLink */
    @GraphQLField @GraphQLName("kind") @GraphQLNonNull
    public String kind() {
        return kind;
    }

    /** @return the label in the edited language, or null */
    @GraphQLField @GraphQLName("label")
    public String label() {
        return label;
    }

    /** @return the label in the fallback language, or null (also null when the edited language is the fallback) */
    @GraphQLField @GraphQLName("fallbackLabel")
    public String fallbackLabel() {
        return fallbackLabel;
    }

    /** @return the description in the edited language, or null */
    @GraphQLField @GraphQLName("description")
    public String description() {
        return description;
    }

    /** @return the description in the fallback language, or null */
    @GraphQLField @GraphQLName("fallbackDescription")
    public String fallbackDescription() {
        return fallbackDescription;
    }

    /** @return default, highlight or button */
    @GraphQLField @GraphQLName("style") @GraphQLNonNull
    public String style() {
        return style;
    }

    /** @return for a page item, whether its subpages follow */
    @GraphQLField @GraphQLName("includeSubpages") @GraphQLNonNull
    public boolean includeSubpages() {
        return includeSubpages;
    }

    /** @return for a link, whether it opens in a new tab */
    @GraphQLField @GraphQLName("newTab") @GraphQLNonNull
    public boolean newTab() {
        return newTab;
    }

    /** @return the address of an external link, or null */
    @GraphQLField @GraphQLName("url")
    public String url() {
        return url;
    }

    /** @return the languages the item is hidden in */
    @GraphQLField @GraphQLName("invalidLanguages") @GraphQLNonNull
    public List<String> invalidLanguages() {
        return invalidLanguages;
    }

    /** @return the page or node a page item or an internal link points to, or null */
    @GraphQLField @GraphQLName("target")
    public GqlTarget target() {
        return target;
    }

    /** @return whether a visitor who is not signed in can see the item on live (item and target readable by guest) */
    @GraphQLField @GraphQLName("publicAccess") @GraphQLNonNull
    public boolean publicAccess() {
        return publicAccess;
    }

    /** @return the promotion's title in the edited language, or null */
    @GraphQLField @GraphQLName("promoTitle")
    public String promoTitle() {
        return promoTitle;
    }

    /** @return the promotion's title in the fallback language, or null */
    @GraphQLField @GraphQLName("fallbackPromoTitle")
    public String fallbackPromoTitle() {
        return fallbackPromoTitle;
    }

    /** @return the promotion's text in the edited language, or null */
    @GraphQLField @GraphQLName("promoText")
    public String promoText() {
        return promoText;
    }

    /** @return the promotion's button label in the edited language, or null */
    @GraphQLField @GraphQLName("promoLinkLabel")
    public String promoLinkLabel() {
        return promoLinkLabel;
    }

    /** @return the promotion image's text alternative in the edited language, or null */
    @GraphQLField @GraphQLName("promoImageAlt")
    public String promoImageAlt() {
        return promoImageAlt;
    }

    /** @return the promotion's image, or null */
    @GraphQLField @GraphQLName("promoImage")
    public GqlTarget promoImage() {
        return promoImage;
    }

    /** @return the node the promotion's button opens, or null */
    @GraphQLField @GraphQLName("promoTarget")
    public GqlTarget promoTarget() {
        return promoTarget;
    }

    /** @return the address the promotion's button opens, or null */
    @GraphQLField @GraphQLName("promoUrl")
    public String promoUrl() {
        return promoUrl;
    }

    /** @return the item's own items */
    @GraphQLField @GraphQLName("children") @GraphQLNonNull
    public List<GqlEditableItem> children() {
        return children;
    }
}
