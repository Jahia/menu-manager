import {registry} from '@jahia/ui-extender';

export default function () {
    registry.add('callback', 'menu-manager', {
        targets: ['jahiaApp-init:50'],
        callback: async () => {
            const {default: register} = await import('./init');
            await register();
        }
    });
}
