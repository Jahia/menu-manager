package org.jahia.community.menumanager.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;

import java.util.List;

/**
 * A menu as the Menus screen edits it, in one language.
 */
@GraphQLName("MenuManagerEditableMenu")
@GraphQLDescription("A menu as the Menus screen edits it")
public class GqlEditableMenu {

    String uuid;
    String path;
    String title;
    String fallbackTitle;
    String fallbackLanguage;
    String effectiveFallbackLanguage;
    long revision;
    List<String> siteLanguages;
    List<GqlEditableItem> items;

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

    /** @return title in the edited language, or null */
    @GraphQLField @GraphQLName("title")
    public String title() {
        return title;
    }

    /** @return title in the fallback language, or null */
    @GraphQLField @GraphQLName("fallbackTitle")
    public String fallbackTitle() {
        return fallbackTitle;
    }

    /** @return the fallback language set on the menu, or null for the site's default */
    @GraphQLField @GraphQLName("fallbackLanguage")
    public String fallbackLanguage() {
        return fallbackLanguage;
    }

    /** @return the fallback language in force: the menu's, else the site's default */
    @GraphQLField @GraphQLName("effectiveFallbackLanguage") @GraphQLNonNull
    public String effectiveFallbackLanguage() {
        return effectiveFallbackLanguage;
    }

    /** @return the revision a save must name */
    @GraphQLField @GraphQLName("revision") @GraphQLNonNull
    public long revision() {
        return revision;
    }

    /** @return the site's languages, default first */
    @GraphQLField @GraphQLName("siteLanguages") @GraphQLNonNull
    public List<String> siteLanguages() {
        return siteLanguages;
    }

    /** @return the top-level items */
    @GraphQLField @GraphQLName("items") @GraphQLNonNull
    public List<GqlEditableItem> items() {
        return items;
    }
}
