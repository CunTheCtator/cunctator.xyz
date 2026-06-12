import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "site.db");

type RawDocument = {
  id: number;
  uuid: string;
  title: string;
  description: string;
  tags: string;
  featured: number;
  uploaded_at: string;
};

export type Document = {
  id: number;
  uuid: string;
  title: string;
  description: string;
  tags: string[];
  featured: boolean;
  uploaded_at: string;
};

export type DocumentInput = {
  uuid: string;
  title: string;
  description: string;
  tags: string[];
  featured?: boolean;
};

export type DocumentUpdate = Partial<Omit<DocumentInput, "uuid">>;

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid        TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags        TEXT NOT NULL DEFAULT '[]',
      featured    BOOL NOT NULL DEFAULT FALSE,
      uploaded_at TEXT NOT NULL
    )
  `);

  return db;
}

function parseDoc(raw: RawDocument): Document {
  return {
    ...raw,
    tags: JSON.parse(raw.tags) as string[],
    featured: raw.featured === 1,
  };
}

export function getAllDocuments(): Document[] {
  try {
    const rows = getDb()
      .prepare("SELECT * FROM documents ORDER BY uploaded_at DESC")
      .all() as RawDocument[];
    return rows.map(parseDoc);
  } catch (err) {
    console.error("[db] getAllDocuments failed:", err);
    return [];
  }
}

export function getFeaturedDocuments(limit = 3): Document[] {
  try {
    const rows = getDb()
      .prepare(
        "SELECT * FROM documents WHERE featured = TRUE ORDER BY uploaded_at DESC LIMIT ?"
      )
      .all(limit) as RawDocument[];
    return rows.map(parseDoc);
  } catch (err) {
    console.error("[db] getFeaturedDocuments failed:", err);
    return [];
  }
}

export function getDocument(id: number): Document | null {
  try {
    const row = getDb()
      .prepare("SELECT * FROM documents WHERE id = ?")
      .get(id) as RawDocument | undefined;
    return row ? parseDoc(row) : null;
  } catch (err) {
    console.error(`[db] getDocument(${id}) failed:`, err);
    return null;
  }
}

export function insertDocument(data: DocumentInput): Document | null {
  try {
    const stmt = getDb().prepare(`
      INSERT INTO documents (uuid, title, description, tags, featured, uploaded_at)
      VALUES (@uuid, @title, @description, @tags, @featured, @uploaded_at)
    `);
    const result = stmt.run({
      uuid: data.uuid,
      title: data.title,
      description: data.description,
      tags: JSON.stringify(data.tags),
      featured: data.featured ? 1 : 0,
      uploaded_at: new Date().toISOString(),
    });
    return getDocument(result.lastInsertRowid as number);
  } catch (err) {
    console.error("[db] insertDocument failed:", { data, err });
    return null;
  }
}

export function updateDocument(
  id: number,
  data: DocumentUpdate
): Document | null {
  try {
    const fields: string[] = [];
    const values: Record<string, unknown> = { id };

    if (data.title !== undefined) {
      fields.push("title = @title");
      values.title = data.title;
    }
    if (data.description !== undefined) {
      fields.push("description = @description");
      values.description = data.description;
    }
    if (data.tags !== undefined) {
      fields.push("tags = @tags");
      values.tags = JSON.stringify(data.tags);
    }
    if (data.featured !== undefined) {
      fields.push("featured = @featured");
      values.featured = data.featured ? 1 : 0;
    }

    if (fields.length === 0) return getDocument(id);

    getDb()
      .prepare(`UPDATE documents SET ${fields.join(", ")} WHERE id = @id`)
      .run(values);

    return getDocument(id);
  } catch (err) {
    console.error(`[db] updateDocument(${id}) failed:`, { data, err });
    return null;
  }
}

export function deleteDocument(id: number): boolean {
  try {
    const result = getDb()
      .prepare("DELETE FROM documents WHERE id = ?")
      .run(id);
    return result.changes > 0;
  } catch (err) {
    console.error(`[db] deleteDocument(${id}) failed:`, err);
    return false;
  }
}
