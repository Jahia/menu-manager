import {gql} from '@apollo/client';

const ITEM_FIELDS = `
    id kind label fallbackLabel description fallbackDescription style includeSubpages newTab url invalidLanguages publicAccess
    target { uuid path title fallbackTitle nodeType available inLive }
    promoTitle fallbackPromoTitle promoText promoLinkLabel promoImageAlt promoUrl
    promoImage { uuid path title fallbackTitle nodeType available inLive }
    promoTarget { uuid path title fallbackTitle nodeType available inLive }
`;

export const MENUS = gql`
    query MenuManagerMenus($siteKey: String!, $language: String!) {
        menuManager { menus(siteKey: $siteKey, language: $language) { uuid path title itemCount revision } }
    }
`;

export const EDITABLE_MENU = gql`
    query MenuManagerEditableMenu($path: String!, $language: String!) {
        menuManager {
            editableMenu(path: $path, language: $language) {
                uuid path title fallbackTitle fallbackLanguage effectiveFallbackLanguage revision siteLanguages
                items { ${ITEM_FIELDS} children { ${ITEM_FIELDS} children { ${ITEM_FIELDS} } } }
            }
        }
        jcr {
            nodeByPath(path: $path) {
                uuid workspace
                canPublish: hasPermission(permissionName: "publish")
                publication: aggregatedPublicationInfo(language: $language, subNodes: true) { publicationStatus }
                references(limit: 50) {
                    nodes {
                        node {
                            uuid workspace path displayName(language: $language)
                            ancestors { uuid workspace path displayName(language: $language) primaryNodeType { name } }
                        }
                    }
                }
            }
        }
    }
`;

export const RESOLVED_MENU = gql`
    query MenuManagerPreview($menu: String!, $language: String!) {
        menuManager {
            resolvedMenu(menu: $menu, language: $language, workspace: "EDIT", maxDepth: 3) {
                items { id kind label style children { id kind label style children { id kind label style } } }
            }
        }
    }
`;

export const PAGES_BY_ID = gql`
    query MenuManagerPagesById($uuids: [String!]!, $language: String!) {
        jcr { nodesById(uuids: $uuids) { uuid workspace path displayName(language: $language) primaryNodeType { name } } }
    }
`;

export const NODE_BY_PATH = gql`
    query MenuManagerTarget($path: String!, $language: String!) {
        jcr { nodeByPath(path: $path) { uuid workspace path displayName(language: $language) primaryNodeType { name } } }
    }
`;

export const CREATE_MENU = gql`
    mutation MenuManagerCreate($siteKey: String!, $title: String!, $language: String!) {
        menuManager { createMenu(siteKey: $siteKey, title: $title, language: $language) { uuid path title } }
    }
`;

export const UPDATE_MENU = gql`
    mutation MenuManagerUpdate($path: String!, $language: String!, $title: String, $fallbackLanguage: String) {
        menuManager { updateMenu(path: $path, language: $language, title: $title, fallbackLanguage: $fallbackLanguage) }
    }
`;

export const DUPLICATE_MENU = gql`
    mutation MenuManagerDuplicate($path: String!, $title: String!, $language: String!) {
        menuManager { duplicateMenu(path: $path, title: $title, language: $language) { uuid path title } }
    }
`;

export const DELETE_MENU = gql`
    mutation MenuManagerDelete($path: String!) { menuManager { deleteMenu(path: $path) } }
`;

export const SAVE_MENU = gql`
    mutation MenuManagerSave($path: String!, $language: String!, $revision: Long!, $tree: String!) {
        menuManager { saveMenu(path: $path, language: $language, revision: $revision, tree: $tree) { revision itemCount } }
    }
`;

export const PUBLISH = gql`
    mutation MenuManagerPublish($path: String!, $languages: [String!]!, $subtree: Boolean!) {
        jcr { mutateNode(pathOrId: $path) { publish(languages: $languages, publishSubNodes: $subtree, includeSubTree: $subtree) } }
    }
`;
