// Host-provided libraries without type definitions in this build.
declare module '@jahia/ui-extender';
declare module '@jahia/data-helper';
declare module '@jahia/react-material';
declare module 'react-redux';
declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}

// Globals jContent sets on the page, read through globalThis (all optional: always guarded with ?.)
/* eslint-disable no-var */
declare var jahia: {
    moonstone?: {toIconComponent?: (svg: string) => unknown};
} | undefined;
declare var CE_API: {openPicker?: (options: Record<string, unknown>) => void} | undefined;
declare var contextJsParameters: {contextPath?: string; uilang?: string; siteKey?: string} | undefined;
/* eslint-enable no-var */
