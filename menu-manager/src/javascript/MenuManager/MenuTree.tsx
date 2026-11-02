import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragMoveEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {
    Button,
    Checkbox,
    ChevronDown,
    ChevronRight,
    Chip,
    Delete,
    Dropdown,
    HandleDrag,
    Input,
    Language,
    Link,
    Lock,
    OpenInNew,
    Page,
    Text,
    Textarea,
    Tooltip,
    Typography,
    Warning
} from '@jahia/moonstone';
import {NS} from '../i18n';
import {PromoEditor} from './PromoEditor';
import {displayLabel, drop, find, FlatItem, flatten, indent, Item, Kind, locate, moveDown, moveUp, outdent, projection, remove, Style, update} from './tree';
import styles from './MenuManager.module.css';

const INDENT = 32;

const KIND_ICON: Record<Kind, JSX.Element> = {
    page: <Page/>,
    section: <Text/>,
    internalLink: <Link/>,
    externalLink: <OpenInNew/>
};

export interface MenuTreeProps {
    items: Item[];
    onChange: (items: Item[]) => void;
    language: string;
    fallbackLanguage: string;
    siteLanguages: string[];
    onPickTarget: (key: string, kind: Kind) => void;
    onPickPromo: (key: string, field: 'image' | 'target') => void;
    onConfirm: (message: string, action: () => void) => void;
}

/**
 * The menu as a column of boxes, one per item, indented per level. Dragging a box reorders it;
 * dragging it to the right places it under the box above (dnd-kit, the "sortable tree" pattern on a
 * flattened copy of the tree). The same moves are buttons in each item's editor, for the keyboard.
 */
export const MenuTree = ({items, onChange, language, fallbackLanguage, siteLanguages, onPickTarget, onPickPromo, onConfirm}: MenuTreeProps): JSX.Element => {
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [overKey, setOverKey] = useState<string | null>(null);
    const [offsetX, setOffsetX] = useState(0);
    const [openKey, setOpenKey] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
    );

    const flat = useMemo(() => flatten(items, new Set(), activeKey ?? undefined), [items, activeKey]);
    const projected = activeKey && overKey ? projection(flat, activeKey, overKey, offsetX, INDENT, items) : null;
    const active = activeKey ? flat.find(f => f.key === activeKey) : undefined;

    const reset = (): void => {
        setActiveKey(null);
        setOverKey(null);
        setOffsetX(0);
    };

    const onDragStart = ({active: a}: DragStartEvent): void => {
        setActiveKey(String(a.id));
        setOverKey(String(a.id));
        setOpenKey(null);
    };
    const onDragMove = ({delta}: DragMoveEvent): void => setOffsetX(delta.x);
    const onDragOver = ({over}: DragOverEvent): void => setOverKey(over ? String(over.id) : null);
    const onDragEnd = ({active: a, over}: DragEndEvent): void => {
        if (over && projected) {
            const next = drop(items, flat, String(a.id), String(over.id), projected.parentKey);
            if (next) {
                onChange(next);
            }
        }
        reset();
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{droppable: {strategy: MeasuringStrategy.Always}}}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={reset}
        >
            <SortableContext items={flat.map(f => f.key)} strategy={verticalListSortingStrategy}>
                <ul className={styles.tree} data-mnu-role="menu-tree">
                    {flat.map(f => (
                        <SortableRow
                            key={f.key}
                            flat={f}
                            depth={f.key === activeKey && projected ? projected.depth : f.depth}
                            items={items}
                            isOpen={openKey === f.key}
                            onToggle={() => setOpenKey(openKey === f.key ? null : f.key)}
                            language={language}
                            fallbackLanguage={fallbackLanguage}
                            siteLanguages={siteLanguages}
                            onChange={onChange}
                            onPickTarget={onPickTarget}
                            onPickPromo={onPickPromo}
                            onConfirm={onConfirm}
                        />
                    ))}
                </ul>
            </SortableContext>
            <DragOverlay>
                {active ? (
                    <div className={styles.overlay}>
                        <RowBar item={active.item} language={language} fallbackLanguage={fallbackLanguage} isOpen={false}/>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

interface RowProps {
    flat: FlatItem;
    depth: number;
    items: Item[];
    isOpen: boolean;
    onToggle: () => void;
    language: string;
    fallbackLanguage: string;
    siteLanguages: string[];
    onChange: (items: Item[]) => void;
    onPickTarget: (key: string, kind: Kind) => void;
    onPickPromo: (key: string, field: 'image' | 'target') => void;
    onConfirm: (message: string, action: () => void) => void;
}

const SortableRow = ({flat, depth, items, isOpen, onToggle, language, fallbackLanguage, siteLanguages, onChange, onPickTarget, onPickPromo,
                         onConfirm}: RowProps): JSX.Element => {
    const {t} = useTranslation(NS);
    const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({id: flat.key});
    const {item} = flat;
    const label = displayLabel(item).text;
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        '--indent': `${depth * INDENT}px`
    } as React.CSSProperties;
    return (
        <li ref={setNodeRef} className={styles.row} style={style} data-depth={depth} data-mnu-item={item.key}>
            <div className={styles.box} data-open={isOpen} data-dragging={isDragging}>
                <RowBar
                    item={item}
                    language={language}
                    fallbackLanguage={fallbackLanguage}
                    isOpen={isOpen}
                    onToggle={onToggle}
                    handle={(
                        <button
                            ref={setActivatorNodeRef}
                            type="button"
                            className={styles.handle}
                            aria-label={`${t('editor.move')}: ${label}`}
                            {...attributes}
                            {...listeners}
                        >
                            <HandleDrag/>
                        </button>
                    )}
                />
                {isOpen && (
                    <ItemEditor
                        item={item}
                        items={items}
                        language={language}
                        fallbackLanguage={fallbackLanguage}
                        siteLanguages={siteLanguages}
                        onChange={onChange}
                        onPickTarget={onPickTarget}
                        onPickPromo={onPickPromo}
                        isTop={flat.depth === 0}
                        onConfirm={onConfirm}
                    />
                )}
            </div>
        </li>
    );
};

interface RowBarProps {
    item: Item;
    language: string;
    fallbackLanguage: string;
    isOpen: boolean;
    onToggle?: () => void;
    handle?: JSX.Element;
}

const upper = (lang: string): string => lang.toUpperCase().replace('_', '-');

/** The always-visible part of an item: handle, kind, label, target and what a visitor will not see. */
const RowBar = ({item, fallbackLanguage, isOpen, onToggle, handle}: RowBarProps): JSX.Element => {
    const {t} = useTranslation(NS);
    const shown = displayLabel(item);
    const sub = item.kind === 'externalLink' ? item.url : item.target?.path ?? '';
    const hidden = item.invalidLanguages.map(upper);
    return (
        <div className={styles.boxBar}>
            {handle ?? <span className={styles.handle}><HandleDrag/></span>}
            <span className={styles.kindIcon} aria-hidden="true">{KIND_ICON[item.kind]}</span>
            <span className={styles.labelBlock}>
                <Typography weight="bold" className={styles.labelText} data-fallback={shown.fallback}>{shown.text || ' '}</Typography>
                <Typography variant="caption" className={styles.subline}>
                    {t(`kind.${item.kind}`)}{sub ? ` · ${sub}` : ''}
                </Typography>
            </span>
            <span className={styles.badges}>
                {shown.fallback && (
                    <Tooltip label={t('badge.fallbackHelp', {lang: upper(fallbackLanguage)})}>
                        <span><Chip label={t('badge.fallback', {lang: upper(fallbackLanguage)})} icon={<Language/>}/></span>
                    </Tooltip>
                )}
                {item.kind === 'page' && item.includeSubpages && <Chip label={t('badge.subpages')} color="accent"/>}
                {(item.promo.title || item.promo.fallbackTitle) && <Chip label={t('editor.promo.badge')} color="accent"/>}
                {hidden.length > 0 && <Chip label={t('badge.hiddenIn', {langs: hidden.join(', ')})} color="light"/>}
                {item.target && !item.target.available && (
                    <Tooltip label={t('badge.unavailableHelp')}>
                        <span><Chip label={t('badge.unavailable')} color="danger" icon={<Warning/>}/></span>
                    </Tooltip>
                )}
                {item.target && item.target.available && !item.target.inLive && (
                    <Tooltip label={t('badge.notPublishedHelp')}>
                        <span><Chip label={t('badge.notPublished')} color="warning"/></span>
                    </Tooltip>
                )}
                {item.id && item.publicAccess === false && item.target?.available !== false && (
                    <Tooltip label={t('badge.notPublicHelp')}>
                        <span><Chip label={t('badge.notPublic')} icon={<Lock/>}/></span>
                    </Tooltip>
                )}
            </span>
            {onToggle && (
                <Button
                    variant="ghost"
                    icon={isOpen ? <ChevronDown/> : <ChevronRight/>}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? t('editor.close') : t('editor.edit', {label: shown.text})}
                    onClick={onToggle}
                />
            )}
        </div>
    );
};

interface EditorProps {
    item: Item;
    items: Item[];
    language: string;
    fallbackLanguage: string;
    siteLanguages: string[];
    onChange: (items: Item[]) => void;
    onPickTarget: (key: string, kind: Kind) => void;
    onPickPromo: (key: string, field: 'image' | 'target') => void;
    isTop: boolean;
    onConfirm: (message: string, action: () => void) => void;
}

/** Everything about one item, in the edited language; and the moves, for the keyboard. */
const ItemEditor = ({item, items, language, fallbackLanguage, siteLanguages, onChange, onPickTarget, onPickPromo, isTop,
                        onConfirm}: EditorProps): JSX.Element => {
    const {t} = useTranslation(NS);
    const set = (patch: Partial<Item>): void => onChange(update(items, item.key, patch));
    const id = (field: string): string => `mnu-${item.key}-${field}`;
    const shown = displayLabel({...item, label: ''});
    const placeholder = !shown.text ? ''
        : shown.fallback ? t('editor.labelPlaceholderFallback', {lang: upper(fallbackLanguage), label: shown.text})
            : item.target?.title === shown.text ? t('editor.labelPlaceholderTitle', {title: shown.text}) : shown.text;

    const at = locate(items, item.key);
    const siblings = at ? (at.parentKey === null ? items : find(items, at.parentKey)?.children ?? []) : [];
    const above = at && at.index > 0 ? siblings[at.index - 1] : null;
    const parent = at?.parentKey ? find(items, at.parentKey) : null;
    const moves: {key: string; label: string; run: () => Item[] | null}[] = [
        {key: 'up', label: t('editor.up'), run: () => moveUp(items, item.key)},
        {key: 'down', label: t('editor.down'), run: () => moveDown(items, item.key)},
        ...(above ? [{key: 'under', label: t('editor.under', {label: displayLabel(above).text}), run: () => indent(items, item.key)}] : []),
        ...(parent ? [{key: 'out', label: t('editor.out', {label: displayLabel(parent).text}), run: () => outdent(items, item.key)}] : [])
    ];

    return (
        <div className={styles.editor}>
            <div>
                <label className={styles.fieldLabel} htmlFor={id('label')}><Typography weight="bold">{t('editor.label')}</Typography></label>
                <Input id={id('label')} value={item.label} placeholder={placeholder} onChange={e => set({label: e.target.value})}/>
            </div>
            {item.kind !== 'section' && (
                <div>
                    <Typography weight="bold" className={styles.fieldLabel}>{t('editor.style')}</Typography>
                    <Dropdown
                        value={item.style}
                        label={t(`editor.styles.${item.style}`)}
                        data={(['default', 'highlight', 'button'] as Style[]).map(s => ({label: t(`editor.styles.${s}`), value: s}))}
                        onChange={(_e, option) => set({style: (option.value ?? 'default') as Style})}
                    />
                </div>
            )}
            {item.kind === 'externalLink' && (
                <div className={styles.editorWide}>
                    <label className={styles.fieldLabel} htmlFor={id('url')}><Typography weight="bold">{t('editor.url')}</Typography></label>
                    <Input id={id('url')} value={item.url} placeholder="https://" onChange={e => set({url: e.target.value})}/>
                </div>
            )}
            {(item.kind === 'page' || item.kind === 'internalLink') && (
                <div className={styles.editorWide}>
                    <Typography weight="bold" className={styles.fieldLabel}>{t('editor.target')}</Typography>
                    <div className={styles.targetLine}>
                        <Typography>{item.target?.title ?? ''}</Typography>
                        <Typography variant="caption" className={styles.muted}>{item.target?.path ?? ''}</Typography>
                        <Button size="small" variant="outlined" label={t('editor.change')} onClick={() => onPickTarget(item.key, item.kind)}/>
                    </div>
                </div>
            )}
            <div className={styles.editorWide}>
                <label className={styles.fieldLabel} htmlFor={id('description')}><Typography weight="bold">{t('editor.description')}</Typography></label>
                <Textarea id={id('description')} value={item.description} placeholder={item.fallbackDescription ?? t('editor.descriptionHelp')} onChange={e => set({description: e.target.value})}/>
            </div>
            {item.kind === 'page' && (
                <label className={styles.checkLine}>
                    <Checkbox checked={item.includeSubpages} onChange={(_e, _v, checked) => set({includeSubpages: checked})}/>
                    <Typography>{t('editor.includeSubpages')}</Typography>
                </label>
            )}
            {(item.kind === 'internalLink' || item.kind === 'externalLink') && (
                <label className={styles.checkLine}>
                    <Checkbox checked={item.newTab} onChange={(_e, _v, checked) => set({newTab: checked})}/>
                    <Typography>{t('editor.newTab')}</Typography>
                </label>
            )}
            {siteLanguages.length > 1 && (
                <fieldset className={`${styles.editorWide} ${styles.languagesField}`}>
                    <legend className={styles.fieldLabel}><Typography weight="bold">{t('editor.visibleIn')}</Typography></legend>
                    <div className={styles.languages}>
                        {siteLanguages.map(lang => (
                            <label key={lang} className={styles.checkLine}>
                                <Checkbox
                                    checked={!item.invalidLanguages.includes(lang)}
                                    onChange={(_e, _v, checked) => set({
                                        invalidLanguages: checked ? item.invalidLanguages.filter(l => l !== lang) : [...item.invalidLanguages, lang]
                                    })}
                                />
                                <Typography weight={lang === language ? 'bold' : undefined}>{upper(lang)}</Typography>
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}
            {isTop && <PromoEditor item={item} fallbackLanguage={fallbackLanguage} onPatch={promo => set({promo: {...item.promo, ...promo}})}
                                   onPick={field => onPickPromo(item.key, field)}/>}
            <div className={styles.editorFoot}>
                <div className={styles.moves} role="group" aria-label={t('editor.move')}>
                    {moves.map(m => {
                        const next = m.run();
                        return <Button key={m.key} size="small" variant="ghost" label={m.label} isDisabled={!next} onClick={() => next && onChange(next)}/>;
                    })}
                </div>
                <Button
                    size="small"
                    variant="outlined"
                    color="danger"
                    icon={<Delete/>}
                    label={t('editor.remove')}
                    onClick={() => {
                        const doRemove = (): void => onChange(remove(items, item.key));
                        if (item.children.length) {
                            onConfirm(t('editor.removeConfirm', {label: displayLabel(item).text}), doRemove);
                        } else {
                            doRemove();
                        }
                    }}
                />
            </div>
        </div>
    );
};
