import {createUser, deleteUser} from '@jahia/cypress';
import {
    TestUser,
    addMenuComponent,
    addNodeTree,
    asRoot,
    createMenu,
    createTestSite,
    deleteTestSite,
    entries,
    gqlOk,
    labels,
    liveMenu,
    publish,
    resolve,
    saveMenuOk,
    signOut,
    uuidOf
} from '../support/menus';

/**
 * A menu shows each visitor only what they may read, with their own rights, and the cached fragment
 * never carries one visitor's items to another: Jahia keys it on the set of rights (ACL key), so two
 * users with the same rights share it, and users with other rights, or a guest, get their own.
 */
describe('Menu Manager - access rights and the render cache', () => {
    const siteKey = 'mnu-acl';
    const home = `/sites/${siteKey}/home`;
    const members = `${home}/members`;
    // reader1 and reader2 hold the same rights (reader on the members page); outsider holds none there
    const reader1: TestUser = {username: 'mnu-acl-reader1', password: 'mnuReader1234'};
    const reader2: TestUser = {username: 'mnu-acl-reader2', password: 'mnuReader1234'};
    const outsider: TestUser = {username: 'mnu-acl-outsider', password: 'mnuOutsider1234'};
    let menuPath: string;

    /** Whether a live page answers 200 to `user` (a guest when null). */
    const readable = (path: string, user: TestUser | null): Cypress.Chainable<boolean> => cy.request({
        url: `/en${path}.html`,
        ...(user ? {auth: {username: user.username, password: user.password}} : {}),
        failOnStatusCode: false
    }).then(response => response.status === 200);

    /** The menu's entries as `user` sees them on the live home page, signed out afterwards. */
    const seenBy = (user: TestUser | null): Cypress.Chainable<string[]> =>
        liveMenu(siteKey, 'acl-nav', user).then($nav => {
            const seen = entries($nav);
            return signOut().then(() => seen);
        });

    before(() => {
        createTestSite(siteKey);
        [reader1, reader2, outsider].forEach(user => {
            deleteUser(user.username);
            createUser(user.username, user.password);
        });
        addNodeTree(home, {name: 'members', type: 'jnt:page', props: [
            {name: 'jcr:title', value: 'Members area', language: 'en'},
            {name: 'jcr:title', value: 'Espace membres', language: 'fr'},
            {name: 'j:templateName', value: 'content'}]});
        [reader1, reader2].forEach(user => {
            cy.executeGroovy('groovy/breakAclInheritance.groovy', {NODE_PATH: members, READ_USER: user.username, READ_ROLE: 'reader'})
                .should('not.contain', 'failed');
        });
        uuidOf(`${home}/about`).then(about => {
            uuidOf(members).then(restricted => {
                createMenu(asRoot(), siteKey, 'Guarded menu').then(path => {
                    menuPath = path;
                    saveMenuOk(path, 'en', [
                        {kind: 'page', page: about},
                        {kind: 'page', page: restricted},
                        {kind: 'externalLink', label: 'Jahia', url: 'https://www.jahia.com'}
                    ]);
                    uuidOf(path).then(uuid => addMenuComponent(siteKey, 'acl-nav', uuid));
                });
            });
        });
        cy.then(() => publish(`/sites/${siteKey}`));
        // the rights took: the readers read the page, the others do not
        readable(members, reader1).should('eq', true);
        signOut();
        readable(members, outsider).should('eq', false);
        signOut();
        readable(members, null).should('eq', false);
        signOut();
    });

    after(() => {
        [reader1, reader2, outsider].forEach(user => deleteUser(user.username));
        deleteTestSite(siteKey);
    });

    it('leaves out a page the caller may not read, in the API', () => {
        resolve(asRoot(), menuPath, 'en').then(items => expect(labels(items)).to.deep.eq(['About us', 'Members area', 'Jahia']));
        signOut();
        resolve(reader1, menuPath, 'en').then(items => expect(labels(items)).to.deep.eq(['About us', 'Members area', 'Jahia']));
        signOut();
        resolve(outsider, menuPath, 'en').then(items => expect(labels(items)).to.deep.eq(['About us', 'Jahia']));
        signOut();
        resolve(null, menuPath, 'en').then(items => expect(labels(items)).to.deep.eq(['About us', 'Jahia']));
    });

    it('serves root, then a guest, each their own menu', () => {
        seenBy(asRoot()).should('deep.eq', ['About us', 'Members area', 'Jahia']);
        seenBy(null).should('deep.eq', ['About us', 'Jahia']);
    });

    it('serves two users with the same rights the same menu, and nobody else theirs', () => {
        seenBy(reader1).should('deep.eq', ['About us', 'Members area', 'Jahia']);
        seenBy(reader2).should('deep.eq', ['About us', 'Members area', 'Jahia']);
        seenBy(outsider).should('deep.eq', ['About us', 'Jahia']);
        seenBy(null).should('deep.eq', ['About us', 'Jahia']);
    });

    it('does not serve a reader the fragment a guest warmed after a publication', () => {
        // a publication of the menu flushes the fragment: the guest renders it first
        gqlOk(asRoot(), 'query Q($path: String!) { menuManager { editableMenu(path: $path, language: "en") { items { id kind target { uuid } url } } } }', {path: menuPath})
            .its('menuManager.editableMenu.items').then((items: {id: string; kind: 'page' | 'externalLink'; target?: {uuid: string}; url?: string}[]) => {
                saveMenuOk(menuPath, 'en', items.map(i => i.kind === 'page'
                    ? {id: i.id, kind: 'page', page: i.target?.uuid}
                    : {id: i.id, kind: 'externalLink', label: 'Jahia.com', url: i.url}));
            });
        cy.then(() => publish(menuPath));
        seenBy(null).should('deep.eq', ['About us', 'Jahia.com']);
        seenBy(outsider).should('deep.eq', ['About us', 'Jahia.com']);
        seenBy(reader2).should('deep.eq', ['About us', 'Members area', 'Jahia.com']);
    });
});
