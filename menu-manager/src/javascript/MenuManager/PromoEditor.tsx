import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Close, Delete, Input, Switch, Textarea, Typography} from '@jahia/moonstone';
import {NS} from '../i18n';
import {Item, NO_PROMO, Promo, Target} from './tree';
import styles from './MenuManager.module.css';

export interface PromoEditorProps {
    item: Item;
    fallbackLanguage: string;
    onPatch: (patch: Partial<Promo>) => void;
    onPick: (field: 'image' | 'target') => void;
}

const upper = (lang: string): string => lang.toUpperCase().replace('_', '-');

const hasPromo = (promo: Promo): boolean =>
    Boolean(promo.title || promo.fallbackTitle || promo.text || promo.linkLabel || promo.image || promo.target || promo.url);

/**
 * Jahia's resized copy of an image, through the files servlet in the editing workspace, under the
 * context path ("thumbnail2": about 350 pixels).
 */
const thumbnailUrl = (image: Target): string | undefined => image.path
    ? `${globalThis.contextJsParameters?.contextPath || ''}/files/default${image.path.split('/').map(encodeURIComponent).join('/')}?t=thumbnail2`
    : undefined;

/**
 * A top-level item's promotion, shown by mega menus beside its columns. A switch turns it on; off,
 * the item has none of its own (a page item then shows its page's promotion, if any), and turning it
 * off clears the fields (Discard brings them back until the menu is saved). On the left the image,
 * as a thumbnail; on the right the texts and where the button goes.
 */
export const PromoEditor = ({item, fallbackLanguage, onPatch, onPick}: PromoEditorProps): JSX.Element => {
    const {t} = useTranslation(NS);
    const {promo} = item;
    const [open, setOpen] = useState(() => hasPromo(promo));
    const id = (field: string): string => `mnu-${item.key}-promo-${field}`;
    const thumb = promo.image?.available ? thumbnailUrl(promo.image) : undefined;

    const toggle = (checked: boolean): void => {
        setOpen(checked);
        if (!checked) {
            onPatch({...NO_PROMO, fallbackTitle: promo.fallbackTitle});
        }
    };

    return (
        <section className={`${styles.editorWide} ${styles.promo}`} aria-labelledby={id('heading')} data-mnu-role="promotion">
            <div className={styles.promoHead}>
                <label className={styles.promoSwitch}>
                    <Switch checked={open} onChange={(_e, _v, checked) => toggle(checked)}/>
                    <Typography id={id('heading')} weight="bold">{t('editor.promo.toggle')}</Typography>
                </label>
                <Typography variant="caption" className={styles.muted}>{open ? t('editor.promo.help') : t('editor.promo.offHelp')}</Typography>
            </div>
            {open && (
                <div className={styles.promoBody}>
                    <div className={styles.promoMediaCol}>
                        <div className={styles.promoThumb} data-empty={!thumb}>
                            {thumb ? <img src={thumb} alt="" loading="lazy"/>
                                : <Typography variant="caption" className={styles.muted}>
                                    {promo.image && !promo.image.available ? t('editor.promo.unavailable') : t('editor.promo.noImage')}
                                </Typography>}
                        </div>
                        {promo.image?.title && <Typography variant="caption" className={styles.promoFileName} title={promo.image.path ?? ''}>{promo.image.title}</Typography>}
                        <div className={styles.promoActions}>
                            <Button size="small" variant="outlined" label={promo.image ? t('editor.promo.changeImage') : t('editor.promo.chooseImage')}
                                    onClick={() => onPick('image')}/>
                            {promo.image && <Button size="small" variant="ghost" icon={<Delete/>} label={t('editor.promo.removeImage')}
                                                    onClick={() => onPatch({image: null})}/>}
                        </div>
                        <div>
                            <label className={styles.fieldLabel} htmlFor={id('alt')}><Typography weight="bold">{t('editor.promo.imageAlt')}</Typography></label>
                            <Input id={id('alt')} value={promo.imageAlt} isDisabled={!promo.image} onChange={e => onPatch({imageAlt: e.target.value})}/>
                            <Typography variant="caption" className={styles.muted}>{t('editor.promo.imageAltHelp')}</Typography>
                        </div>
                    </div>
                    <div className={styles.promoTextCol}>
                        <div>
                            <label className={styles.fieldLabel} htmlFor={id('title')}><Typography weight="bold">{t('editor.promo.promoTitle')}</Typography></label>
                            <Input id={id('title')} value={promo.title}
                                   placeholder={promo.fallbackTitle ? t('editor.labelPlaceholderFallback', {lang: upper(fallbackLanguage), label: promo.fallbackTitle}) : ''}
                                   onChange={e => onPatch({title: e.target.value})}/>
                        </div>
                        <div>
                            <label className={styles.fieldLabel} htmlFor={id('text')}><Typography weight="bold">{t('editor.promo.text')}</Typography></label>
                            <Textarea id={id('text')} value={promo.text} onChange={e => onPatch({text: e.target.value})}/>
                        </div>
                        <div className={styles.promoPair}>
                            <div>
                                <label className={styles.fieldLabel} htmlFor={id('label')}><Typography weight="bold">{t('editor.promo.linkLabel')}</Typography></label>
                                <Input id={id('label')} value={promo.linkLabel} onChange={e => onPatch({linkLabel: e.target.value})}/>
                            </div>
                            <div>
                                <Typography weight="bold" className={styles.fieldLabel}>{t('editor.promo.link')}</Typography>
                                {promo.target ? (
                                    <div className={styles.promoTarget}>
                                        <span className={styles.promoTargetText}>
                                            <Typography>{promo.target.title}</Typography>
                                            <Typography variant="caption" className={styles.muted}>{promo.target.path}</Typography>
                                        </span>
                                        <Button size="small" variant="ghost" icon={<Close/>} aria-label={t('editor.promo.removeLink')}
                                                onClick={() => onPatch({target: null})}/>
                                    </div>
                                ) : (
                                    <div className={styles.promoLinkRow}>
                                        <Input id={id('url')} value={promo.url} placeholder="https://" aria-label={t('editor.promo.url')}
                                               onChange={e => onPatch({url: e.target.value})}/>
                                        <Button size="small" variant="outlined" label={t('editor.promo.chooseLink')} onClick={() => onPick('target')}/>
                                    </div>
                                )}
                                <Typography variant="caption" className={styles.muted}>{t('editor.promo.linkHelp')}</Typography>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
