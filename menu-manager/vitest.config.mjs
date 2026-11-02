import {defineConfig} from 'vitest/config';

// Unit tests of the pure logic of the Menus screen (the tree operations); no jContent host.
export default defineConfig({test: {include: ['src/javascript/**/*.test.ts']}});
