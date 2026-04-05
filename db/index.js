import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "data");
const dbPath = path.join(dataDir, "leads.sqlite");

export function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getDb() {
  ensureDataDir();

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

export function getDbPath() {
  return dbPath;
}
