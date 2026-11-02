import React, {lazy, Suspense} from 'react';
import i18next from 'i18next';
import {registry} from '@jahia/ui-extender';
import {Header, LayoutContent, Loader} from '@jahia/moonstone';
import {useSelector} from 'react-redux';
import {MODULE, NS} from './i18n';

// What jContent loads when it starts is this registration: the Menus screen loads the first time it
// is opened, and only the editor's language file is loaded (every file holds every key).
const LOCALES: Record<string, () => Promise<{default?: Record<string, unknown>}>> = {
    en: () => import('../main/resources/javascript/locales/en.json'),
    fr: () => import('../main/resources/javascript/locales/fr.json')
};

const MenuManager = lazy(() => import('./MenuManager/MenuManager').then(m => ({default: m.MenuManager})));

// A tree of three linked boxes (filled, as Moonstone's own icons are): menus are trees of items.
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z"/></svg>';

const uiLanguage = (): string => {
    const lang = (i18next.language || window.contextJsParameters?.uilang || 'en').slice(0, 2).toLowerCase();
    return LOCALES[lang] ? lang : 'en';
};

const registerTranslations = async (): Promise<void> => {
    const lang = uiLanguage();
    if (!i18next.hasResourceBundle(lang, NS)) {
        const module = await LOCALES[lang]();
        const resource = (module.default || module) as Record<string, unknown>;
        i18next.addResourceBundle(lang, NS, resource[NS], true, true);
    }
};

/** jContent gates the app (permission, module enabled); the screen remounts with fresh state per site. */
const MenuManagerRoute = (): JSX.Element => {
    const siteKey: string = useSelector((state: {site: string}) => state.site);
    const title = i18next.t(`${NS}:title`);
    return (
        <Suspense fallback={<LayoutContent hasPadding header={<Header title={title}/>}><Loader size="big"/></LayoutContent>}>
            <MenuManager key={siteKey} siteKey={siteKey}/>
        </Suspense>
    );
};

export default async function register(): Promise<void> {
    await registerTranslations();
    const toIcon = window.jahia?.moonstone?.toIconComponent;
    registry.add('adminRoute', 'menuManager', {
        targets: ['jcontent:85'],
        label: `${NS}:title`,
        icon: toIcon ? toIcon(ICON) : undefined,
        isSelectable: true,
        requiredPermission: 'manageMenus',
        requireModuleInstalledOnSite: MODULE,
        render: () => <MenuManagerRoute/>
    });
}
