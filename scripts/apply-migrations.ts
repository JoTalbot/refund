import { defaultMigrationsDir, loadMigrationSql } from "../packages/persist/src/migrate.js";

const files = loadMigrationSql(defaultMigrationsDir());
for (const file of files) {
  process.stdout.write(`-- ${file.name}\n${file.sql}\n`);
}
