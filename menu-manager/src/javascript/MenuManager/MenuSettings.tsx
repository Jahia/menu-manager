import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Copy, Delete, Dropdown, Input, Typography} from '@jahia/moonstone';
import {NS} from '../i18n';
import styles from './MenuManager.module.css';

export interface Placement {
    page: string;
    path: string;
}

export interface MenuSettingsProps {
    title: string;
    fallbackLanguage: string | null;
    siteDefault: string;
    siteLanguages: string[];
    placements: Placement[];
    isLocked: boolean;
    onRename: (title: string) => void;
    onFallback: (language: string) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

const upper = (lang: string): string => lang.toUpperCase().replace('_', '-');

/** A menu's own settings, where it is placed, and the operations on the whole menu. */
const SITE_DEFAULT = 'site-default';

export const MenuSettings = ({title, fallbackLanguage, siteDefault, siteLanguages, placements, isLocked, onRename, onFallback,
                                 onDuplicate, onDelete}: MenuSettingsProps): JSX.Element => {
    const {t} = useTranslation(NS);
    // The field follows the saved title when it changes (a rename, another menu): set while rendering
    const [name, setName] = useState(title);
    const [shownTitle, setShownTitle] = useState(title);
    if (title !== shownTitle) {
        setShownTitle(title);
        setName(title);
    }
    // "Site default" is an option of its own: an empty value would draw it as Moonstone's grey placeholder
    // (3.8:1 on white). Not a language code (they hold no "-"), so it cannot meet a site language.
    const options = [{label: t('settings.fallbackDefault', {lang: upper(siteDefault)}), value: SITE_DEFAULT},
        ...siteLanguages.map(l => ({label: upper(l), value: l}))];
    const current = options.find(o => o.value === (fallbackLanguage || SITE_DEFAULT)) ?? options[0];
    return (
        <div className={styles.card} data-mnu-role="menu-settings">
            <Typography variant="heading" component="h2">{t('settings.title')}</Typography>
            <div>
                <label htmlFor="mnu-menu-name" className={styles.fieldLabel}><Typography weight="bold">{t('settings.name')}</Typography></label>
                <div className={styles.targetLine}>
                    <Input id="mnu-menu-name" value={name} onChange={e => setName(e.target.value)}/>
                    <Button variant="outlined" label={t('settings.apply')} isDisabled={!name.trim() || name.trim() === title || isLocked}
                            onClick={() => onRename(name.trim())}/>
                </div>
            </div>
            <div>
                <Typography weight="bold" className={styles.fieldLabel}>{t('settings.fallback')}</Typography>
                <Dropdown value={current.value} label={current.label} data={options} isDisabled={isLocked}
                          onChange={(_e, option) => onFallback(!option.value || option.value === SITE_DEFAULT ? '' : option.value)}/>
                <Typography variant="caption" className={styles.muted}>{t('settings.fallbackHelp')}</Typography>
            </div>
            <div>
                <Typography weight="bold" className={styles.fieldLabel}>{t('settings.placedOn')}</Typography>
                {placements.length === 0
                    ? <Typography variant="caption" className={styles.muted}>{t('settings.notPlaced')}</Typography>
                    : (
                        <ul className={styles.placements}>
                            {placements.map(p => (
                                <li key={p.path}><Typography>{p.page}</Typography> <Typography variant="caption" className={styles.muted}>{p.path}</Typography></li>
                            ))}
                        </ul>
                    )}
            </div>
            <div className={styles.dangerZone}>
                <Button variant="outlined" icon={<Copy/>} label={t('settings.duplicate')} isDisabled={isLocked} onClick={onDuplicate}/>
                <Button variant="outlined" icon={<Delete/>} label={t('settings.delete')} isDisabled={isLocked} onClick={onDelete}/>
            </div>
        </div>
    );
};
