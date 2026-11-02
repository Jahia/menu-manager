import {defineConfig} from 'cypress';
import {setupNodeEvents} from './cypress/plugins';

export default defineConfig({
    video: false,
    screenshotOnRunFailure: true,
    // Under results/, which the CI keeps as the run's artifact
    screenshotsFolder: './results/screenshots',
    videosFolder: './results/videos',
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 10000,
    requestTimeout: 30000,
    responseTimeout: 120000,
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
        configFile: 'reporter-config.json'
    },
    e2e: {
        supportFile: 'cypress/support/e2e.ts',
        specPattern: 'cypress/e2e/**/*.spec.ts',
        setupNodeEvents
    }
});
