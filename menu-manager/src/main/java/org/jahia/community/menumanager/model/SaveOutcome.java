package org.jahia.community.menumanager.model;

/**
 * The result of saving a menu tree.
 *
 * @param revision  the menu's revision after the save, to send with the next save
 * @param itemCount how many items the menu holds after the save
 */
public record SaveOutcome(long revision, int itemCount) {
}
