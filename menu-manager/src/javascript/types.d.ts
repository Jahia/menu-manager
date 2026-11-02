// Host-provided libraries without type definitions in this build.
declare module '@jahia/ui-extender';
declare module '@jahia/data-helper';
declare module '@jahia/react-material';
declare module 'react-redux';
declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}

interface Window {
    jahia?: {
        moonstone?: {toIconComponent?: (svg: string) => unknown};
    };
    CE_API?: {openPicker?: (options: Record<string, unknown>) => void};
    contextJsParameters?: {contextPath?: string; uilang?: string; siteKey?: string};
}
