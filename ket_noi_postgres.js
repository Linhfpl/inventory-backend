// File: backend/ket_noi_postgres.js
// Mô tả: Kết nối tới PostgreSQL (Supabase)

import pg from 'pg';
const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
    
    connectionString = connectionString.trim();
    
    // Try to decode if URL encoded
    try {
      connectionString = decodeURIComponent(connectionString);
    } catch (e) {
      // Already decoded
    }
    
    // Strip query params
    const qIndex = connectionString.indexOf('?');
    if (qIndex > 0) {
      connectionString = connectionString.substring(0, qIndex);
    }
    
    // Normalize scheme
    connectionString = connectionString.replace('postgresql://', 'postgres://');
    
    console.log('🔗 DATABASE_URL length:', connectionString.length);
    console.log('🔗 Has @?', connectionString.includes('@'));
    console.log('🔗 @ index:', connectionString.indexOf('@'));
    console.log('🔗 Full URL:', connectionString);
    
    // Parse: postgres://user:pass@host:port/db
    const schemeEnd = connectionString.indexOf('://') + 3;
    const rest = connectionString.substring(schemeEnd);
    
    const atIndex = rest.lastIndexOf('@');
    if (atIndex === -1) {
      console.error('❌ Cannot parse URL - missing @ separator between auth and host');
      console.error('❌ Please check DATABASE_URL in Render environment variables');
      console.error('❌ Expected format: postgres://user:password@host:port/database');
      throw new Error('Invalid DATABASE_URL format: missing @ separator');
    }
    
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
    console.log('🔧 Initializing database schema...');
    
    // Kiểm tra xem bảng kho đã tồn tại chưa (lowercase)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'kho'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Database schema already exists');
      return;
    }
    
    // Tạo bảng kho (lowercase, không dùng quotes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kho (
        id SERIAL PRIMARY KEY,
        stt INTEGER,
        vendor_code VARCHAR(512),
        ss_code VARCHAR(512),
        hinh_anh VARCHAR(512),
        trung VARCHAR(512),
        item VARCHAR(512),
        type_item VARCHAR(512),
        model VARCHAR(512),
        don_vi VARCHAR(512),
        kho_ok VARCHAR(512),
        ton_line VARCHAR(512),
        ton_c_tien VARCHAR(512),
        ton_muon VARCHAR(512),
        kho_ng VARCHAR(512),
        tong_ton NUMERIC,
        nguoi_cap_nhat_cuoi VARCHAR(512),
        thoi_gian_cap_nhat_cuoi TIMESTAMP,
        ton_cho_kiem NUMERIC DEFAULT 0,
        min_stock NUMERIC DEFAULT 0,
        max_stock NUMERIC DEFAULT 0
      );
    `);
    
    // Tạo bảng bin_vi_tri
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bin_vi_tri (
        id SERIAL PRIMARY KEY,
        stt INTEGER,
        rack VARCHAR(512) NOT NULL,
        bin VARCHAR(512) NOT NULL,
        vendor_code VARCHAR(512),
        ss_code VARCHAR(512),
        item VARCHAR(512),
        model VARCHAR(512),
        type_item VARCHAR(512),
        ok NUMERIC,
        ng NUMERIC,
        stock NUMERIC,
        don_vi VARCHAR(512),
        trang_thai_bin VARCHAR(32) DEFAULT 'Empty',
        layout VARCHAR(50),
        bin_code VARCHAR(150),
        capacity NUMERIC
      );
    `);
    
    // Tạo bảng giao_dich_nhap_kho
    await pool.query(`
      CREATE TABLE IF NOT EXISTS giao_dich_nhap_kho (
        id SERIAL PRIMARY KEY,
        sophieu VARCHAR(100),
        mavattu VARCHAR(100),
        mancc VARCHAR(100),
        tenvattu VARCHAR(255),
        soluong NUMERIC,
        vitri VARCHAR(100),
        nguoithuchien VARCHAR(100),
        khuvucnhan VARCHAR(100),
        ngaygiaodich TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        loaigiaodich VARCHAR(50),
        ghichu TEXT
      );
    `);
    
    // Tạo bảng giao_dich_xuat_kho
    await pool.query(`
      CREATE TABLE IF NOT EXISTS giao_dich_xuat_kho (
        id SERIAL PRIMARY KEY,
        sophieu VARCHAR(100),
        mavattu VARCHAR(100),
        mancc VARCHAR(100),
        tenvattu VARCHAR(255),
        soluong NUMERIC,
        nguoithuchien VARCHAR(100),
        ngaygiaodich TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        loaigiaodich VARCHAR(50),
        ghichu TEXT
      );
    `);
    
    // Tạo bảng log_nghiep_vu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_nghiep_vu (
        id SERIAL PRIMARY KEY,
        loai VARCHAR(50),
        noidung TEXT,
        thoigian TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Tạo indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_kho_sscode_vendor ON kho(ss_code, vendor_code);
      CREATE INDEX IF NOT EXISTS idx_kho_sscode ON kho(ss_code);
      CREATE INDEX IF NOT EXISTS idx_bin_vi_tri_rack_bin ON bin_vi_tri(rack, bin);
      CREATE INDEX IF NOT EXISTS idx_gd_nhap_ngay ON giao_dich_nhap_kho(ngaygiaodich);
      CREATE INDEX IF NOT EXISTS idx_gd_xuat_ngay ON giao_dich_xuat_kho(ngaygiaodich);
    `);
    
    console.log('✅ Database schema initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing schema:', err);
    throw err;
  }
}

export default { getDb };
