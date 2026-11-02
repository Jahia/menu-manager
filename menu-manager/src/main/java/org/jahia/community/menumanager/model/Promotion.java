package org.jahia.community.menumanager.model;

/**
 * A top-level item's promotion, as one visitor sees it in one language: from the item itself, else,
 * for a page item, from its page's classic-templates promotion. An image or a link the visitor may
 * not read is left out. Immutable.
 *
 * @param title      the title, never blank
 * @param text       the text, or null
 * @param imageId    identifier of the image node, or null
 * @param imageAlt   the image's text alternative chosen for the promotion, or null (the image's title then)
 * @param linkLabel  the button's label, or null
 * @param targetId   identifier of the node the button opens, or null
 * @param targetPath path of that node, or null
 * @param url        the checked address the button opens, or null
 */
public record Promotion(String title, String text, String imageId, String imageAlt, String linkLabel, String targetId,
                        String targetPath, String url) {
}
