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
      "dan-any": "./src/index.ts",
      "dan-any/core": "./src/core/index.ts",
      "dan-any/adapters": "./src/adapters/index.ts",
      "dan-any/plugins": "./src/plugins/index.ts",
      "dan-any/utils": "./src/utils/index.ts",
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
