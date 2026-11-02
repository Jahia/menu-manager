import {
    addMenuComponent,
    asRoot,
    createMenu,
    createTestSite,
    deleteTestSite,
    entries,
    gqlOk,
    liveMenu,
    publish,
    saveMenuOk,
    uuidOf
} from '../support/menus';

/**
 * The primary flow: a site administrator builds a menu with every kind of item through the API the
 * Menus screen uses, publishes it, and visitors see it through the Menu component, in each language,
 * with the current page marked; a later change reaches the cached live page once published.
 */
describe('Menu Manager - build, publish and render a menu', () => {
    const siteKey = 'mnu-happy';
    let menuPath: string;
    let menuUuid: string;
    let aboutUuid: string;
    let contactUuid: string;

    before(() => {
        createTestSite(siteKey);
        uuidOf(`/sites/${siteKey}/home/about`).then(uuid => {
            aboutUuid = uuid;
        });
        uuidOf(`/sites/${siteKey}/home/contact`).then(uuid => {
            contactUuid = uuid;
        });
        createMenu(asRoot(), siteKey, 'Main menu').then(path => {
            menuPath = path;
            saveMenuOk(path, 'en', [
                {kind: 'page', page: aboutUuid, description: 'Who we are'},
                {kind: 'section', label: 'Resources', children: [
                    {kind: 'internalLink', label: 'Write to us', target: contactUuid},
                    {kind: 'externalLink', label: 'Jahia', url: 'https://www.jahia.com', newTab: true}
                ]},
                {kind: 'externalLink', label: 'Sign up', url: 'https://example.org/signup', style: 'button'}
            ]);
            uuidOf(path).then(uuid => {
                menuUuid = uuid;
                addMenuComponent(siteKey, 'main-nav', uuid);
            });
        });
        // A French label for the section only: the other items fall back
        cy.then(() => gqlOk(asRoot(), `query E($path: String!) { menuManager { editableMenu(path: $path, language: "fr") { revision
            items { id kind page: target { uuid } description children { id kind label url newTab target { uuid } } } } } }`, {path: menuPath}))
            .then(data => {
                const menu = data.menuManager.editableMenu;
                const [about, resources, signup] = menu.items;
                const [write, jahia] = resources.children;
                saveMenuOk(menuPath, 'fr', [
                    {id: about.id, kind: 'page', page: aboutUuid},
                    {id: resources.id, kind: 'section', label: 'Ressources', children: [
                        {id: write.id, kind: 'internalLink', target: contactUuid},
                        {id: jahia.id, kind: 'externalLink', url: 'https://www.jahia.com', newTab: true}
                    ]},
                    {id: signup.id, kind: 'externalLink', url: 'https://example.org/signup', style: 'button'}
                ]);
            });
        cy.then(() => publish(`/sites/${siteKey}`));
    });

    after(() => {
        deleteTestSite(siteKey);
    });

    it('lists the menu on its site, with its item count', () => {
        gqlOk(asRoot(), 'query M($siteKey: String!) { menuManager { menus(siteKey: $siteKey, language: "en") { path title itemCount } } }', {siteKey})
            .its('menuManager.menus').should('deep.eq', [{path: menuPath, title: 'Main menu', itemCount: 5}]);
    });

    it('renders the menu for a visitor in live, page titles for unlabelled page items', () => {
        liveMenu(siteKey, 'main-nav', null).then($nav => {
            const nav = $nav[0];
            expect(entries($nav)).to.deep.eq(['About us', 'Resources', 'Write to us', 'Jahia', 'Sign up']);
            const about = [...nav.querySelectorAll('a')].find(a => a.textContent?.startsWith('About us'));
            expect(about?.getAttribute('href')).to.match(/\/sites\/mnu-happy\/home\/about\.html$/);
            const jahia = [...nav.querySelectorAll('a')].find(a => a.textContent?.startsWith('Jahia'));
            expect(jahia?.getAttribute('target')).to.eq('_blank');
            expect(jahia?.getAttribute('rel')).to.contain('noopener');
            expect(nav.querySelector('a[aria-current="page"]'), 'no item is the home page').to.be.null;
        });
    });

    it('renders French labels, falling back to English where the item has none', () => {
        liveMenu(siteKey, 'main-nav', null, 'fr').then(nav => {
            // label in French, else the target's French title, else the English label: the page item and the
            // internal link take their target's French title, the section its own label, the addresses fall back
            expect(entries(nav)).to.deep.eq(['A propos', 'Ressources', 'Contact FR', 'Jahia', 'Sign up']);
        });
    });

    it('renders the view the editor picked in Layout > View, one view per layout', () => {
        const views = {'nav-mega': 'mega', 'nav-vertical': 'vertical', 'nav-columns': 'columns'};
        Object.entries(views).forEach(([name, view]) => addMenuComponent(siteKey, name, menuUuid, view));
        cy.then(() => publish(`/sites/${siteKey}/home/main/zone`));
        // the default view (no j:view) is the horizontal bar
        liveMenu(siteKey, 'main-nav', null).then($nav => {
            expect($nav.attr('class')).to.match(/_horizontal_/).and.not.match(/_mega_/);
        });
        Object.entries(views).forEach(([name, view]) => {
            liveMenu(siteKey, name, null).then($nav => {
                expect($nav.attr('class'), `${name} draws the ${view} view`).to.match(new RegExp(`_${view}_`));
                expect(entries($nav), 'with the same items').to.include.members(['About us', 'Resources', 'Sign up']);
            });
        });
    });

    it('draws a button-style item as a padded pill in every view', () => {
        cy.viewport(1440, 900);
        cy.visit(`/sites/${siteKey}/home.html`);
        cy.get('nav[data-testid="mnu-navigation"] a[class*="_button_"]').should('have.length.at.least', 4).each($a => {
            const style = getComputedStyle($a[0]);
            expect(parseFloat(style.paddingLeft), 'padding left').to.be.greaterThan(8);
            expect(parseFloat(style.paddingRight), 'padding right').to.be.greaterThan(8);
        });
    });

    it('marks the current page', () => {
        gqlOk(asRoot(), `query R($menu: String!, $path: String!) { menuManager { resolvedMenu(menu: $menu, language: "en", workspace: "EDIT", currentPath: $path) {
            items { label current children { label current } } } } }`, {menu: menuUuid, path: `/sites/${siteKey}/home/contact`})
            .its('menuManager.resolvedMenu.items').then(items => {
                expect(items[0]).to.include({label: 'About us', current: false});
                expect(items[1]).to.include({label: 'Resources', current: false});
                expect(items[1].children[0]).to.include({label: 'Write to us', current: true});
            });
    });

    it('shows a published change on the cached live page, and not before', () => {
        liveMenu(siteKey, 'main-nav', null).then(nav => expect(entries(nav)).to.include('Sign up'));
        gqlOk(asRoot(), `query E($path: String!) { menuManager { editableMenu(path: $path, language: "en") {
            items { id kind label url style target { uuid } children { id kind label url newTab target { uuid } } } } } }`, {path: menuPath})
            .then(data => {
                const items = data.menuManager.editableMenu.items;
                const [about, resources, signup] = items;
                saveMenuOk(menuPath, 'en', [
                    {id: about.id, kind: 'page', page: aboutUuid, description: 'Who we are'},
                    {id: resources.id, kind: 'section', label: 'Resources', children: resources.children.map((c: {id: string; kind: 'internalLink' | 'externalLink'; label: string; url?: string; newTab: boolean; target?: {uuid: string}}) => ({
                        id: c.id, kind: c.kind, label: c.label, url: c.url ?? undefined, newTab: c.newTab, target: c.target?.uuid
                    }))},
                    {id: signup.id, kind: 'externalLink', label: 'Join us', url: 'https://example.org/signup', style: 'button'}
                ]);
            });
        // saved in default only: live still serves the old label
        liveMenu(siteKey, 'main-nav', null).then(nav => expect(entries(nav)).to.include('Sign up').and.not.include('Join us'));
        cy.then(() => publish(menuPath));
        liveMenu(siteKey, 'main-nav', null).then(nav => expect(entries(nav)).to.include('Join us').and.not.include('Sign up'));
    });
});
