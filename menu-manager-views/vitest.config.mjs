import { defineConfig } from "vitest/config";

// Unit tests of pure logic only: no Jahia plugin (it builds the module, and fails under Vitest).
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
