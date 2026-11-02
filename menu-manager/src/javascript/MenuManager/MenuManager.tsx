import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useApolloClient, useMutation, useQuery} from '@apollo/client';
import {useSelector} from 'react-redux';
import {useNotifications} from '@jahia/react-material';
import {
    Add,
    Banner,
    Button,
    Chip,
    Dropdown,
    Header,
    Input,
    LayoutContent,
    Loader,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Publish,
    Save,
    Tooltip,
    Typography,
    Undo
} from '@jahia/moonstone';
import {NS} from '../i18n';
import {AddItems} from './AddItems';
import {MenuSettings, Placement} from './MenuSettings';
import {MenuTree} from './MenuTree';
import {Preview} from './Preview';
import {CREATE_MENU, DELETE_MENU, DUPLICATE_MENU, EDITABLE_MENU, MENUS, NODE_BY_PATH, PUBLISH, SAVE_MENU, UPDATE_MENU} from './graphql';
import {count, find, fromServer, Item, Kind, problems, Target, toSaveTree, update} from './tree';
import styles from './MenuManager.module.css';

interface MenuSummary {
    uuid: string;
    path: string;
    title: string;
    itemCount: number;
}

interface Ancestor {
    path: string;
    displayName: string;
    primaryNodeType: {name: string};
}

const upper = (lang: string): string => lang.toUpperCase().replace('_', '-');

/** The error code the server answered (MenuException codes), or "generic". */
const codeOf = (error: unknown): string => {
    const message = (error as {graphQLErrors?: {message: string}[]})?.graphQLErrors?.[0]?.message ?? '';
    return /^[a-zA-Z]+$/.test(message) ? message : 'generic';
};

/** The content picker's type for what is being chosen. */
const pickerType = (kind: Kind | 'image'): string => {
    if (kind === 'page' || kind === 'image') {
        return kind;
    }
    return 'editoriallink';
};

const STATUSES = new Set(['PUBLISHED', 'MODIFIED', 'NOT_PUBLISHED']);

/** The header's chip: unsaved changes first, else the menu's publication status. */
const StatusChip = ({dirty, status}: {dirty: boolean; status?: string}): JSX.Element | null => {
    const {t} = useTranslation(NS);
    if (dirty) {
        return <Chip label={t('status.unsaved')} color="warning"/>;
    }
    if (!status) {
        return null;
    }
    let color: 'success' | 'warning' | 'default' = 'default';
    if (status === 'PUBLISHED') {
        color = 'success';
    } else if (status === 'MODIFIED') {
        color = 'warning';
    }
    return <Chip label={t(`status.${STATUSES.has(status) ? status : 'other'}`)} color={color}/>;
};

interface MenuHeaderProps {
    list: MenuSummary[];
    menuPath: string | null;
    onMenu: (path: string) => void;
    /** The languages to switch between; empty when no menu is open. */
    languages: string[];
    language: string;
    onLanguage: (language: string) => void;
    dirty: boolean;
    busy: boolean;
    hasMenu: boolean;
    canPublish: boolean;
    status?: string;
    onNew: () => void;
    onDiscard: () => void;
    onPublish: () => void;
    onSave: () => void;
}

/**
 * The screen's header: the menu and language switches (locked while changes are unsaved), New
 * menu, and Discard, Publish and Save.
 */
const MenuHeader = ({list, menuPath, onMenu, languages, language, onLanguage, dirty, busy, hasMenu, canPublish, status,
                        onNew, onDiscard, onPublish, onSave}: MenuHeaderProps): JSX.Element => {
    const {t} = useTranslation(NS);
    const locked = (control: JSX.Element): JSX.Element => (dirty
        ? <Tooltip label={t('header.lockedWhileDirty')}><span style={{display: 'inline-flex'}}>{control}</span></Tooltip> : control);
    const menuOptions = list.map(m => ({label: m.title, value: m.path}));
    const currentMenu = menuOptions.find(o => o.value === menuPath);
    const actions = [
        dirty && <Button key="discard" variant="ghost" icon={<Undo/>} label={t('header.discard')} isDisabled={busy} onClick={onDiscard}/>,
        hasMenu && <Button key="publish" size="big" variant="outlined" icon={<Publish/>} label={t('header.publish')}
                           isDisabled={dirty || busy || !canPublish} onClick={onPublish}/>,
        hasMenu && <Button key="save" size="big" color="accent" icon={<Save/>} label={t('header.save')}
                           isDisabled={!dirty || busy} isLoading={busy && dirty} onClick={onSave}/>
    ].filter(Boolean);
    return (
        <Header
            title={t('title')}
            status={<StatusChip dirty={dirty} status={status}/>}
            toolbarLeft={(
                <div className={styles.toolbar}>
                    {list.length > 0 && locked(
                        <Dropdown
                            label={currentMenu?.label ?? t('header.menu')}
                            value={menuPath ?? ''}
                            data={menuOptions}
                            isDisabled={dirty || busy}
                            onChange={(_e, o) => o.value && onMenu(o.value)}
                        />
                    )}
                    {languages.length > 1 && locked(
                        <Dropdown
                            label={upper(language)}
                            value={language}
                            data={languages.map(l => ({label: upper(l), value: l}))}
                            isDisabled={dirty || busy}
                            onChange={(_e, o) => o.value && onLanguage(o.value)}
                        />
                    )}
                    <Button variant="ghost" icon={<Add/>} label={t('header.newMenu')} isDisabled={dirty || busy} onClick={onNew}/>
                </div>
            )}
            mainActions={actions}
        />
    );
};

/**
 * jContent > Menus: the site's menus, edited in one content language at a time. Changes stay in the
 * page until Save, which sends the whole tree in one call; a menu or a language cannot be switched
 * with unsaved changes. Publish publishes the menu in every language of the site.
 */
export const MenuManager = ({siteKey}: {siteKey: string}): JSX.Element => {
    const {t} = useTranslation(NS);
    const client = useApolloClient();
    const contentLanguage: string = useSelector((state: {language: string}) => state.language);
    const [language, setLanguage] = useState(contentLanguage);
    // The menu chosen in the header, else the site's first one
    const [chosenPath, setChosenPath] = useState<string | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [revision, setRevision] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState<{message: string; action: () => void} | null>(null);
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    const menus = useQuery(MENUS, {variables: {siteKey, language}, fetchPolicy: 'network-only'});
    const list: MenuSummary[] = menus.data?.menuManager?.menus ?? [];
    const menuPath = chosenPath ?? list[0]?.path ?? null;

    const editable = useQuery(EDITABLE_MENU, {variables: {path: menuPath, language}, skip: !menuPath, fetchPolicy: 'network-only'});
    const menu = editable.data?.menuManager?.editableMenu;
    const node = editable.data?.jcr?.nodeByPath;
    // Each copy the server answers (opening, saving, a language, a refresh) replaces the edited tree:
    // set while rendering, as React advises for state that follows a prop, not in an effect
    const [loaded, setLoaded] = useState<unknown>(null);
    if (menu && menu !== loaded) {
        setLoaded(menu);
        setItems(fromServer(menu.items));
        setRevision(menu.revision);
        setDirty(false);
    }

    // Leaving the page with unsaved changes asks first.
    useEffect(() => {
        const warn = (e: BeforeUnloadEvent): void => {
            if (dirty) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const [saveMenu] = useMutation(SAVE_MENU);
    const [publish] = useMutation(PUBLISH);
    const [createMenu] = useMutation(CREATE_MENU);
    const [updateMenu] = useMutation(UPDATE_MENU);
    const [duplicateMenu] = useMutation(DUPLICATE_MENU);
    const [deleteMenu] = useMutation(DELETE_MENU);

    // jContent's own notifications (jContent 3.8 has no window.jahia.toastDispatcher)
    const notifications = useNotifications() as {notify?: (message: string, options?: string[]) => void} | undefined;
    const toast = (key: string): void => notifications?.notify?.(t(`toast.${key}`), ['closeButton']);

    const change = useCallback((next: Item[]): void => {
        setItems(next);
        setDirty(true);
        setError(null);
    }, []);

    const refresh = async (): Promise<void> => {
        await Promise.all([menus.refetch(), editable.refetch()]);
        setVersion(v => v + 1);
    };

    const run = async (action: () => Promise<void>): Promise<void> => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (e) {
            setError(codeOf(e));
        } finally {
            setBusy(false);
        }
    };

    const onSave = (): Promise<void> => run(async () => {
        const found = problems(items);
        if (found.length) {
            setError(found[0]);
            return;
        }
        const {data} = await saveMenu({variables: {path: menuPath, language, revision, tree: JSON.stringify(toSaveTree(items))}});
        setRevision(data.menuManager.saveMenu.revision);
        setDirty(false);
        toast('saved');
        await refresh();
    });

    const languages: string[] = menu?.siteLanguages ?? [language];

    const onPublish = (): Promise<void> => run(async () => {
        await publish({variables: {path: menuPath, languages, subtree: true}});
        toast('published');
        await refresh();
    });

    const onCreate = (): Promise<void> => run(async () => {
        const {data} = await createMenu({variables: {siteKey, title: newTitle.trim(), language}});
        setCreating(false);
        setNewTitle('');
        toast('created');
        await menus.refetch();
        setChosenPath(data.menuManager.createMenu.path);
    });

    const onRename = (title: string): Promise<void> => run(async () => {
        await updateMenu({variables: {path: menuPath, language, title}});
        await refresh();
    });

    const onFallback = (fallbackLanguage: string): Promise<void> => run(async () => {
        await updateMenu({variables: {path: menuPath, language, fallbackLanguage}});
        await refresh();
    });

    const onDuplicate = (): Promise<void> => run(async () => {
        const title = t('settings.duplicateTitle', {title: menu?.title ?? menu?.fallbackTitle ?? ''});
        const {data} = await duplicateMenu({variables: {path: menuPath, title, language}});
        toast('duplicated');
        await menus.refetch();
        setChosenPath(data.menuManager.duplicateMenu.path);
    });

    const onDelete = (): void => setConfirm({
        message: t('settings.deleteConfirm', {title: menu?.title ?? menu?.fallbackTitle ?? ''}),
        action: () => run(async () => {
            const container = menuPath.slice(0, menuPath.lastIndexOf('/'));
            await deleteMenu({variables: {path: menuPath}});
            if (node?.canPublish) {
                // the container alone: its deleted child goes from live, other menus' changes stay
                await publish({variables: {path: container, languages, subtree: false}});
            }
            toast('deleted');
            setChosenPath(null);
            await menus.refetch();
        })
    });

    /** Jahia's content picker, then the chosen node's identifier and title in the edited language. */
    const pickContent = (kind: Kind | 'image', onPicked: (target: Target) => void): void => {
        globalThis.CE_API?.openPicker?.({
            type: pickerType(kind),
            isMultiple: false,
            site: siteKey,
            lang: language,
            initialSelectedItem: [],
            setValue: async (selected: {path?: string}[]) => {
                const path = selected?.[0]?.path;
                if (!path) {
                    return;
                }
                const {data} = await client.query({query: NODE_BY_PATH, variables: {path, language}, fetchPolicy: 'network-only'});
                const n = data?.jcr?.nodeByPath;
                if (n) {
                    onPicked({uuid: n.uuid, path: n.path, title: n.displayName, nodeType: n.primaryNodeType.name, available: true, inLive: true});
                }
            }
        });
    };

    const onPickPromo = (key: string, field: 'image' | 'target'): void =>
        pickContent(field === 'image' ? 'image' : 'internalLink', picked => setItems(current => {
            const item = find(current, key);
            setDirty(true);
            return item ? update(current, key, {promo: {...item.promo, [field]: picked}}) : current;
        }));

    const onPickTarget = (key: string, kind: Kind): void =>
        pickContent(kind === 'page' ? 'page' : 'internalLink', target => change(update(items, key, {target})));

    const placements: Placement[] = useMemo(() => (node?.references?.nodes ?? [])
        .map((r: {node: {path: string; displayName: string; ancestors: Ancestor[]}}) => {
            const page = [...(r.node.ancestors ?? [])].reverse().find(a => a.primaryNodeType.name === 'jnt:page');
            return {page: page?.displayName ?? r.node.displayName, path: r.node.path};
        }), [node]);

    const onDiscard = (): void => {
        if (menu) {
            setItems(fromServer(menu.items));
            setDirty(false);
            setError(null);
        }
    };

    const header = (
        <MenuHeader
            list={list}
            menuPath={menuPath}
            onMenu={setChosenPath}
            languages={menu ? languages : []}
            language={language}
            onLanguage={setLanguage}
            dirty={dirty}
            busy={busy}
            hasMenu={Boolean(menu)}
            canPublish={Boolean(node?.canPublish)}
            status={node?.publication?.publicationStatus}
            onNew={() => setCreating(true)}
            onDiscard={onDiscard}
            onPublish={onPublish}
            onSave={onSave}
        />
    );

    let structure: JSX.Element;
    if (editable.loading && !menu) {
        structure = <Loader size="big"/>;
    } else if (items.length === 0) {
        structure = <div className={styles.empty}>{t('empty.menu')}</div>;
    } else {
        structure = (
            <MenuTree
                items={items}
                onChange={change}
                language={language}
                fallbackLanguage={menu?.effectiveFallbackLanguage ?? language}
                siteLanguages={languages}
                onPickTarget={onPickTarget}
                onPickPromo={onPickPromo}
                onConfirm={(message, action) => setConfirm({message, action})}
            />
        );
    }

    let content: JSX.Element;
    if (menus.loading && !menus.data) {
        content = <Loader size="big"/>;
    } else if (list.length === 0) {
        content = (
            <div className={styles.card} data-mnu-role="no-menu">
                <Typography variant="heading" component="h2">{t('empty.title')}</Typography>
                <Typography>{t('empty.text')}</Typography>
                <div><Button color="accent" icon={<Add/>} label={t('empty.create')} onClick={() => setCreating(true)}/></div>
            </div>
        );
    } else {
        content = (
            <div className={styles.content}>
                <div className={styles.column}>
                    <AddItems siteKey={siteKey} language={language} pickContent={pickContent} onAdd={added => change([...items, ...added])}/>
                </div>
                <div className={styles.column}>
                    {error && (
                        <Banner variant="danger" title={t(`error.${error}`, {defaultValue: t('error.generic')})}>
                            {error === 'conflict' ? <Button variant="outlined" label={t('error.reload')} onClick={() => refresh()}/> : <span/>}
                        </Banner>
                    )}
                    <div className={styles.card} data-mnu-role="structure">
                        <div className={styles.cardHead}>
                            <Typography variant="heading" component="h2">{t('structure.title')}</Typography>
                            <Typography variant="caption" className={styles.muted}>{t('structure.items', {count: count(items)})}</Typography>
                        </div>
                        <Typography variant="caption" className={styles.muted}>{t('structure.help')}</Typography>
                        {structure}
                    </div>
                    {menu && <Preview key={`${menu.uuid}-${language}-${version}`} menu={menu.uuid} language={language}/>}
                    {menu && (
                        <MenuSettings
                            title={menu.title ?? menu.fallbackTitle ?? ''}
                            fallbackLanguage={menu.fallbackLanguage}
                            siteDefault={menu.siteLanguages[0]}
                            siteLanguages={languages}
                            placements={placements}
                            isLocked={dirty || busy}
                            onRename={onRename}
                            onFallback={onFallback}
                            onDuplicate={onDuplicate}
                            onDelete={onDelete}
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.root} data-mnu-role="menu-manager">
            <LayoutContent hasPadding header={header}>{content}</LayoutContent>
            <Modal isOpen={creating} size="small" onOpenChange={open => !open && setCreating(false)}>
                <>
                    <ModalHeader title={t('newMenu.title')}/>
                    <ModalBody>
                        <label htmlFor="mnu-new-menu" className={styles.fieldLabel}><Typography weight="bold">{t('newMenu.name')}</Typography></label>
                        <Input id="mnu-new-menu" value={newTitle} placeholder={t('newMenu.placeholder')} onChange={e => setNewTitle(e.target.value)}/>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" label={t('newMenu.cancel')} onClick={() => setCreating(false)}/>
                        <Button color="accent" label={t('newMenu.create')} isDisabled={!newTitle.trim() || busy} onClick={onCreate}/>
                    </ModalFooter>
                </>
            </Modal>
            <Modal isOpen={confirm !== null} size="small" onOpenChange={open => !open && setConfirm(null)}>
                <>
                    <ModalHeader title={t('confirm.title')}/>
                    <ModalBody><Typography>{confirm?.message}</Typography></ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" label={t('confirm.cancel')} onClick={() => setConfirm(null)}/>
                        <Button color="danger" label={t('confirm.ok')} onClick={() => {
                            const action = confirm?.action;
                            setConfirm(null);
                            action?.();
                        }}/>
                    </ModalFooter>
                </>
            </Modal>
        </div>
    );
};
