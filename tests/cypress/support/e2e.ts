// @jahia/cypress publishes through cy.waitUntil, which registerSupport() does not load.
import 'cypress-wait-until';
import 'cypress-axe';
import {registerSupport} from '@jahia/cypress/dist/support/registerSupport';
import {asRoot, gql, signOut} from './menus';

registerSupport();

// Apollo (behind the @jahia/cypress helpers) calls fetch unbound.
if (typeof window !== 'undefined' && window.fetch) {
    globalThis.fetch = window.fetch.bind(window);
}

/**
 * Run-level guard: the specs read answers of the menuManager fields. When the module is not deployed
 * the field does not exist and a spec asserting a refusal would pass for that reason, so the run checks
 * once, as root, that the field answers and refuses a site that does not exist with the module's own
 * message.
 */
before(() => {
    gql(asRoot(), 'query { menuManager { menus(siteKey: "mnu-module-probe", language: "en") { uuid } } }').then(body => {
        expect(body.errors?.[0]?.message, 'menu-manager answers').to.eq('Permission denied');
        expect(body.errors?.[0]?.path).to.deep.eq(['menuManager', 'menus']);
    });
    signOut();
});

// The calls of a test share one server session, which holds a licence seat until it is signed out.
afterEach(() => {
    signOut();
});
