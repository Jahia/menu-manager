import {
    SaveItem,
    addMenuComponent,
    addNodeTree,
    asRoot,
    createMenu,
    createTestSite,
    deleteTestSite,
    entries,
    gql,
    gqlOk,
    labels,
    liveMenu,
    publish,
    resolve,
    revisionOf,
    saveMenu,
    saveMenuOk,
    uuidOf
} from '../support/menus';

/**
 * What the save API refuses (each refusal leaves the menu as it was), and how the resolver treats
 * languages, depth and targets that are hidden, missing or not published.
 */
describe('Menu Manager - edge cases', () => {
    const siteKey = 'mnu-edge';
    const home = `/sites/${siteKey}/home`;
    let menuPath: string;
    let menuUuid: string;
    let aboutUuid: string;

    before(() => {
        createTestSite(siteKey);
        uuidOf(`${home}/about`).then(uuid => {
            aboutUuid = uuid;
        });
        createMenu(asRoot(), siteKey, 'Edge').then(path => {
            menuPath = path;
            uuidOf(path).then(uuid => {
                menuUuid = uuid;
            });
        });
    });

    beforeEach(() => {
        cy.then(() => saveMenuOk(menuPath, 'en', [link('Baseline')]));
    });

    after(() => {
        deleteTestSite(siteKey);
    });

    /** An external link whose label the assertions read (a section over nothing is left out). */
    const link = (label: string, extra: Partial<SaveItem> = {}): SaveItem => ({kind: 'externalLink', label, url: `https://example.org/${encodeURIComponent(label)}`, ...extra});

    /** Saves `items` at the current revision and expects `code`, with the menu left as it was. */
    const refused = (items: SaveItem[], code: string): void => {
        revisionOf(menuPath).then(revision => {
            saveMenu(asRoot(), menuPath, 'en', revision, items).then(body => {
                expect(body.errors?.[0]?.message, code).to.eq(code);
                expect(body.errors?.[0]?.path).to.deep.eq(['menuManager', 'saveMenu']);
            });
            revisionOf(menuPath).should('eq', revision);
        });
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['Baseline']));
    };

    it('refuses a save made on an older revision (another editor saved first)', () => {
        revisionOf(menuPath).then(revision => {
            saveMenuOk(menuPath, 'en', [link('First editor')]);
            saveMenu(asRoot(), menuPath, 'en', revision, [link('Second editor')])
                .its('errors.0.message').should('eq', 'conflict');
        });
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['First editor']));
    });

    it('refuses addresses outside http, https, mailto and tel, before and after cleaning', () => {
        ['javascript:alert(1)', 'JavaScript:alert(1)', '\tjavascript:alert(1)', '//evil.example/x', '/\\evil.example', 'data:text/html,x', 'https:/x']
            .forEach(url => refused([{kind: 'externalLink', label: 'Bad', url}], 'badUrl'));
        refused([{kind: 'section', label: 'Promo', promotion: {title: 'Offer', url: 'javascript:alert(1)'}}], 'badUrl');
    });

    it('refuses a fourth level, more than 500 items, and unreadable or unknown values', () => {
        refused([{kind: 'section', label: '1', children: [{kind: 'section', label: '2', children: [
            {kind: 'section', label: '3', children: [{kind: 'section', label: '4'}]}]}]}], 'tooDeep');
        refused(Array.from({length: 501}, (_, i) => ({kind: 'section' as const, label: `S${i}`})), 'tooMany');
        refused([{kind: 'section', label: 'x', style: 'blink' as 'default'}], 'unknownValue');
        refused([{kind: 'section', label: 'x', invalidLanguages: ['../en']}], 'unknownValue');
        refused([{kind: 'section', label: 'x'.repeat(201)}], 'tooLong');
        revisionOf(menuPath).then(revision => {
            gql(asRoot(), `mutation S($path: String!, $revision: Long!) {
                menuManager { saveMenu(path: $path, language: "en", revision: $revision, tree: "{not json") { revision } } }`,
            {path: menuPath, revision}).its('errors.0.message').should('eq', 'unreadable');
        });
    });

    it('refuses a new section without a label, and items without a valid target', () => {
        refused([{kind: 'section'}], 'sectionLabel');
        refused([{kind: 'page', label: 'No page'}], 'noTarget');
        refused([{kind: 'page', page: '00000000-0000-4000-8000-000000000000'}], 'badTarget');
        refused([{kind: 'page', page: 'not-a-uuid'}], 'noTarget');
        // a page item must point to a page
        uuidOf(`/sites/${siteKey}/files`).then(files => refused([{kind: 'page', page: files}], 'badTarget'));
    });

    it('keeps markup characters as text, in the editor and on the page', () => {
        const label = 'R&D <draft> "q" \'s é';
        saveMenuOk(menuPath, 'en', [{kind: 'externalLink', label, url: 'https://example.org/?a=1&b=<2>'}]);
        gqlOk(asRoot(), 'query Q($path: String!) { menuManager { editableMenu(path: $path, language: "en") { items { label url } } } }', {path: menuPath})
            .its('menuManager.editableMenu.items.0').should('deep.eq', {label, url: 'https://example.org/?a=1&b=<2>'});
        addMenuComponent(siteKey, 'escaped', menuUuid, 'vertical');
        cy.then(() => publish(`/sites/${siteKey}`));
        liveMenu(siteKey, 'escaped', null).then($nav => {
            expect(entries($nav)).to.deep.eq([label]);
            expect($nav[0].querySelector('draft'), 'no element made from the label').to.be.null;
            expect($nav[0].querySelector('a')?.getAttribute('href')).to.eq('https://example.org/?a=1&b=<2>');
        });
    });

    it('falls back to the menu\'s fallback language, the site\'s default one when none is set', () => {
        saveMenuOk(menuPath, 'en', [link('English only')]);
        resolve(asRoot(), menuPath, 'fr', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['English only']));
        // a label written in French only reads in English once French is the fallback
        gqlOk(asRoot(), 'query Q($path: String!) { menuManager { editableMenu(path: $path, language: "fr") { items { id } } } }', {path: menuPath})
            .its('menuManager.editableMenu.items.0.id').then(id => {
                saveMenuOk(menuPath, 'fr', [{id, kind: 'externalLink', url: 'https://example.org/only', label: 'Français seulement'}]);
                saveMenuOk(menuPath, 'en', [{id, kind: 'externalLink', url: 'https://example.org/only', label: null}]);
            });
        // no label in English nor in the fallback (English): the address
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['https://example.org/only']));
        gqlOk(asRoot(), 'mutation M($path: String!) { menuManager { updateMenu(path: $path, language: "en", fallbackLanguage: "fr") } }', {path: menuPath});
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['Français seulement']));
        gqlOk(asRoot(), 'mutation M($path: String!) { menuManager { updateMenu(path: $path, language: "en", fallbackLanguage: "") } }', {path: menuPath});
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['https://example.org/only']));
        gql(asRoot(), 'mutation M($path: String!) { menuManager { updateMenu(path: $path, language: "en", fallbackLanguage: "x!") } }', {path: menuPath})
            .its('errors.0.message').should('eq', 'Unknown language');
    });

    it('leaves out a section with nothing under it the visitor may see', () => {
        saveMenuOk(menuPath, 'en', [{kind: 'section', label: 'Empty'}, {kind: 'section', label: 'Full', children: [link('Inside')]}]);
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['Full', 'Full > Inside']));
        saveMenuOk(menuPath, 'en', [{kind: 'section', label: 'Hidden child', children: [link('Inside', {invalidLanguages: ['fr']})]}]);
        resolve(asRoot(), menuPath, 'fr', 'EDIT').then(items => expect(labels(items)).to.deep.eq([]));
    });

    it('hides an item in the languages it is switched off for', () => {
        saveMenuOk(menuPath, 'en', [link('Everywhere'), link('Not in French', {invalidLanguages: ['fr']})]);
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['Everywhere', 'Not in French']));
        resolve(asRoot(), menuPath, 'fr', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['Everywhere']));
    });

    it('returns as many levels as asked, and adds a page\'s subpages when told to', () => {
        uuidOf(home).then(homeUuid => {
            saveMenuOk(menuPath, 'en', [{kind: 'page', label: 'Home', page: homeUuid, includeSubpages: true}]);
        });
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['Home', 'Home > About us', 'Home > Contact']));
        resolve(asRoot(), menuPath, 'en', 'EDIT', 1).then(items => expect(labels(items)).to.deep.eq(['Home']));
    });

    it('keeps the target of a page item whose first item is a page item, once published (a node and a property of one name)', () => {
        // Regression: items were named after their kind, so a page item's first page item was a node named
        // "page" beside the item's own "page" property, and publication dropped the property in live
        uuidOf(`${home}/contact`).then(contact => {
            saveMenuOk(menuPath, 'en', [{kind: 'page', page: aboutUuid, children: [{kind: 'page', page: contact}]}]);
        });
        cy.then(() => publish(`/sites/${siteKey}`));
        resolve(null, menuPath, 'en', 'LIVE').then(items => expect(labels(items)).to.deep.eq(['About us', 'About us > Contact']));
    });

    it('leaves out a target that is deleted, or not published, in live only for the latter', () => {
        addNodeTree(home, {name: 'draft', type: 'jnt:page', props: [
            {name: 'jcr:title', value: 'Draft page', language: 'en'}, {name: 'j:templateName', value: 'content'}]}).then(draftUuid => {
            addNodeTree(home, {name: 'doomed', type: 'jnt:page', props: [
                {name: 'jcr:title', value: 'Doomed page', language: 'en'}, {name: 'j:templateName', value: 'content'}]}).then(doomedUuid => {
                saveMenuOk(menuPath, 'en', [
                    {kind: 'page', page: aboutUuid},
                    {kind: 'page', page: draftUuid},
                    {kind: 'page', page: doomedUuid}
                ]);
            });
        });
        cy.then(() => publish(menuPath));
        cy.then(() => publish(`${home}/about`));
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['About us', 'Draft page', 'Doomed page']));
        resolve(null, menuPath, 'en', 'LIVE').then(items => expect(labels(items)).to.deep.eq(['About us']));
        gqlOk(asRoot(), 'mutation D($path: String!) { jcr { deleteNode(pathOrId: $path) } }', {path: `${home}/doomed`});
        resolve(asRoot(), menuPath, 'en', 'EDIT').then(items => expect(labels(items)).to.deep.eq(['About us', 'Draft page']));
        gqlOk(asRoot(), 'query Q($path: String!) { menuManager { editableMenu(path: $path, language: "en") { items { target { available } } } } }', {path: menuPath})
            .its('menuManager.editableMenu.items').should('deep.eq', [{target: {available: true}}, {target: {available: true}}, {target: {available: false}}]);
    });
});
