import { readMigrationFiles } from "drizzle-orm/migrator";

const migrations = readMigrationFiles({
  migrationsFolder: new URL(import.meta.resolve("../src/core/db/migrations", import.meta.url))
    .pathname,
});

await Bun.write(
  new URL(import.meta.resolve("../src/core/db/migrations.json", import.meta.url)).pathname,
  JSON.stringify(migrations),
);

console.log("Migrations compiled!");
