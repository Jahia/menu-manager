const path = require('path');
const getModuleFederationConfig = require('@jahia/webpack-config/getModuleFederationConfig');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const packageJson = require('./package.json');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    return {
        entry: {main: path.resolve(__dirname, 'src/javascript/index.ts')},
        output: {
            path: path.resolve(__dirname, 'src/main/resources/javascript/apps/'),
            publicPath: 'auto',
            filename: 'menu-manager.bundle.js',
            chunkFilename: '[name].menu-manager.[chunkhash:6].js'
        },
        resolve: {extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx']},
        module: {
            rules: [
                {test: /\.[jt]sx?$/, use: 'babel-loader', exclude: /node_modules/},
                {
                    test: /\.module\.css$/,
                    use: ['style-loader', {loader: 'css-loader', options: {modules: true}}]
                },
                {test: /\.css$/, exclude: /\.module\.css$/, use: ['style-loader', 'css-loader']}
            ]
        },
        plugins: [
            new ModuleFederationPlugin(getModuleFederationConfig(packageJson, {
                name: 'menuManager',
                library: {type: 'assign', name: 'appShell.remotes.menuManager'},
                filename: 'remoteEntry.js',
                exposes: {
                    './init': './src/javascript/init'
                },
                remotes: {
                    '@jahia/app-shell': 'appShellRemote',
                    '@jahia/jcontent': 'appShell.remotes.jcontent'
                },
                shared: {
                    react: {singleton: true, requiredVersion: packageJson.dependencies.react},
                    'react-dom': {singleton: true, requiredVersion: packageJson.dependencies['react-dom']},
                    // Host-provided. Never bundled: the jcontent store is the one we read from.
                    'react-redux': {singleton: true, import: false},
                    redux: {singleton: true, import: false},
                    '@apollo/client': {singleton: true, import: false}
                }
            })),
            new CleanWebpackPlugin({verbose: false}),
            // app-shell discovers the remote through the "jahia.remotes" key of this file.
            new CopyWebpackPlugin({patterns: [{from: './package.json', to: ''}]})
        ],
        mode: isProduction ? 'production' : 'development',
        devtool: isProduction ? 'source-map' : 'eval-source-map'
    };
};
