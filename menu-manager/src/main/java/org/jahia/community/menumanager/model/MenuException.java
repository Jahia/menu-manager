package org.jahia.community.menumanager.model;

/**
 * A refusal the caller can act on: an invalid menu tree, a menu changed by someone else since it was
 * opened, a target that does not exist. {@link #code()} is what the GraphQL API answers, and what the
 * Menus screen translates; the message is English, for logs.
 */
public class MenuException extends Exception {

    private static final long serialVersionUID = 1L;

    /** The tree could not be parsed. */
    public static final String UNREADABLE = "unreadable";
    /** More levels than a menu may have. */
    public static final String TOO_DEEP = "tooDeep";
    /** More items than a menu may hold. */
    public static final String TOO_MANY = "tooMany";
    /** A kind, a style or a language code is unknown. */
    public static final String UNKNOWN_VALUE = "unknownValue";
    /** A label or a description is too long. */
    public static final String TOO_LONG = "tooLong";
    /** A page item has no page, or an internal link no target. */
    public static final String NO_TARGET = "noTarget";
    /** The target does not exist, is of the wrong type, or the caller cannot read it. */
    public static final String BAD_TARGET = "badTarget";
    /** An external address is not allowed. */
    public static final String BAD_URL = "badUrl";
    /** A section has no label. */
    public static final String SECTION_LABEL = "sectionLabel";
    /** The menu changed since the editor opened it. */
    public static final String CONFLICT = "conflict";

    private final String code;

    /**
     * @param code    one of the constants of this class
     * @param message what went wrong, in English, for logs
     */
    public MenuException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * @return the refusal's code
     */
    public String code() {
        return code;
    }
}
