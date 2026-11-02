import {deleteUser} from '@jahia/cypress';
import {
    TestUser,
    addMenuComponent,
    asRoot,
    createMenu,
    createTestSite,
    createTestUser,
    deleteTestSite,
    publish,
    saveMenuOk,
    uuidOf
} from '../support/menus';

/**
 * WCAG 2.1 AA (axe-core) on what the module draws: the four views on live, with a dropdown and a mega
 * panel open, and the Menus screen. Scoped to the module's own markup: the template set and jContent
 * answer for theirs.
 */
describe('Menu Manager - accessibility', () => {
    const siteKey = 'mnu-a11y';
    const admin: TestUser = {username: 'mnu-a11y-admin', password: 'mnuAdmin1234'};
    const wcag = {runOnly: {type: 'tag' as const, values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']}};
    const views = ['default', 'mega', 'vertical', 'columns'];
    /**
     * The screen as axe checks it, without Moonstone's filled accent and danger buttons: white on
     * #00a0e3 (2.9:1) and on Moonstone's red miss AA, and they are Jahia's own back-office colours,
     * kept as jContent draws them (user decision, 2026-11-02; to fix in Moonstone). Everything else,
     * their outlined and ghost buttons included, is checked.
     */
    const screen = (root: string) => ({include: [[root]], exclude: [['.moonstone-button_accent'], ['.moonstone-button_danger']]});

    /** Fails with the list of violations, written to the terminal too. */
    const report = (violations: {id: string; impact?: string | null; nodes: {html: string; failureSummary?: string}[]}[]): void => {
        violations.forEach(v => v.nodes.forEach(n => cy.task('log', `A11Y ${v.id} (${v.impact}): ${n.html.slice(0, 160)} :: ${(n.failureSummary ?? '').split('\n').slice(1, 2).join('')}`)));
    };

    before(() => {
        createTestSite(siteKey);
        createTestUser(admin, `/sites/${siteKey}`, ['site-administrator']);
        uuidOf(`/sites/${siteKey}/home/about`).then(about => {
            uuidOf(`/sites/${siteKey}/home/contact`).then(contact => {
                createMenu(asRoot(), siteKey, 'Main menu').then(path => {
                    saveMenuOk(path, 'en', [
                        {kind: 'page', page: about, description: 'Who we are', children: [
                            {kind: 'page', page: contact, label: 'Write to us'},
                            {kind: 'externalLink', label: 'Careers', url: 'https://example.org/careers', newTab: true}
                        ], promotion: {title: 'Meet the team', text: 'Every face behind the site.', linkLabel: 'Meet them'}},
                        {kind: 'section', label: 'Resources', children: [
                            {kind: 'externalLink', label: 'Jahia', url: 'https://www.jahia.com', style: 'highlight'}
                        ]},
                        {kind: 'externalLink', label: 'Sign up', url: 'https://example.org/signup', style: 'button'}
                    ]);
                    uuidOf(path).then(uuid => views.forEach(view => addMenuComponent(siteKey, view, uuid, view)));
                });
            });
        });
        cy.then(() => publish(`/sites/${siteKey}`));
    });

    after(() => {
        deleteUser(admin.username);
        deleteTestSite(siteKey);
    });

    it('draws every view without a WCAG 2.1 AA violation, panels closed and open', () => {
        cy.viewport(1440, 900);
        cy.visit(`/sites/${siteKey}/home.html`);
        cy.injectAxe();
        views.forEach(view => {
            cy.checkA11y(`nav[aria-label="Menu ${view}"]`, wcag, report);
        });
        // a dropdown (default view) and a mega panel, opened with their disclosure buttons
        ['default', 'mega'].forEach(view => {
            cy.get(`nav[aria-label="Menu ${view}"] button[data-mnu-toggle]`).first().should('be.visible').click();
            cy.get(`nav[aria-label="Menu ${view}"] button[data-mnu-toggle]`).first().should('have.attr', 'aria-expanded', 'true');
            cy.checkA11y(`nav[aria-label="Menu ${view}"]`, wcag, report);
            cy.get('body').type('{esc}');
            cy.get(`nav[aria-label="Menu ${view}"] button[data-mnu-toggle]`).first().should('have.attr', 'aria-expanded', 'false');
        });
    });

    it('draws the Menus screen without a WCAG 2.1 AA violation', () => {
        cy.on('uncaught:exception', e => !(e.message.includes('offsetWidth') && String(e.stack).includes('/modules/jcontent/')));
        cy.viewport(1600, 1000);
        cy.login(admin.username, admin.password);
        cy.visit(`/jahia/jcontent/${siteKey}/en/apps/menuManager`);
        cy.get('[data-mnu-role="structure"]', {timeout: 30000}).should('contain', 'About us');
        cy.injectAxe();
        cy.checkA11y(screen('[data-mnu-role="menu-manager"]'), wcag, report);
        // an item's editor open, with unsaved changes (Save and Discard enabled)
        cy.get('button[aria-label="Edit About us"]').click();
        cy.contains('button', 'Down one').click();
        cy.contains('Unsaved changes').should('exist');
        cy.checkA11y(screen('[data-mnu-role="menu-manager"]'), wcag, report);
        // the confirmation dialog (Moonstone's Modal, portaled to body)
        cy.contains('button', 'Remove').click();
        cy.contains('Please confirm').should('be.visible');
        cy.get('[role="dialog"]').should('be.visible').and('contain', 'Please confirm');
        cy.checkA11y(screen('[role="dialog"]'), wcag, report);
        cy.contains('button', /^Cancel$/).click();
        cy.visit('/cms/logout', {failOnStatusCode: false});
    });
});
