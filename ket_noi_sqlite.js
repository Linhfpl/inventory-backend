// File: backend/ket_noi_sqlite.js
// Mô tả: Kết nối tới database (SQLite local hoặc PostgreSQL cloud)

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Kiểm tra xem có dùng PostgreSQL không
const usePostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let getDbFunction;

if (usePostgres) {
  console.log('🐘 Using PostgreSQL database');
  // Import PostgreSQL connector dynamically
  const pgModule = await import('./ket_noi_postgres.js');
  getDbFunction = pgModule.getDb;
} else {
  console.log('📦 Using SQLite database');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Prefer DATABASE_URL env (e.g. file:./data/database.sqlite?mode=rwc), fallback to local BD.db
let dbPath = path.resolve(__dirname, '../BD.db');
const envDb = process.env.DATABASE_URL || process.env.SQLITE_URL;
if (envDb) {
  // Support file: URLs and plain paths
  if (envDb.startsWith('file:')) {
    // Extract path after file:
    const fileRelative = envDb.replace(/^file:/, '');
    dbPath = path.resolve(__dirname, fileRelative);
  } else {
    dbPath = path.resolve(__dirname, envDb);
  }
}
// Ensure parent directory exists (Railway ephemeral FS)
try {
  const parent = path.dirname(dbPath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
} catch {}

let indexesInitialized = false;
let schemaInitialized = false;

async function migrateBinViTriSchema(db) {
  await db.exec('PRAGMA foreign_keys = OFF;');
  await db.run('BEGIN');
  try {
    await db.exec('ALTER TABLE BIN_VI_TRI RENAME TO BIN_VI_TRI_OLD');
    await db.exec(`
      CREATE TABLE BIN_VI_TRI (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        STT INT,
        Rack VARCHAR(512) NOT NULL,
        Bin VARCHAR(512) NOT NULL,
        Vendor_code VARCHAR(512),
        SS_code VARCHAR(512),
        Item VARCHAR(512),
        Model VARCHAR(512),
        Type_Item VARCHAR(512),
        OK INT,
        NG INT,
        Stock INT,
        Don_vi VARCHAR(512),
        Trang_thai_Bin VARCHAR(32) DEFAULT 'Empty',
        Layout VARCHAR(50),
        Bin_Code VARCHAR(150),
        Capacity INT
      )
    `);
    await db.exec(`
      INSERT INTO BIN_VI_TRI (
        STT, Rack, Bin, Vendor_code, SS_code, Item, Model, Type_Item,
        OK, NG, Stock, Don_vi, Trang_thai_Bin, Layout, Bin_Code, Capacity
      )
      SELECT
        STT, Rack, Bin, Vendor_code, SS_code, Item, Model, Type_Item,
        OK, NG, Stock, Don_vi, Trang_thai_Bin, Layout, Bin_Code, Capacity
      FROM BIN_VI_TRI_OLD
    `);
    await db.exec('DROP TABLE BIN_VI_TRI_OLD');
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    await db.exec('PRAGMA foreign_keys = ON;');
    throw err;
  }
  await db.exec('PRAGMA foreign_keys = ON;');
  indexesInitialized = false;
}

async function migrateKhoSchema(db) {
  await db.exec('PRAGMA foreign_keys = OFF;');
  await db.run('BEGIN');
  try {
    await db.exec('ALTER TABLE KHO RENAME TO KHO_OLD');
    await db.exec(`
      CREATE TABLE KHO (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        STT INT,
        Vendor_code VARCHAR(512),
        SS_Code VARCHAR(512),
        Hinh_anh VARCHAR(512),
        Trung VARCHAR(512),
        Item VARCHAR(512),
        Type_Item VARCHAR(512),
        Model VARCHAR(512),
        Don_vi VARCHAR(512),
        Kho_OK VARCHAR(512),
        Ton_Line VARCHAR(512),
        Ton_C_Tien VARCHAR(512),
        Ton_Muon VARCHAR(512),
        Kho_NG VARCHAR(512),
        Tong_ton INT,
        Nguoi_Cap_Nhat_Cuoi VARCHAR(512),
        Thoi_Gian_Cap_Nhat_Cuoi DATETIME,
        Ton_Cho_Kiem INTEGER DEFAULT 0,
        Min_Stock INTEGER DEFAULT 0,
        Max_Stock INTEGER DEFAULT 0
      )
    `);
    await db.exec(`
      INSERT INTO KHO (
        STT, Vendor_code, SS_Code, Hinh_anh, Trung, Item, Type_Item, Model, Don_vi,
        Kho_OK, Ton_Line, Ton_C_Tien, Ton_Muon, Kho_NG, Tong_ton,
        Nguoi_Cap_Nhat_Cuoi, Thoi_Gian_Cap_Nhat_Cuoi, Ton_Cho_Kiem, Min_Stock, Max_Stock
      )
      SELECT
        STT, Vendor_code, SS_Code, Hinh_anh, Trung, Item, Type_Item, Model, Don_vi,
        Kho_OK, Ton_Line, Ton_C_Tien, Ton_Muon, Kho_NG, Tong_ton,
        Nguoi_Cap_Nhat_Cuoi, Thoi_Gian_Cap_Nhat_Cuoi, Ton_Cho_Kiem, Min_Stock, Max_Stock
      FROM KHO_OLD
    `);
    await db.exec('DROP TABLE KHO_OLD');
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    await db.exec('PRAGMA foreign_keys = ON;');
    throw err;
  }
  await db.exec('PRAGMA foreign_keys = ON;');
  indexesInitialized = false;
}

async function ensureSchema(db) {
  if (schemaInitialized) return;
  
  // Migrate KHO table first
  try {
    const khoColumns = await db.all("PRAGMA table_info('KHO')");
    if (Array.isArray(khoColumns) && khoColumns.length > 0) {
      const hasIdColumn = khoColumns.some((col) => col?.name === 'ID');
      const primaryKeyColumns = khoColumns.filter((col) => Number(col?.pk) > 0).map((col) => col.name);
      const needsMigration = !hasIdColumn || primaryKeyColumns.length !== 1 || primaryKeyColumns[0] !== 'ID';
      if (needsMigration) {
        await migrateKhoSchema(db);
      }
    }
  } catch (err) {
    if (!err?.message?.includes('no such table')) {
      throw err;
    }
  }

  // Ensure KHO columns
  try {
    const khoColumns = await db.all("PRAGMA table_info('KHO')");
    const columnNames = new Set(khoColumns.map((col) => col?.name));
    if (!columnNames.has('Ton_Cho_Kiem')) {
      await db.run('ALTER TABLE KHO ADD COLUMN Ton_Cho_Kiem INTEGER DEFAULT 0');
    }
    if (!columnNames.has('Min_Stock')) {
      await db.run('ALTER TABLE KHO ADD COLUMN Min_Stock INTEGER DEFAULT 0');
    }
    if (!columnNames.has('Max_Stock')) {
      await db.run('ALTER TABLE KHO ADD COLUMN Max_Stock INTEGER DEFAULT 0');
    }
  } catch (err) {
    if (!err?.message?.includes('no such table')) {
      throw err;
    }
  }

  try {
    const binColumns = await db.all("PRAGMA table_info('BIN_VI_TRI')");
    if (Array.isArray(binColumns) && binColumns.length > 0) {
      const hasIdColumn = binColumns.some((col) => col?.name === 'ID');
      const primaryKeyColumns = binColumns.filter((col) => Number(col?.pk) > 0).map((col) => col.name);
      const needsMigration = !hasIdColumn || !(primaryKeyColumns.length === 1 && primaryKeyColumns[0] === 'ID');
      if (needsMigration) {
        await migrateBinViTriSchema(db);
      }
    }

    await db.run(
      `INSERT OR IGNORE INTO BIN_VI_TRI (Rack, Layout, Bin, Bin_Code, SS_code, Vendor_code, Item, Model, Type_Item, Don_vi, OK, NG, Stock, Capacity, Trang_thai_Bin)
       VALUES ('TEMP', 'QC', '01', 'TEMP-BIN-01', NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 0, 'Quarantine')`
    );
  } catch (err) {
    if (!err?.message?.includes('no such table')) {
      throw err;
    }
  }

  schemaInitialized = true;
}

async function ensureIndexes(db) {
  if (indexesInitialized) return;
  const statements = [
    'CREATE INDEX IF NOT EXISTS idx_kho_sscode_vendor ON KHO(SS_Code, Vendor_code)',
    'CREATE INDEX IF NOT EXISTS idx_kho_sscode ON KHO(SS_Code)',
    'CREATE INDEX IF NOT EXISTS idx_kho_stt ON KHO(STT)',
    'CREATE INDEX IF NOT EXISTS idx_bin_vi_tri_rack_bin ON BIN_VI_TRI(Rack, Bin)',
    'CREATE INDEX IF NOT EXISTS idx_bin_vi_tri_rack_bin_vendor_ss ON BIN_VI_TRI(Rack, Bin, Vendor_code, SS_code)',
    'CREATE INDEX IF NOT EXISTS idx_bin_vi_tri_sscode ON BIN_VI_TRI(SS_code)',
    'CREATE INDEX IF NOT EXISTS idx_bin_vi_tri_stt ON BIN_VI_TRI(STT)',
    'CREATE INDEX IF NOT EXISTS idx_gd_nhap_ngay ON GIAO_DICH_NHAP_KHO(NgayGiaoDich)',
    'CREATE INDEX IF NOT EXISTS idx_gd_xuat_ngay ON GIAO_DICH_XUAT_KHO(NgayGiaoDich)'
  ];
  for (const statement of statements) {
    try {
      await db.exec(statement);
    } catch (err) {
      if (!err?.message?.includes('no such table')) {
        throw err;
      }
    }
  }
  indexesInitialized = true;
}

  getDbFunction = async function() {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    await db.exec('PRAGMA foreign_keys = ON;');
    try {
      await ensureSchema(db);
    } catch (err) {
      if (!err?.message?.includes('no such table')) {
        throw err;
      }
    }
    try {
      await ensureIndexes(db);
    } catch (err) {
      // Nếu không thể tạo index (ví dụ bảng chưa tồn tại), bỏ qua và tiếp tục
      if (!err?.message?.includes('no such table')) {
        throw err;
      }
    }
    return db;
  };
}

// Export the getDb function
export async function getDb() {
  return getDbFunction();
}
