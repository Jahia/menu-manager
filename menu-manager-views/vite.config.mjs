import { defineConfig } from "vite";
import jahia from "@jahia/vite-plugin";

export default defineConfig({
  plugins: [
    jahia({
      // Default values:
      // inputDir: "src",
      // outputDir: "dist",
      // assetsDir: "assets",
      // client: {
      //   inputGlob: "**/*.client.{jsx,tsx}",
      //   outputDir: "client",
      // },
      // server: {
      //   inputGlob: "**/*.server.{jsx,tsx}",
      //   outputFile: "server/index.js",
      // },

    }),
  ],
});
