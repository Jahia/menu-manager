import {deleteUser} from '@jahia/cypress';
import {TestUser, createTestSite, createTestUser, deleteTestSite, gqlOk, asRoot} from '../support/menus';

/**
 * The Menus screen (jContent > Additional > Menus) as an editor uses it: create a menu, add pages with
 * jContent's ChoiceTree, a section and an external link, nest an item with a Move button and reorder
 * with a real pointer drag (dnd-kit), save, and read the stored tree back. Only users holding
 * manageMenus get the screen.
 */
describe('Menu Manager - the Menus screen', () => {
    const siteKey = 'mnu-ui';
    const admin: TestUser = {username: 'mnu-ui-admin', password: 'mnuAdmin1234'};
    const editor: TestUser = {username: 'mnu-ui-editor', password: 'mnuEditor1234'};
    const route = `/jahia/jcontent/${siteKey}/en/apps/menuManager`;

    const signIn = (user: TestUser): void => {
        cy.visit('/cms/logout', {failOnStatusCode: false});
        cy.login(user.username, user.password);
    };

    /**
     * Asserts the structure's rows (label and depth, in order), retried until the screen shows them:
     * a `.then` would read them once, before React has drawn the result of a move.
     */
    const expectRows = (expected: {label: string; depth: number}[]): void => {
        cy.get('[data-mnu-role="menu-tree"] li[data-mnu-item]').should($rows => {
            expect([...$rows].map(li => ({
                label: (li.querySelector('[data-mnu-role="label"]')?.textContent ?? '').trim(),
                depth: Number(li.getAttribute('data-depth'))
            }))).to.deep.eq(expected);
        });
    };

    /**
     * Drags an item by its handle: pointer down, a series of moves (dnd-kit starts after 4 px and
     * follows each move), pointer up. dnd-kit listens on the element the pointer went down on.
     */
    const drag = (label: string, dx: number, dy: number): void => {
        cy.get(`button[aria-label="Move: ${label}"]`).then($handle => {
            const box = $handle[0].getBoundingClientRect();
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            const pointer = {button: 0, buttons: 1, isPrimary: true, pointerId: 1, pointerType: 'mouse', force: true, eventConstructor: 'PointerEvent'};
            cy.wrap($handle).trigger('pointerdown', {...pointer, clientX: x, clientY: y});
            for (let step = 1; step <= 12; step++) {
                cy.wrap($handle).trigger('pointermove', {...pointer, clientX: x + (dx * step) / 12, clientY: y + (dy * step) / 12});
                cy.wait(20);
                if (step === 1) {
                    // past the 4 px activation distance: the drag has started
                    cy.get('[data-dragging="true"]').should('exist');
                }
            }
            // the row under the pointer is state of the screen: let it settle before the drop
            cy.wait(250);
            cy.wrap($handle).trigger('pointerup', {...pointer, buttons: 0, clientX: x + dx, clientY: y + dy});
        });
    };

    before(() => {
        createTestSite(siteKey);
        createTestUser(admin, `/sites/${siteKey}`, ['site-administrator']);
        createTestUser(editor, `/sites/${siteKey}`, ['editor']);
    });

    beforeEach(() => {
        // jContent's ResizeObserver throws on logout while a page is mounted: that error only
        cy.on('uncaught:exception', e => !(e.message.includes('offsetWidth') && String(e.stack).includes('/modules/jcontent/')));
        cy.viewport(1600, 1000);
    });

    afterEach(() => {
        cy.visit('/cms/logout', {failOnStatusCode: false});
    });

    after(() => {
        [admin, editor].forEach(user => deleteUser(user.username));
        deleteTestSite(siteKey);
    });

    it('builds a menu with every kind of item, nests and reorders it, and saves it', () => {
        signIn(admin);
        cy.visit(route);
        cy.get('[data-mnu-role="no-menu"]', {timeout: 30000}).contains('button', 'Create a menu').click();
        cy.get('input[placeholder="Main menu"]').type('Header menu');
        cy.contains('button', /^Create$/).click();
        cy.get('[data-mnu-role="structure"]').should('contain', 'This menu is empty');

        // Pages, with jContent's ChoiceTree
        const tree = '[data-mnu-role="page-choice"] [data-sel-role="choice-tree"]';
        cy.get(`${tree} [role="listbox"]`).click();
        cy.get(`${tree} input[role="searchbox"]`).type('About');
        cy.contains(`${tree} [role="treeitem"] .moonstone-treeView_item`, 'About us').click();
        // closed by clicking outside (Moonstone's overlay); the choice stays as a chip
        cy.get('.moonstone-menu_overlay').click({force: true});
        cy.get('.moonstone-menu_overlay').should('not.exist');
        cy.get(tree).should('contain', 'About us');
        cy.get('[data-mnu-role="add-items"]').contains('button', 'Add to menu').click();

        // A section
        cy.get('[data-mnu-role="add-items"]').contains('[role="tab"]', /^Section$/).click();
        cy.get('#mnu-add-section').type('Resources');
        cy.get('#mnu-add-section').closest('[role="tabpanel"]').contains('button', 'Add to menu').click();

        // An external link
        cy.get('[data-mnu-role="add-items"]').contains('[role="tab"]', /^External link$/).click();
        cy.get('#mnu-add-url').clear().type('https://www.jahia.com');
        cy.get('#mnu-add-external').type('Jahia');
        cy.get('#mnu-add-external').closest('[role="tabpanel"]').contains('button', 'Add to menu').click();
        expectRows([{label: 'About us', depth: 0}, {label: 'Resources', depth: 0}, {label: 'Jahia', depth: 0}]);

        // Keyboard path: the Move buttons of the item's editor
        cy.get('button[aria-label="Edit Jahia"]').click();
        cy.contains('button', 'Under Resources').click();
        expectRows([{label: 'About us', depth: 0}, {label: 'Resources', depth: 0}, {label: 'Jahia', depth: 1}]);

        // Pointer path: drag About us below Jahia, back to the first level
        cy.get('[data-mnu-role="menu-tree"] li[data-mnu-item]').then($rows => {
            const first = $rows[0].getBoundingClientRect();
            const last = $rows[2].getBoundingClientRect();
            drag('About us', 0, last.bottom - first.top);
        });
        expectRows([{label: 'Resources', depth: 0}, {label: 'Jahia', depth: 1}, {label: 'About us', depth: 0}]);

        cy.contains('button', 'Save menu').click();
        // saved: jContent's notification says so, no unsaved changes are left, and the stored tree is the one built
        cy.contains('Menu saved').should('be.visible');
        cy.get('[data-mnu-role="menu-manager"]').should('not.contain', 'Unsaved changes');
        cy.contains('button', 'Save menu').should('be.disabled');
        gqlOk(asRoot(), `query Q($path: String!) { menuManager { editableMenu(path: $path, language: "en") {
            items { kind label target { title } url children { kind label url } } } } }`, {path: `/sites/${siteKey}/menus/header-menu`})
            .its('menuManager.editableMenu.items').should('deep.eq', [
                {kind: 'section', label: 'Resources', target: null, url: null, children: [{kind: 'externalLink', label: 'Jahia', url: 'https://www.jahia.com'}]},
                {kind: 'page', label: null, target: {title: 'About us'}, url: null, children: []}
            ]);
    });

    it('uses the full width of the panel', () => {
        signIn(admin);
        cy.visit(route);
        cy.get('[data-mnu-role="structure"]', {timeout: 30000}).should('exist');
        cy.get('.moonstone-layoutContent').should($area => {
            const area = $area[0].getBoundingClientRect();
            const cards = [...$area[0].querySelectorAll('[data-mnu-role="add-items"], [data-mnu-role="structure"]')].map(el => el.getBoundingClientRect());
            expect(cards.length, 'cards rendered').to.be.greaterThan(1);
            const left = Math.min(...cards.map(r => r.left)) - area.left;
            const right = area.right - Math.max(...cards.map(r => r.right));
            expect(right - left, 'right margin minus left margin').to.be.within(0, 20);
            [...$area[0].querySelectorAll('*')].forEach(el => {
                expect(el.getBoundingClientRect().right, 'nothing overflows the window').to.be.at.most(el.ownerDocument.documentElement.clientWidth + 1);
            });
        });
    });

    it('is not offered to an editor without manageMenus', () => {
        signIn(editor);
        cy.visit(`/jahia/jcontent/${siteKey}/en/pages`);
        // jContent itself is there: the absence below is not a page that failed to load
        cy.contains('Additional', {timeout: 30000}).should('exist').click();
        cy.contains('a, li, [role="treeitem"], div', /^Menus$/).should('not.exist');
        cy.visit(route);
        cy.contains('Additional', {timeout: 30000}).should('exist');
        cy.get('[data-mnu-role="menu-manager"]').should('not.exist');
    });
});
