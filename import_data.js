// Script to import data from SQLite to PostgreSQL
import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { getDb } from './ket_noi_sqlite.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqliteDbPath = path.resolve(__dirname, '../BD.db');

async function importData() {
  try {
    console.log('📦 Starting data import from SQLite to PostgreSQL...');
    
    // Open SQLite database
    const sqliteDb = await open({
      filename: sqliteDbPath,
      driver: sqlite3.Database
    });
    
    // Get PostgreSQL connection
    const pgDb = await getDb();
    
    // Drop and recreate all tables with correct data types
    console.log('🔧 Recreating tables with correct data types...');
    await pgDb.run('DROP TABLE IF EXISTS kho CASCADE');
    await pgDb.run('DROP TABLE IF EXISTS bin_vi_tri CASCADE');
    
    await pgDb.run(`
      CREATE TABLE kho (
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
      )
    `);
    
    await pgDb.run(`
      CREATE TABLE bin_vi_tri (
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
      )
    `);
    
    // Import vật tư (KHO)
    console.log('📥 Importing vật tư...');
    const vatTu = await sqliteDb.all('SELECT * FROM KHO');
    console.log(`Found ${vatTu.length} vật tư records`);
    
    for (const item of vatTu) {
      await pgDb.run(
        `INSERT INTO kho (
          stt, vendor_code, ss_code, hinh_anh, trung, item, type_item, model, 
          don_vi, kho_ok, ton_line, ton_c_tien, ton_muon, kho_ng, tong_ton,
          nguoi_cap_nhat_cuoi, thoi_gian_cap_nhat_cuoi, ton_cho_kiem, min_stock, max_stock
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT DO NOTHING`,
        [
          item.STT, item.Vendor_code, item.SS_Code, item.Hinh_anh, item.Trung,
          item.Item, item.Type_Item, item.Model, item.Don_vi, item.Kho_OK,
          item.Ton_Line, item.Ton_C_Tien, item.Ton_Muon, item.Kho_NG, item.Tong_ton,
          item.Nguoi_Cap_Nhat_Cuoi, item.Thoi_Gian_Cap_Nhat_Cuoi, item.Ton_Cho_Kiem,
          item.Min_Stock, item.Max_Stock
        ]
      );
    }
    console.log(`✅ Imported ${vatTu.length} vật tư records`);
    
    // Import người dùng (NguoiDung)
    console.log('📥 Importing người dùng...');
    try {
      const nguoiDung = await sqliteDb.all('SELECT * FROM NguoiDung');
      console.log(`Found ${nguoiDung.length} user records`);
      
      // Create nguoidung table if not exists
      await pgDb.run(`
        CREATE TABLE IF NOT EXISTS nguoidung (
          id SERIAL PRIMARY KEY,
          manv VARCHAR(50) UNIQUE,
          hoten VARCHAR(255),
          matkhau VARCHAR(255),
          email VARCHAR(255),
          vaitro VARCHAR(50),
          isactive BOOLEAN DEFAULT true
        )
      `);
      
      for (const user of nguoiDung) {
        await pgDb.run(
          `INSERT INTO nguoidung (manv, hoten, matkhau, email, vaitro, isactive)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (manv) DO NOTHING`,
          [
            user.MaNV, user.HoTen, user.MatKhau, user.Email, user.VaiTro, user.IsActive
          ]
        );
      }
      console.log(`✅ Imported ${nguoiDung.length} user records`);
    } catch (err) {
      console.log('⚠️ NguoiDung table not found in SQLite, skipping users');
    }
    
    // Import bin locations (BIN_VI_TRI)
    console.log('📥 Importing bin locations...');
    try {
      const bins = await sqliteDb.all('SELECT * FROM BIN_VI_TRI');
      console.log(`Found ${bins.length} bin records`);
      
      for (const bin of bins) {
        await pgDb.run(
          `INSERT INTO bin_vi_tri (
            stt, rack, bin, vendor_code, ss_code, item, model, type_item,
            ok, ng, stock, don_vi, trang_thai_bin, layout, bin_code, capacity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT DO NOTHING`,
          [
            bin.STT, bin.Rack, bin.Bin, bin.Vendor_code, bin.SS_code, bin.Item,
            bin.Model, bin.Type_Item, bin.OK, bin.NG, bin.Stock, bin.Don_vi,
            bin.Trang_thai_Bin, bin.Layout, bin.Bin_Code, bin.Capacity
          ]
        );
      }
      console.log(`✅ Imported ${bins.length} bin records`);
    } catch (err) {
      console.log('⚠️ BIN_VI_TRI table not found in SQLite, skipping bins');
    }
    
    await sqliteDb.close();
    console.log('✅ Import completed successfully!');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  }
}

importData();
