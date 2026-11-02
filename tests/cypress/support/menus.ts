/**
 * Helpers shared by the Menu Manager specs.
 *
 * GraphQL calls go through `gql(user, ...)`: a plain POST with basic auth for that user and the
 * `Origin` header Jahia requires, so who the call runs as is written at each call site. The calls of
 * a test share one server session (the cookie), which holds a licence seat until it expires (a trial
 * licence then refuses every sign-in), so every test ends with `signOut` (support/e2e.ts).
 */

import {createSite, createUser, deleteSite, deleteUser, enableModule, grantRoles, publishAndWaitJobEnding} from '@jahia/cypress';

export type TestUser = {
    username: string;
    password: string;
};

export type GqlError = {message: string; path?: string[]};

export type GqlBody = {
    data?: Record<string, unknown> | null;
    errors?: GqlError[];
};

/** The modules under test, as Jahia names their bundles. */
export const MODULES = ['menu-manager', 'menu-manager-views'];

/**
 * The template set of the test sites: its free zone (ctpl:freeZone) accepts any droppable content.
 * Override with CYPRESS_MNU_TEMPLATE_SET on an instance with another set that has one.
 */
export const TEMPLATE_SET: string = Cypress.env('MNU_TEMPLATE_SET') || 'classic-templates';

export function asRoot(): TestUser {
    return {username: 'root', password: Cypress.env('SUPER_USER_PASSWORD') || 'root1234'};
}

export function jahiaOrigin(): string {
    const baseUrl = Cypress.config('baseUrl');
    if (!baseUrl) {
        throw new Error('baseUrl is not set: the @jahia/cypress env plugin did not run');
    }
    return new URL(baseUrl).origin;
}

/**
 * Sends one GraphQL operation as `user` (a guest when null) and yields the response body.
 *
 * @param {TestUser | null} user who the call runs as.
 * @param {string} query the operation.
 * @param {object} variables its variables.
 */
export function gql(user: TestUser | null, query: string, variables: Record<string, unknown> = {}): Cypress.Chainable<GqlBody> {
    return cy.request({
        method: 'POST',
        url: '/modules/graphql',
        ...(user ? {auth: {username: user.username, password: user.password}} : {}),
        headers: {Origin: jahiaOrigin(), 'Content-Type': 'application/json'},
        body: {query, variables},
        failOnStatusCode: false
    }).then(response => {
        expect(response.status, 'GraphQL answered').to.eq(200);
        return response.body as GqlBody;
    });
}

/**
 * Ends the server session of the current cookies, freeing its licence seat, and drops the guest
 * session cookie the logout answers with: sent along, it would win over the next call's basic auth.
 */
export function signOut(): Cypress.Chainable<null> {
    cy.request({url: '/cms/logout', followRedirect: false, failOnStatusCode: false});
    return cy.clearCookies();
}

/** Sends an operation as `user` and fails on any GraphQL error. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function gqlOk(user: TestUser | null, query: string, variables: Record<string, unknown> = {}): Cypress.Chainable<any> {
    return gql(user, query, variables).then(body => {
        expect(body.errors, `no GraphQL error for ${user?.username ?? 'guest'}: ${JSON.stringify(body.errors)}`).to.be.undefined;
        return body.data;
    });
}

/** Asserts that the call runs as `user`, not as a leftover identity. */
export function assertEffectiveUser(user: TestUser): void {
    gqlOk(user, '{ currentUser { username } }').its('currentUser.username').should('eq', user.username);
}

/** Asserts that the field at `path` refused the call with `message`, past the API filter. */
export function assertRefused(body: GqlBody, path: string[], message = 'Permission denied'): void {
    expect(body.errors, 'the call is refused').to.have.length.greaterThan(0);
    const [error] = body.errors ?? [];
    expect(error.message).to.eq(message);
    expect(error.path, 'refused by the module, past the API filter').to.deep.eq(path);
}

/** Whether a node exists, read as root in the edit workspace. */
export function nodeExists(path: string): Cypress.Chainable<boolean> {
    return gql(asRoot(), 'query N($path: String!) { jcr { nodeByPath(path: $path) { path } } }', {path})
        .then(body => Boolean((body.data?.jcr as {nodeByPath?: unknown} | undefined)?.nodeByPath));
}

/** The identifier of a node, read as root. */
export function uuidOf(path: string): Cypress.Chainable<string> {
    return gqlOk(asRoot(), 'query N($path: String!) { jcr { nodeByPath(path: $path) { uuid } } }', {path})
        .its('jcr.nodeByPath.uuid');
}

/**
 * Creates a node with its children as root, and fails on any GraphQL error (the @jahia/cypress
 * `addNode` helper resolves even when the mutation is refused). Yields the new node's identifier.
 */
export function addNodeTree(parentPath: string, node: Record<string, unknown>): Cypress.Chainable<string> {
    return gqlOk(asRoot(), `mutation Add($parent: String!, $name: String!, $type: String!, $props: [InputJCRProperty],
            $children: [InputJCRNode], $mixins: [String]) {
        jcr { addNode(parentPathOrId: $parent, name: $name, primaryNodeType: $type, properties: $props,
                children: $children, mixins: $mixins) { uuid } }
    }`, {parent: parentPath, ...node}).its('jcr.addNode.uuid');
}

/** Sets one property as root. */
export function setProperty(path: string, name: string, value: string, language?: string): void {
    gqlOk(asRoot(), `mutation P($path: String!, $name: String!, $value: String, $language: String) {
        jcr { mutateNode(pathOrId: $path) { mutateProperty(name: $name) { setValue(value: $value, language: $language) } } }
    }`, {path, name, value, language});
}

/**
 * Creates a site, after removing what a killed run may have left, with both modules enabled.
 * Its home page gets a `main` area holding a free zone, where the specs drop Menu components, and two
 * subpages (`about`, `contact`); everything is published.
 */
export function createTestSite(siteKey: string, languages = 'en,fr'): void {
    deleteTestSite(siteKey);
    createSite(siteKey, {templateSet: TEMPLATE_SET, serverName: 'localhost', locale: 'en', languages});
    MODULES.forEach(module => enableModule(module, siteKey));
    const home = `/sites/${siteKey}/home`;
    nodeExists(home).should('eq', true);
    ['about', 'contact'].forEach(name => {
        addNodeTree(home, {
            name,
            type: 'jnt:page',
            props: [
                {name: 'jcr:title', value: name === 'about' ? 'About us' : 'Contact', language: 'en'},
                {name: 'jcr:title', value: name === 'about' ? 'A propos' : 'Contact FR', language: 'fr'},
                {name: 'j:templateName', value: 'content'}
            ]
        });
    });
    // the site's creation may already have made the home page's main area
    nodeExists(`${home}/main`).then(exists => {
        if (!exists) {
            addNodeTree(home, {name: 'main', type: 'ctpl:pageArea'});
        }
        addNodeTree(`${home}/main`, {name: 'zone', type: 'ctpl:freeZone'});
    });
    publishAndWaitJobEnding(`/sites/${siteKey}`, languages.split(','));
}

export function deleteTestSite(siteKey: string): void {
    nodeExists(`/sites/${siteKey}`).then(exists => {
        if (exists) {
            deleteSite(siteKey);
        }
    });
}

/** Creates a user granted `roles` on `sitePath`, after deleting a leftover with the same name. */
export function createTestUser(user: TestUser, sitePath: string, roles: string[]): void {
    deleteUser(user.username);
    createUser(user.username, user.password);
    if (roles.length > 0) {
        grantRoles(sitePath, roles, user.username, 'USER');
    }
}

/** A menu item as saveMenu takes it (MenuTree on the server). */
export type SaveItem = {
    id?: string;
    kind: 'page' | 'section' | 'internalLink' | 'externalLink';
    label?: string | null;
    description?: string | null;
    style?: 'default' | 'highlight' | 'button';
    page?: string;
    includeSubpages?: boolean;
    target?: string;
    url?: string;
    newTab?: boolean;
    invalidLanguages?: string[];
    promotion?: Record<string, string | null>;
    children?: SaveItem[];
};

/** Creates a menu as `user` and yields its path. */
export function createMenu(user: TestUser, siteKey: string, title: string): Cypress.Chainable<string> {
    return gqlOk(user, `mutation C($siteKey: String!, $title: String!) {
        menuManager { createMenu(siteKey: $siteKey, title: $title, language: "en") { path } }
    }`, {siteKey, title}).its('menuManager.createMenu.path');
}

/** The revision of a menu, read as root. */
export function revisionOf(path: string): Cypress.Chainable<number> {
    return gqlOk(asRoot(), `query R($path: String!) { menuManager { editableMenu(path: $path, language: "en") { revision } } }`, {path})
        .its('menuManager.editableMenu.revision');
}

/** Saves a menu as `user` at `revision` and yields the raw answer. */
export function saveMenu(user: TestUser | null, path: string, language: string, revision: number, items: SaveItem[]): Cypress.Chainable<GqlBody> {
    return gql(user, `mutation S($path: String!, $language: String!, $revision: Long!, $tree: String!) {
        menuManager { saveMenu(path: $path, language: $language, revision: $revision, tree: $tree) { revision itemCount } }
    }`, {path, language, revision, tree: JSON.stringify({items})});
}

/** Saves a menu as root at its current revision, and fails on any error. */
export function saveMenuOk(path: string, language: string, items: SaveItem[]): void {
    revisionOf(path).then(revision => {
        saveMenu(asRoot(), path, language, revision, items).its('errors').should('be.undefined');
    });
}

export type ResolvedItem = {id: string; kind: string; label: string; url?: string | null; targetId?: string | null; children: ResolvedItem[]};

/** Resolves a menu as `user` (a guest when null). */
export function resolve(user: TestUser | null, menu: string, language: string, workspace = 'LIVE', maxDepth = 3): Cypress.Chainable<ResolvedItem[] | null> {
    const item = 'id kind label url targetId';
    return gqlOk(user, `query R($menu: String!, $language: String!, $workspace: String, $maxDepth: Int) {
        menuManager { resolvedMenu(menu: $menu, language: $language, workspace: $workspace, maxDepth: $maxDepth) {
            items { ${item} children { ${item} children { ${item} } } } } }
    }`, {menu, language, workspace, maxDepth}).then(data => {
        const menu = data.menuManager.resolvedMenu as {items: ResolvedItem[]} | null;
        return menu ? menu.items : null;
    });
}

/** The labels of resolved items, depth first, nested ones prefixed by their parents' ("Parent > Child"). */
export function labels(items: ResolvedItem[] | null, prefix = ''): string[] {
    return (items ?? []).flatMap(i => [`${prefix}${i.label}`, ...labels(i.children ?? [], `${prefix}${i.label} > `)]);
}

/**
 * Drops a Menu component in the site's free zone and yields its path.
 *
 * @param {string} siteKey the site.
 * @param {string} name the component's node name.
 * @param {string} menuUuid the menu it shows.
 * @param {string} view the view (Layout > View, j:view): default (horizontal bar), mega, vertical or columns.
 */
export function addMenuComponent(siteKey: string, name: string, menuUuid: string, view = 'default', maxDepth = 3): Cypress.Chainable<string> {
    const parent = `/sites/${siteKey}/home/main/zone`;
    return addNodeTree(parent, {
        name,
        type: 'mnu:navigation',
        props: [
            {name: 'jcr:title', value: `Menu ${name}`, language: 'en'},
            {name: 'jcr:title', value: `Menu ${name} FR`, language: 'fr'},
            {name: 'menu', value: menuUuid, type: 'WEAKREFERENCE'},
            {name: 'maxDepth', value: String(maxDepth), type: 'LONG'},
            ...(view === 'default' ? [] : [{name: 'j:view', value: view}])
        ]
    }).then(() => `${parent}/${name}`);
}

/** Publishes a node and its subtree in the given languages, and waits for the job. */
export function publish(path: string, languages = ['en', 'fr']): void {
    publishAndWaitJobEnding(path, languages);
}

/**
 * Reads a live page as `user` (a guest when null) and yields the markup of the Menu component named
 * `name`, parsed. Fails when the component is missing: a negative check on its items is then never
 * vacuous.
 */
export function liveMenu(siteKey: string, name: string, user: TestUser | null, language = 'en', page = 'home'): Cypress.Chainable<JQuery<HTMLElement>> {
    const path = page === 'home' ? `/sites/${siteKey}/home` : `/sites/${siteKey}/home/${page}`;
    return cy.request({
        url: `/${language}${path}.html`,
        ...(user ? {auth: {username: user.username, password: user.password}} : {}),
        failOnStatusCode: false
    }).then(response => {
        expect(response.status, `the ${language} page answers`).to.eq(200);
        const doc = new DOMParser().parseFromString(String(response.body), 'text/html');
        const nav = doc.querySelector<HTMLElement>(`nav[aria-label="Menu ${name}${language === 'fr' ? ' FR' : ''}"]`);
        expect(nav, `the ${name} menu renders`).to.not.be.null;
        // Cypress wraps a yielded element in jQuery: yield it wrapped, so every caller reads the same type
        return Cypress.$(nav as HTMLElement);
    });
}

/** The visible texts of the links and headings of a rendered menu, in document order. */
export function entries($nav: JQuery<HTMLElement>): string[] {
    return [...$nav[0].querySelectorAll('a, span')]
        .filter(el => !el.closest('[class*="srOnly"]') && !(el.className || '').toString().includes('srOnly') && !(el.className || '').toString().includes('description'))
        .map(el => (el.childNodes[0]?.textContent ?? '').trim())
        .filter(Boolean);
}
