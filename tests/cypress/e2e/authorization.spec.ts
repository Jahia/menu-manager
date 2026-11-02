import {deleteUser} from '@jahia/cypress';
import {
    TestUser,
    asRoot,
    assertEffectiveUser,
    assertRefused,
    createMenu,
    createTestSite,
    createTestUser,
    deleteTestSite,
    gql,
    gqlOk,
    nodeExists,
    revisionOf,
    saveMenu
} from '../support/menus';

/**
 * Who may manage menus: the screen's fields check `manageMenus` on the site on the server (site
 * administrators hold it), whatever the browser shows. Visitors reach `resolvedMenu` only, through the
 * module's API scope, and with their own rights (acl-and-cache.spec.ts).
 */
describe('Menu Manager - authorization', () => {
    const siteKey = 'mnu-auth';
    const otherSiteKey = 'mnu-auth-other';
    const admin: TestUser = {username: 'mnu-auth-admin', password: 'mnuAdmin1234'};
    // privileged lets the editor through the GraphQL API filter, so the module's own check is what refuses
    const editor: TestUser = {username: 'mnu-auth-editor', password: 'mnuEditor1234'};
    const otherAdmin: TestUser = {username: 'mnu-auth-other', password: 'mnuOther1234'};
    let menuPath: string;

    const fields = {
        menus: 'query Q($siteKey: String!) { menuManager { menus(siteKey: $siteKey, language: "en") { path } } }',
        editableMenu: 'query Q($path: String!) { menuManager { editableMenu(path: $path, language: "en") { revision } } }',
        createMenu: 'mutation M($siteKey: String!) { menuManager { createMenu(siteKey: $siteKey, title: "Intruder", language: "en") { path } } }',
        updateMenu: 'mutation M($path: String!) { menuManager { updateMenu(path: $path, language: "en", title: "Renamed") } }',
        duplicateMenu: 'mutation M($path: String!) { menuManager { duplicateMenu(path: $path, title: "Copy", language: "en") { path } } }',
        deleteMenu: 'mutation M($path: String!) { menuManager { deleteMenu(path: $path) } }'
    };

    /** Calls every field of the Menus screen as `user` and expects each to be refused by the module. */
    const assertAllRefused = (user: TestUser, site: string): void => {
        Object.entries(fields).forEach(([field, query]) => {
            gql(user, query, {siteKey: site, path: menuPath}).then(body => assertRefused(body, ['menuManager', field]));
        });
        revisionOf(menuPath).then(revision => {
            saveMenu(user, menuPath, 'en', revision, [{kind: 'section', label: 'Hacked'}])
                .then(body => assertRefused(body, ['menuManager', 'saveMenu']));
        });
    };

    before(() => {
        createTestSite(siteKey);
        createTestSite(otherSiteKey, 'en');
        createTestUser(admin, `/sites/${siteKey}`, ['site-administrator']);
        createTestUser(editor, `/sites/${siteKey}`, ['editor', 'privileged']);
        createTestUser(otherAdmin, `/sites/${otherSiteKey}`, ['site-administrator']);
        createMenu(asRoot(), siteKey, 'Guarded').then(path => {
            menuPath = path;
        });
    });

    after(() => {
        [admin, editor, otherAdmin].forEach(user => deleteUser(user.username));
        deleteTestSite(siteKey);
        deleteTestSite(otherSiteKey);
    });

    it('lets a site administrator manage the menus of the site', () => {
        assertEffectiveUser(admin);
        gqlOk(admin, fields.menus, {siteKey}).its('menuManager.menus').should('have.length', 1);
        revisionOf(menuPath).then(revision => {
            saveMenu(admin, menuPath, 'en', revision, [{kind: 'section', label: 'By the admin'}]).then(body => {
                expect(body.errors).to.be.undefined;
                expect(body.data?.menuManager).to.deep.eq({saveMenu: {revision: revision + 1, itemCount: 1}});
            });
        });
        gqlOk(admin, fields.duplicateMenu, {path: menuPath}).its('menuManager.duplicateMenu.path').then(copy => {
            gqlOk(admin, fields.deleteMenu, {path: copy}).its('menuManager.deleteMenu').should('eq', true);
            nodeExists(copy).should('eq', false);
        });
    });

    it('refuses an editor every field of the Menus screen, past the API filter', () => {
        // the editor gets through the filter: the refusals below come from the module
        assertEffectiveUser(editor);
        gqlOk(editor, 'query Q($path: String!) { jcr { nodeByPath(path: $path) { path } } }', {path: menuPath})
            .its('jcr.nodeByPath.path').should('eq', menuPath);
        assertAllRefused(editor, siteKey);
        nodeExists(menuPath).should('eq', true);
        gqlOk(asRoot(), fields.editableMenu, {path: menuPath}).its('menuManager.editableMenu.revision').should('eq', 1);
    });

    it('refuses the administrator of another site', () => {
        assertEffectiveUser(otherAdmin);
        gqlOk(otherAdmin, fields.menus, {siteKey: otherSiteKey}).its('menuManager.menus').should('deep.eq', []);
        assertAllRefused(otherAdmin, siteKey);
    });

    it('refuses a path that is not a menu, as a missing one', () => {
        gql(admin, fields.editableMenu, {path: `/sites/${siteKey}/home`}).then(body => assertRefused(body, ['menuManager', 'editableMenu']));
        gql(admin, fields.deleteMenu, {path: `/sites/${siteKey}/menus/../home`}).then(body => assertRefused(body, ['menuManager', 'deleteMenu']));
        nodeExists(`/sites/${siteKey}/home`).should('eq', true);
    });

    it('refuses a guest the Menus screen, and opens resolvedMenu only', () => {
        gql(null, fields.editableMenu, {path: menuPath}).then(body => {
            expect(body.errors?.[0]?.message).to.eq('Permission denied');
        });
        revisionOf(menuPath).then(revision => {
            saveMenu(null, menuPath, 'en', revision, [{kind: 'section', label: 'Hacked'}])
                .its('errors.0.message').should('eq', 'Permission denied');
        });
        gql(null, 'query Q($menu: String!) { menuManager { resolvedMenu(menu: $menu, language: "en") { title } } }', {menu: menuPath})
            .its('errors').should('be.undefined');
        gqlOk(asRoot(), fields.editableMenu, {path: menuPath}).its('menuManager.editableMenu.revision').should('eq', 1);
    });
});
