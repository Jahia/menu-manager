import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useApolloClient, useMutation, useQuery} from '@apollo/client';
import {useSelector} from 'react-redux';
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
    const [menuPath, setMenuPath] = useState<string | null>(null);
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
    useEffect(() => {
        if (!menuPath && list.length > 0) {
            setMenuPath(list[0].path);
        }
    }, [list, menuPath]);

    const editable = useQuery(EDITABLE_MENU, {variables: {path: menuPath, language}, skip: !menuPath, fetchPolicy: 'network-only'});
    const menu = editable.data?.menuManager?.editableMenu;
    const node = editable.data?.jcr?.nodeByPath;
    useEffect(() => {
        if (menu) {
            setItems(fromServer(menu.items));
            setRevision(menu.revision);
            setDirty(false);
        }
    }, [menu]);

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

    const toast = (key: string): void => window.jahia?.toastDispatcher?.add({message: t(`toast.${key}`), variant: 'success'});

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
        setMenuPath(data.menuManager.createMenu.path);
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
        setMenuPath(data.menuManager.duplicateMenu.path);
    });

    const onDelete = (): void => setConfirm({
        message: t('settings.deleteConfirm', {title: menu?.title ?? menu?.fallbackTitle ?? ''}),
        action: () => run(async () => {
            const container = menuPath!.slice(0, menuPath!.lastIndexOf('/'));
            await deleteMenu({variables: {path: menuPath}});
            if (node?.canPublish) {
                // the container alone: its deleted child goes from live, other menus' changes stay
                await publish({variables: {path: container, languages, subtree: false}});
            }
            toast('deleted');
            setMenuPath(null);
            await menus.refetch();
        })
    });

    /** Jahia's content picker, then the chosen node's identifier and title in the edited language. */
    const pickContent = (kind: Kind | 'image', onPicked: (target: Target) => void): void => {
        window.CE_API?.openPicker?.({
            type: kind === 'page' ? 'page' : kind === 'image' ? 'image' : 'editoriallink',
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

    const status: string | undefined = node?.publication?.publicationStatus;
    const statusChip = dirty ? <Chip label={t('status.unsaved')} color="warning"/>
        : status ? <Chip label={t(`status.${['PUBLISHED', 'MODIFIED', 'NOT_PUBLISHED'].includes(status) ? status : 'other'}`)}
                         color={status === 'PUBLISHED' ? 'success' : status === 'MODIFIED' ? 'warning' : 'default'}/> : null;

    const locked = (control: JSX.Element): JSX.Element => (dirty
        ? <Tooltip label={t('header.lockedWhileDirty')}><span style={{display: 'inline-flex'}}>{control}</span></Tooltip> : control);

    const menuOptions = list.map(m => ({label: m.title, value: m.path}));
    const currentMenu = menuOptions.find(o => o.value === menuPath);
    const languageOptions = languages.map(l => ({label: upper(l), value: l}));

    const header = (
        <Header
            title={t('title')}
            status={statusChip}
            toolbarLeft={(
                <div className={styles.toolbar}>
                    {list.length > 0 && locked(
                        <Dropdown
                            label={currentMenu?.label ?? t('header.menu')}
                            value={menuPath ?? ''}
                            data={menuOptions}
                            isDisabled={dirty || busy}
                            onChange={(_e, o) => o.value && setMenuPath(o.value)}
                        />
                    )}
                    {menu && languages.length > 1 && locked(
                        <Dropdown
                            label={upper(language)}
                            value={language}
                            data={languageOptions}
                            isDisabled={dirty || busy}
                            onChange={(_e, o) => o.value && setLanguage(o.value)}
                        />
                    )}
                    <Button variant="ghost" icon={<Add/>} label={t('header.newMenu')} isDisabled={dirty || busy} onClick={() => setCreating(true)}/>
                </div>
            )}
            mainActions={[
                dirty && <Button key="discard" variant="ghost" icon={<Undo/>} label={t('header.discard')} isDisabled={busy}
                                 onClick={() => menu && (setItems(fromServer(menu.items)), setDirty(false), setError(null))}/>,
                menu && <Button key="publish" size="big" variant="outlined" icon={<Publish/>} label={t('header.publish')}
                                isDisabled={dirty || busy || !node?.canPublish} onClick={onPublish}/>,
                menu && <Button key="save" size="big" color="accent" icon={<Save/>} label={t('header.save')}
                                isDisabled={!dirty || busy} isLoading={busy && dirty} onClick={onSave}/>
            ].filter(Boolean)}
        />
    );

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
                        {editable.loading && !menu ? <Loader size="big"/>
                            : items.length === 0 ? <div className={styles.empty}>{t('empty.menu')}</div>
                                : (
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
                                )}
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
