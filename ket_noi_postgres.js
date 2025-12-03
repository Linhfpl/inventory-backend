// File: backend/ket_noi_postgres.js
// Mô tả: Kết nối tới PostgreSQL (Supabase)

import pg from 'pg';
const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
    
    // Strip query params
    const qIndex = connectionString.indexOf('?');
    if (qIndex > 0) {
      connectionString = connectionString.substring(0, qIndex);
    }
    
    // Normalize scheme
    connectionString = connectionString.replace('postgresql://', 'postgres://');
    
    // Parse: postgres://user:pass@host:port/db or postgres://user:pass@host/db
    const schemeEnd = connectionString.indexOf('://') + 3;
    const rest = connectionString.substring(schemeEnd);
    
    const atIndex = rest.lastIndexOf('@'); // Use lastIndexOf in case @ in password
    if (atIndex === -1) throw new Error('Invalid DATABASE_URL: missing @');
    
    const auth = rest.substring(0, atIndex);
    const hostAndDb = rest.substring(atIndex + 1);
    
    const colonIndex = auth.indexOf(':');
    if (colonIndex === -1) throw new Error('Invalid DATABASE_URL: missing :');
    
    const user = auth.substring(0, colonIndex);
    const password = auth.substring(colonIndex + 1);
    
    const slashIndex = hostAndDb.indexOf('/');
    if (slashIndex === -1) throw new Error('Invalid DATABASE_URL: missing /');
    
    const hostPart = hostAndDb.substring(0, slashIndex);
    const database = hostAndDb.substring(slashIndex + 1);
    
    let host = hostPart;
    let port = 5432;
    const lastColonIndex = hostPart.lastIndexOf(':');
    if (lastColonIndex > 0 && /^\d+$/.test(hostPart.substring(lastColonIndex + 1))) {
      host = hostPart.substring(0, lastColonIndex);
      port = Number(hostPart.substring(lastColonIndex + 1));
    }
    
    console.log('✅ Connecting to:', host, 'port:', port, 'db:', database);
    
    pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      ssl: { rejectUnauthorized: false }
    });
    
    console.log('✅ PostgreSQL pool created');
  }
  return pool;
}

// Helper để map từ SQLite sang PostgreSQL
export async function getDb() {
  const pool = getPool();
  
  // Khởi tạo schema nếu chưa có
  await initSchema(pool);
  
  // Trả về object tương thích với SQLite API
  return {
    async get(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows[0] || null;
    },
    async all(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows;
    },
    async run(sql, params = []) {
      const result = await pool.query(sql, params);
      return {
        changes: result.rowCount,
        lastID: result.rows[0]?.id || null
      };
    },
    async exec(sql) {
      await pool.query(sql);
    }
  };
}

async function initSchema(pool) {
  try {
    // Kiểm tra xem bảng KHO đã tồn tại chưa (case-sensitive)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'KHO'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Database schema already exists');
      return;
    }
    
    console.log('🔧 Initializing database schema...');
    
    // Tạo bảng KHO (không dùng quotes để tránh case-sensitive)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "KHO" (
        "ID" SERIAL PRIMARY KEY,
        "STT" INTEGER,
        "Vendor_code" VARCHAR(512),
        "SS_Code" VARCHAR(512),
        "Hinh_anh" VARCHAR(512),
        "Trung" VARCHAR(512),
        "Item" VARCHAR(512),
        "Type_Item" VARCHAR(512),
        "Model" VARCHAR(512),
        "Don_vi" VARCHAR(512),
        "Kho_OK" VARCHAR(512),
        "Ton_Line" VARCHAR(512),
        "Ton_C_Tien" VARCHAR(512),
        "Ton_Muon" VARCHAR(512),
        "Kho_NG" VARCHAR(512),
        "Tong_ton" INTEGER,
        "Nguoi_Cap_Nhat_Cuoi" VARCHAR(512),
        "Thoi_Gian_Cap_Nhat_Cuoi" TIMESTAMP,
        "Ton_Cho_Kiem" INTEGER DEFAULT 0,
        "Min_Stock" INTEGER DEFAULT 0,
        "Max_Stock" INTEGER DEFAULT 0
      );
    `);
    
    // Tạo bảng BIN_VI_TRI
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "BIN_VI_TRI" (
        "ID" SERIAL PRIMARY KEY,
        "STT" INTEGER,
        "Rack" VARCHAR(512) NOT NULL,
        "Bin" VARCHAR(512) NOT NULL,
        "Vendor_code" VARCHAR(512),
        "SS_code" VARCHAR(512),
        "Item" VARCHAR(512),
        "Model" VARCHAR(512),
        "Type_Item" VARCHAR(512),
        "OK" INTEGER,
        "NG" INTEGER,
        "Stock" INTEGER,
        "Don_vi" VARCHAR(512),
        "Trang_thai_Bin" VARCHAR(32) DEFAULT 'Empty',
        "Layout" VARCHAR(50),
        "Bin_Code" VARCHAR(150),
        "Capacity" INTEGER
      );
    `);
    
    // Tạo bảng GIAO_DICH_NHAP_KHO
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "GIAO_DICH_NHAP_KHO" (
        "ID" SERIAL PRIMARY KEY,
        "SoPhieu" VARCHAR(100),
        "MaVatTu" VARCHAR(100),
        "MaNCC" VARCHAR(100),
        "TenVatTu" VARCHAR(255),
        "SoLuong" INTEGER,
        "ViTri" VARCHAR(100),
        "NguoiThucHien" VARCHAR(100),
        "KhuVucNhan" VARCHAR(100),
        "NgayGiaoDich" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "LoaiGiaoDich" VARCHAR(50),
        "GhiChu" TEXT
      );
    `);
    
    // Tạo bảng GIAO_DICH_XUAT_KHO
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "GIAO_DICH_XUAT_KHO" (
        "ID" SERIAL PRIMARY KEY,
        "SoPhieu" VARCHAR(100),
        "MaVatTu" VARCHAR(100),
        "MaNCC" VARCHAR(100),
        "TenVatTu" VARCHAR(255),
        "SoLuong" INTEGER,
        "NguoiThucHien" VARCHAR(100),
        "NgayGiaoDich" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "LoaiGiaoDich" VARCHAR(50),
        "GhiChu" TEXT
      );
    `);
    
    // Tạo bảng LOG_NGHIEP_VU
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "LOG_NGHIEP_VU" (
        "ID" SERIAL PRIMARY KEY,
        "Loai" VARCHAR(50),
        "NoiDung" TEXT,
        "ThoiGian" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Tạo indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_kho_sscode_vendor ON "KHO"("SS_Code", "Vendor_code");
      CREATE INDEX IF NOT EXISTS idx_kho_sscode ON "KHO"("SS_Code");
      CREATE INDEX IF NOT EXISTS idx_bin_vi_tri_rack_bin ON "BIN_VI_TRI"("Rack", "Bin");
      CREATE INDEX IF NOT EXISTS idx_gd_nhap_ngay ON "GIAO_DICH_NHAP_KHO"("NgayGiaoDich");
      CREATE INDEX IF NOT EXISTS idx_gd_xuat_ngay ON "GIAO_DICH_XUAT_KHO"("NgayGiaoDich");
    `);
    
    console.log('✅ Database schema initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing schema:', err);
    throw err;
  }
}

export default { getDb };
