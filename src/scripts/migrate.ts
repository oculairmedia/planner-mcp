import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import "dotenv/config";

const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  console.log("Starting database migration...");
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

main();