// Regenerates server/schema.sql from the ACTUAL live database schema.
// This is documentation, not a migration - server/index.js's runMigrations() is still
// what actually applies changes on every server start.
//
// Usage: node scripts/dump_schema.js   (run from the server/ directory)
require('dotenv').config();
const db = require('../db');
const fs = require('fs');
const path = require('path');

(async () => {
  const tablesRes = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tables = tablesRes.rows.map(t => t.table_name);

  let out = `-- Gurmad Waste Management System — Live Database Schema
-- Auto-generated snapshot of the ACTUAL live Supabase schema (public schema), not a hand-maintained file.
-- Generated: ${new Date().toISOString()}
--
-- Why this file exists: the live schema was previously spread across 30+ one-off scripts
-- (migrate_*.js, fix_*.js) with no single source of truth. This file is that source of truth --
-- it reflects exactly what is live right now. Regenerate it any time the schema changes with:
--   cd server && node scripts/dump_schema.js
--
-- This does NOT replace server/index.js's runMigrations() — that function is still what
-- actually applies changes to the live database on every server start (idempotent
-- CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS statements). This file is
-- read-only documentation of the result, regenerated periodically, not an executable migration.

`;

  let notedBlogTables = false;
  for (const table of tables) {
    if (!notedBlogTables && table.startsWith('blog_')) {
      out += `-- NOTE: blog_comments / blog_posts / blog_users below are NOT part of the Gurmad application.\n-- They share the same Supabase project but belong to an unrelated project/experiment.\n`;
      notedBlogTables = true;
    }
    const colsRes = await db.query(`
      SELECT column_name, data_type, udt_name, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    const pkRes = await db.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
    `, [table]);
    const pkCols = new Set(pkRes.rows.map(r => r.column_name));

    const fkRes = await db.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
    `, [table]);
    const fkByCol = {};
    fkRes.rows.forEach(r => { fkByCol[r.column_name] = `${r.foreign_table}(${r.foreign_column})`; });

    out += `-- Table: ${table}\nCREATE TABLE IF NOT EXISTS ${table} (\n`;
    const lines = colsRes.rows.map(c => {
      let type;
      if (c.data_type === 'character varying') type = c.character_maximum_length ? `VARCHAR(${c.character_maximum_length})` : 'VARCHAR';
      else if (c.data_type === 'timestamp without time zone') type = 'TIMESTAMP';
      else if (c.data_type === 'timestamp with time zone') type = 'TIMESTAMPTZ';
      else if (c.data_type === 'integer') type = 'INTEGER';
      else if (c.data_type === 'numeric') type = 'NUMERIC';
      else if (c.data_type === 'boolean') type = 'BOOLEAN';
      else if (c.data_type === 'text') type = 'TEXT';
      else if (c.data_type === 'jsonb') type = 'JSONB';
      else if (c.data_type === 'date') type = 'DATE';
      else if (c.data_type === 'uuid') type = 'UUID';
      else if (c.data_type === 'ARRAY') type = c.udt_name.replace(/^_/, '') + '[]';
      else type = c.data_type.toUpperCase();

      let line = `  ${c.column_name} ${type}`;
      if (c.is_nullable === 'NO') line += ' NOT NULL';
      if (c.column_default) line += ` DEFAULT ${c.column_default}`;
      if (pkCols.has(c.column_name)) line += ' PRIMARY KEY';
      if (fkByCol[c.column_name]) line += ` REFERENCES ${fkByCol[c.column_name]}`;
      return line;
    });
    out += lines.join(',\n');
    out += '\n);\n\n';
  }

  const outPath = path.join(__dirname, '..', 'schema.sql');
  fs.writeFileSync(outPath, out);
  console.log(`Wrote ${outPath} with ${tables.length} tables`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
