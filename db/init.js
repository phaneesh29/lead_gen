import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDbPath, getOrm } from "./index.js";

function initDatabase() {
  const db = getOrm();
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  migrate(db, { migrationsFolder });

  console.log(`Database initialized at ${getDbPath()}`);
}

initDatabase();
