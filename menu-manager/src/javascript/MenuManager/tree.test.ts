import {describe, expect, it} from 'vitest';
import {drop, flatten, fromServer, indent, Item, MAX_DEPTH, move, moveDown, moveUp, outdent, problems, projection, toSaveTree} from './tree';

const item = (key: string, children: Item[] = [], patch: Partial<Item> = {}): Item => ({
    key, id: key, kind: 'section', label: key, description: '', style: 'default', includeSubpages: false, newTab: false,
    url: '', invalidLanguages: [], target: null, children, ...patch
});

const keys = (items: Item[]): unknown[] => items.map(i => (i.children.length ? [i.key, keys(i.children)] : i.key));

describe('keyboard moves', () => {
    const tree = [item('a', [item('a1'), item('a2')]), item('b'), item('c')];

    it('moves up and down among siblings, and refuses past the ends', () => {
        expect(keys(moveDown(tree, 'a')!)).toEqual(['b', ['a', ['a1', 'a2']], 'c']);
        expect(keys(moveUp(tree, 'a2')!)).toEqual([['a', ['a2', 'a1']], 'b', 'c']);
        expect(moveUp(tree, 'a')).toBeNull();
        expect(moveDown(tree, 'c')).toBeNull();
    });

    it('indents under the item above, at its end, and outdents after the parent', () => {
        expect(keys(indent(tree, 'b')!)).toEqual([['a', ['a1', 'a2', 'b']], 'c']);
        expect(keys(outdent(tree, 'a1')!)).toEqual([['a', ['a2']], 'a1', 'b', 'c']);
        expect(indent(tree, 'a')).toBeNull();
        expect(outdent(tree, 'b')).toBeNull();
    });

    it('never makes a fourth level, with the moved item\'s children counted', () => {
        const deep = [item('x', [item('y', [item('z')])]), item('w', [item('v', [item('u')])])];
        expect(indent(deep, 'w')).toBeNull();
        expect(indent([item('x'), item('w', [item('v')])], 'w')).not.toBeNull();
        expect(keys(indent([item('x', [item('y')]), item('w')], 'w')!)).toEqual([['x', ['y', 'w']]]);
        expect(move(deep, 'x', 'w', 0)).toBeNull();
    });

    it('refuses to move an item under itself or its descendants', () => {
        const nested = [item('p', [item('q')])];
        expect(move(nested, 'p', 'q', 0)).toBeNull();
        expect(move(nested, 'p', 'p', 0)).toBeNull();
    });
});

describe('drag and drop', () => {
    const tree = [item('a', [item('a1')]), item('b'), item('c')];
    const flat = flatten(tree);

    it('drops below a row at its depth, or under it when dragged right', () => {
        const same = projection(flat, 'c', 'b', 0, 32, tree)!;
        expect(same).toEqual({depth: 0, parentKey: null});
        expect(keys(drop(tree, flat, 'c', 'b', same.parentKey)!)).toEqual([['a', ['a1']], 'c', 'b']);

        const under = projection(flat, 'c', 'c', 40, 32, tree)!;
        expect(under).toEqual({depth: 1, parentKey: 'b'});
        expect(keys(drop(tree, flat, 'c', 'c', under.parentKey)!)).toEqual([['a', ['a1']], ['b', ['c']]]);
    });

    it('keeps the depth within the neighbours and the limit', () => {
        expect(projection(flat, 'c', 'c', 500, 32, tree)!.depth).toBe(1);
        const deep = [item('x', [item('y', [item('z')])]), item('w', [item('v')])];
        const flatDeep = flatten(deep);
        expect(projection(flatDeep, 'w', 'w', 500, 32, deep)!.depth).toBe(MAX_DEPTH - 2);
    });

    it('hides the children of the dragged item, which move with it', () => {
        expect(flatten(tree, new Set(), 'a').map(f => f.key)).toEqual(['a', 'b', 'c']);
    });
});

describe('saving', () => {
    it('sends what each kind needs and no more', () => {
        const target = {uuid: 'u1', path: '/p', title: 'P', nodeType: 'jnt:page', available: true, inLive: true};
        const tree = fromServer([{
            id: 'i1', kind: 'page', label: ' Deals ', style: 'default', includeSubpages: true, newTab: true, url: null,
            invalidLanguages: ['zh'], target, publicAccess: true, children: [
                {id: 'i2', kind: 'externalLink', label: null, style: 'button', includeSubpages: false, newTab: true,
                    url: 'https://a.example', invalidLanguages: [], target: null, publicAccess: true}]
        }]);
        expect(toSaveTree(tree)).toEqual({items: [{
            id: 'i1', kind: 'page', label: 'Deals', description: null, style: 'default', invalidLanguages: ['zh'],
            page: 'u1', includeSubpages: true, children: [{
                id: 'i2', kind: 'externalLink', label: null, description: null, style: 'button', invalidLanguages: [],
                url: 'https://a.example', newTab: true, children: []
            }]
        }]});
    });

    it('names the problems the server would refuse', () => {
        expect(problems([item('s', [], {id: undefined, label: ''})])).toEqual(['sectionLabel']);
        expect(problems([item('s', [], {label: '', fallbackLabel: 'Travel'})])).toEqual([]);
        expect(problems([item('l', [], {kind: 'externalLink', url: 'javascript:alert(1)'})])).toEqual(['badUrl']);
        expect(problems([item('p', [], {kind: 'page'})])).toEqual(['noTarget']);
    });
});
