import React, {ComponentType, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@apollo/client';
import {Accordion, AccordionItem, Button, Input, Link, OpenInNew, Page, Text, Typography} from '@jahia/moonstone';
import {registry} from '@jahia/ui-extender';
import {NS} from '../i18n';
import {PAGES} from './graphql';
import {Item, newKey, NO_PROMO, Target, URL_OK} from './tree';
import styles from './MenuManager.module.css';

export interface AddItemsProps {
    siteKey: string;
    language: string;
    onAdd: (items: Item[]) => void;
    pickContent: (kind: 'page' | 'internalLink', onPicked: (target: Target) => void) => void;
}

interface PageNode {
    uuid: string;
    path: string;
    displayName: string;
}

const blank = (kind: Item['kind'], patch: Partial<Item>): Item => ({
    key: newKey(), kind, label: '', description: '', style: 'default', includeSubpages: false, newTab: false, url: '',
    invalidLanguages: [], target: null, promo: NO_PROMO, children: [], ...patch
});

/**
 * The left column, as WordPress has it: one panel per kind of item, each adding at the end of the
 * menu. Pages are chosen in the site's page tree with jContent's ChoiceTree; a section is a heading; an internal
 * link is any content, chosen with jContent's picker; an external link is an address.
 */
export const AddItems = ({siteKey, language, onAdd, pickContent}: AddItemsProps): JSX.Element => {
    const {t} = useTranslation(NS);
    const [open, setOpen] = useState('pages');
    return (
        <div className={styles.card} data-mnu-role="add-items">
            <Typography variant="heading" component="h2">{t('add.title')}</Typography>
            <Accordion openedItem={open} onSetOpenedItem={setOpen}>
                <AccordionItem id="pages" label={t('add.pages')} icon={<Page/>}>
                    <PagesPanel siteKey={siteKey} language={language} onAdd={onAdd}/>
                </AccordionItem>
                <AccordionItem id="section" label={t('add.section')} icon={<Text/>}>
                    <SectionPanel onAdd={onAdd}/>
                </AccordionItem>
                <AccordionItem id="internal" label={t('add.internal')} icon={<Link/>}>
                    <InternalPanel onAdd={onAdd} pickContent={pickContent}/>
                </AccordionItem>
                <AccordionItem id="external" label={t('add.external')} icon={<OpenInNew/>}>
                    <ExternalPanel onAdd={onAdd}/>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

/** The props jContent's ChoiceTree selector takes (Content Editor selector type contract). */
interface ChoiceTreeProps {
    id: string;
    field: {name: string; multiple: boolean; readOnly: boolean; selectorOptions: {name: string; value: string}[]};
    value: string[];
    editorContext: {site: string; lang: string};
    onChange: (value: string[] | null) => void;
    onBlur: () => void;
}

/**
 * Pages are chosen with jContent's own ChoiceTree selector (the one behind categories): a searchable
 * dropdown of the site's page tree, several pages at once. It is read from the Content Editor registry,
 * where jContent registers it, so the screen shows what editors know from the content forms.
 */
const PagesPanel = ({siteKey, language, onAdd}: {siteKey: string; language: string; onAdd: (items: Item[]) => void}): JSX.Element => {
    const {t} = useTranslation(NS);
    const home = `/sites/${siteKey}/home`;
    const {data} = useQuery(PAGES, {variables: {path: home, language}, fetchPolicy: 'cache-and-network'});
    const [selected, setSelected] = useState<string[]>([]);
    const ChoiceTree = (registry.get('selectorType', 'ChoiceTree') as {cmp?: ComponentType<ChoiceTreeProps>} | undefined)?.cmp;
    const field = useMemo(() => ({
        name: 'mnu-pages',
        multiple: true,
        readOnly: false,
        selectorOptions: [{name: 'rootPath', value: '/sites/{site}'}, {name: 'types', value: 'jnt:page'}]
    }), []);
    // In the order of the site's page tree, with what a menu item shows of its page
    const pages: PageNode[] = useMemo(() => {
        const root = data?.jcr?.nodeByPath;
        return root ? [root, ...root.descendants.nodes] : [];
    }, [data]);

    const add = (): void => {
        onAdd(pages.filter(p => selected.includes(p.uuid)).map(p => blank('page', {
            target: {uuid: p.uuid, path: p.path, title: p.displayName, nodeType: 'jnt:page', available: true, inLive: true}
        })));
        setSelected([]);
    };

    return (
        <div className={styles.panelBody}>
            <Typography variant="caption" className={styles.muted}>{t('add.pagesHelp')}</Typography>
            {ChoiceTree ? (
                <div data-mnu-role="page-choice">
                    <ChoiceTree
                        id="mnu-add-pages"
                        field={field}
                        value={selected}
                        editorContext={{site: siteKey, lang: language}}
                        onChange={value => setSelected(value ?? [])}
                        onBlur={() => undefined}
                    />
                </div>
            ) : <Typography className={styles.muted}>{t('add.noChoiceTree')}</Typography>}
            <div className={styles.actionsRow}>
                <Button color="accent" label={selected.length ? t('add.addSelected', {count: selected.length}) : t('add.add')}
                        isDisabled={selected.length === 0 || pages.length === 0} onClick={add}/>
            </div>
        </div>
    );
};

const SectionPanel = ({onAdd}: {onAdd: (items: Item[]) => void}): JSX.Element => {
    const {t} = useTranslation(NS);
    const [label, setLabel] = useState('');
    return (
        <div className={styles.panelBody}>
            <Typography variant="caption" className={styles.muted}>{t('add.sectionHelp')}</Typography>
            <label htmlFor="mnu-add-section" className={styles.fieldLabel}><Typography weight="bold">{t('add.sectionLabel')}</Typography></label>
            <Input id="mnu-add-section" value={label} onChange={e => setLabel(e.target.value)}/>
            <div className={styles.actionsRow}>
                <Button color="accent" label={t('add.add')} isDisabled={!label.trim()} onClick={() => {
                    onAdd([blank('section', {label: label.trim()})]);
                    setLabel('');
                }}/>
            </div>
        </div>
    );
};

const InternalPanel = ({onAdd, pickContent}: {onAdd: (items: Item[]) => void; pickContent: AddItemsProps['pickContent']}): JSX.Element => {
    const {t} = useTranslation(NS);
    const [target, setTarget] = useState<Target | null>(null);
    const [label, setLabel] = useState('');
    return (
        <div className={styles.panelBody}>
            <Typography variant="caption" className={styles.muted}>{t('add.internalHelp')}</Typography>
            <div className={styles.targetLine}>
                <Button variant="outlined" label={t('add.choose')} onClick={() => pickContent('internalLink', setTarget)}/>
                {target && <Typography title={target.path ?? ''}>{target.title}</Typography>}
            </div>
            <label htmlFor="mnu-add-internal" className={styles.fieldLabel}><Typography weight="bold">{t('add.linkLabel')}</Typography></label>
            <Input id="mnu-add-internal" value={label} placeholder={target?.title ?? ''} onChange={e => setLabel(e.target.value)}/>
            <div className={styles.actionsRow}>
                <Button color="accent" label={t('add.add')} isDisabled={!target} onClick={() => {
                    onAdd([blank('internalLink', {target, label: label.trim()})]);
                    setTarget(null);
                    setLabel('');
                }}/>
            </div>
        </div>
    );
};

const ExternalPanel = ({onAdd}: {onAdd: (items: Item[]) => void}): JSX.Element => {
    const {t} = useTranslation(NS);
    const [url, setUrl] = useState('https://');
    const [label, setLabel] = useState('');
    const valid = URL_OK.test(url.trim());
    return (
        <div className={styles.panelBody}>
            <Typography variant="caption" className={styles.muted}>{t('add.externalHelp')}</Typography>
            <label htmlFor="mnu-add-url" className={styles.fieldLabel}><Typography weight="bold">{t('add.url')}</Typography></label>
            <Input id="mnu-add-url" value={url} onChange={e => setUrl(e.target.value)}/>
            <label htmlFor="mnu-add-external" className={styles.fieldLabel}><Typography weight="bold">{t('add.linkLabel')}</Typography></label>
            <Input id="mnu-add-external" value={label} onChange={e => setLabel(e.target.value)}/>
            <div className={styles.actionsRow}>
                <Button color="accent" label={t('add.add')} isDisabled={!valid} onClick={() => {
                    onAdd([blank('externalLink', {url: url.trim(), label: label.trim()})]);
                    setUrl('https://');
                    setLabel('');
                }}/>
            </div>
        </div>
    );
};
