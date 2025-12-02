// File: backend/ket_noi_postgres.js
// Mô tả: Kết nối tới PostgreSQL (Supabase)

import pg from 'pg';
const { Pool } = pg;

let pool = null;

function normalizeConnectionString(raw) {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith('postgresql://')) {
    const converted = 'postgres://' + trimmed.slice('postgresql://'.length);
    console.log('🔁 Converted scheme postgresql:// -> postgres://');
    return converted;
  }
  return trimmed;
}

function logCharCodes(label, str) {
  try {
    const codes = Array.from(str).map(ch => ch.charCodeAt(0));
    console.log(`${label} char codes:`, codes.join(','));
  } catch (e) {
    console.log('⚠️ Failed to log char codes', e);
  }
}

function getPool() {
  if (!pool) {
    let raw = process.env.DATABASE_URL;
    if (!raw) throw new Error('DATABASE_URL environment variable is not set');
    console.log('🔗 Raw env length:', raw.length);
    console.log('🔗 Raw starts:', raw.substring(0, 40));
    logCharCodes('RAW', raw.substring(0, 60));
    const connectionString = normalizeConnectionString(raw);
    console.log('🔗 Normalized length:', connectionString.length);
    console.log('🔗 Normalized starts:', connectionString.substring(0, 40));
    logCharCodes('NORM', connectionString.substring(0, 60));

    // Manual parse after normalization
    let url;
    try {
      url = new URL(connectionString);
    } catch (e) {
      console.error('❌ URL parse failed:', e, 'value:', connectionString);
      throw e;
    }
    console.log('🔍 Parsed host:', url.hostname, 'database path:', url.pathname);
    console.log('🔍 Parsed user:', url.username, 'password length:', url.password.length);

    pool = new Pool({
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
      application_name: 'inventory-backend',
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    });
    console.log('✅ PostgreSQL pool created (manual config)');
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
