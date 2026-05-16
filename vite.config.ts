import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
  worker: {
    format: "es",
  },
  pack: {
    entry: {
      index: "./src/index.ts",
      core: "./src/core/index.ts",
      "core/db/utils": "./src/core/db/index.ts",
      "core/db/schema": "./src/core/db/schema.ts",
      adapters: "./src/adapters/index.ts",
      plugins: "./src/plugins/index.ts",
      utils: "./src/utils/index.ts",
    },
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
