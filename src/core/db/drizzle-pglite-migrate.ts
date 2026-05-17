/**
 * Drizzle PGLite 基于单migrations.json的迁移组件
 * @description 配合 scripts/compile-migrations.ts 使用；ported from drizzle-orm v1.0.0-rc.2 的 pglite migrator，做了适当修改以适配；遵循drizzle原开源协议
 * @see https://github.com/drizzle-team/drizzle-orm/discussions/2532
 * @see https://github.com/drizzle-team/drizzle-orm/blob/v1.0.0-rc.2/drizzle-orm/src/pglite/migrator.ts
 * @see https://github.com/drizzle-team/drizzle-orm/blob/v1.0.0-rc.2/drizzle-orm/src/pg-core/dialect.ts#L73
 * @license Apache-2.0
 */

import type { MigrationMeta } from "drizzle-orm/migrator";
import { PGlite } from "@electric-sql/pglite";

type DbMigrationRow = {
  id: number;
  hash: string;
  created_at: string | number | bigint | null;
};

export async function drizzlePgLiteMigrate(migrations: MigrationMeta[], db: PGlite): Promise<void> {
  const migrationsTable = "__drizzle_migrations";
  const migrationsSchema = "drizzle";
  const migrationTableCreate = `
            CREATE TABLE IF NOT EXISTS ${migrationsSchema}.${migrationsTable} (
                id SERIAL PRIMARY KEY,
                hash text NOT NULL,
                created_at bigint
            )
        `;

  await db.exec(`CREATE SCHEMA IF NOT EXISTS ${migrationsSchema}`);
  await db.exec(migrationTableCreate);

  const dbMigrations = await db.query(
    `select id, hash, created_at from ${migrationsSchema}.${migrationsTable} order by created_at desc limit 1`,
  );

  const lastDbMigration = dbMigrations.rows[0] as DbMigrationRow | undefined;
  const lastDbMigrationTime = lastDbMigration ? Number(lastDbMigration.created_at) : undefined;

  await db.transaction(async (tx) => {
    for (const migration of migrations) {
      if (lastDbMigrationTime === undefined || lastDbMigrationTime < migration.folderMillis) {
        for (const stmt of migration.sql) {
          await tx.query(stmt);
        }
        await tx.query(
          `insert into ${migrationsSchema}.${migrationsTable} ("hash", "created_at") values($1, $2)`,
          [migration.hash, migration.folderMillis],
        );
      }
    }
  });
}
