import fs from "node:fs";
import path from "node:path";
import { getDb, getDbPath } from "./index.js";

const schemaPath = path.join(process.cwd(), "db", "schema.sql");

function initDatabase() {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const db = getDb();

  db.exec(schemaSql);
  db.close();

  console.log(`Database initialized at ${getDbPath()}`);
}

initDatabase();
