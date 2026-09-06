import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA } from './schema';

export type DB = DatabaseSync;

export function getDbPath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured) return configured;
  return join(process.cwd(), 'data', 'devcon-ps3.db');
}

export function openDb(path: string = getDbPath()): DB {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

let singleton: DB | null = null;

export function getDb(): DB {
  if (!singleton) {
    singleton = openDb();
  }
  return singleton;
}