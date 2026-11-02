import React from 'react';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@apollo/client';
import {Loader, Typography} from '@jahia/moonstone';
import {NS} from '../i18n';
import {RESOLVED_MENU} from './graphql';
import styles from './MenuManager.module.css';

interface Resolved {
    id: string;
    kind: string;
    label: string;
    style: string;
    children?: Resolved[];
}

const Entry = ({item}: {item: Resolved}): JSX.Element => {
    const cls = item.kind === 'section' ? styles.previewSection
        : item.style === 'button' ? styles.previewButton : item.style === 'highlight' ? styles.previewHighlight : undefined;
    return (
        <li>
            <span className={cls}>{item.label}</span>
            {item.children && item.children.length > 0 && <ul>{item.children.map(c => <Entry key={c.id} item={c}/>)}</ul>}
        </li>
    );
};

/** The saved menu as the server resolves it in the edited language: fallback applied, a neutral sketch. */
export const Preview = ({menu, language}: {menu: string; language: string}): JSX.Element => {
    const {t} = useTranslation(NS);
    const {data, loading} = useQuery(RESOLVED_MENU, {variables: {menu, language}, fetchPolicy: 'network-only'});
    const items: Resolved[] = data?.menuManager?.resolvedMenu?.items ?? [];
    return (
        <div className={styles.card} data-mnu-role="preview">
            <div className={styles.cardHead}>
                <Typography variant="heading" component="h2">{t('preview.title', {lang: language.toUpperCase().replace('_', '-')})}</Typography>
            </div>
            <Typography variant="caption" className={styles.muted}>{t('preview.help')}</Typography>
            {loading && !data ? <Loader size="small"/>
                : items.length === 0 ? <Typography className={styles.muted}>{t('preview.empty')}</Typography>
                    : <ul className={styles.preview} aria-label={t('preview.title', {lang: language})}>{items.map(i => <Entry key={i.id} item={i}/>)}</ul>}
        </div>
    );
};
