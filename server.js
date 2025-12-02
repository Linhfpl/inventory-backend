// File: khoi_tao_server.js
// Mô tả: Khởi tạo server backend cho hệ thống quản lý vật tư & JIG
// Ngôn ngữ: Node.js (Express)

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import duongDan from './duong_dan.js';
import vatTuRouter from './dieu_hanh/vat_tu.js';
import nhapKhoRouter from './dieu_hanh/nhap_kho.js';
import xuatKhoRouter from './dieu_hanh/xuat_kho.js';
import viTriKhoRouter from './dieu_hanh/vi_tri_kho.js';
import tonKhoRouter from './dieu_hanh/ton_kho.js';
import jigRouter from './dieu_hanh/jig.js';
import xuatNhapJigRouter from './dieu_hanh/xuat_nhap_jig.js';
import baoDuongJigRouter from './dieu_hanh/bao_duong_jig.js';
import pheDuyetRouter from './dieu_hanh/phe_duyet.js';
import phanQuyenRouter from './dieu_hanh/phan_quyen.js';

import nguoiDungRouter from './dieu_hanh/nguoi_dung.js';
import baoCaoRouter from './dieu_hanh/bao_cao.js';
import canhBaoRouter from './dieu_hanh/canh_bao.js';

import chuyenViTriRouter from './dieu_hanh/chuyen_vi_tri.js';
import viTriKhoV2Router from './dieu_hanh/vi_tri_kho_v2.js';
import serialDetailRouter from './dieu_hanh/serial_detail.js';
import baoCaoXuatKhoRouter from './dieu_hanh/bao_cao_xuat_kho.js';
import phanQuyenRBACRouter from './dieu_hanh/phan_quyen_rbac.js';
import authRouter from './dieu_hanh/auth.js';
import phanLoaiNhapKhoRouter from './dieu_hanh/phan_loai_nhap_kho.js';
import { getDb } from './ket_noi_sqlite.js';

const app = express();

// Sử dụng middleware chung cho toàn bộ app
app.use(cors());
const bodyLimit = process.env.API_JSON_LIMIT || '100mb';
app.use(bodyParser.json({ limit: bodyLimit }));
app.use(bodyParser.urlencoded({ limit: bodyLimit, extended: true }));

// Phục vụ ảnh vật tư tĩnh từ thư mục frontend src/picture
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pictureDir = path.join(__dirname, '../src/picture');
const cacheDir = path.join(__dirname, '../.cache_images');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

// Pre-index images (ưu tiên jpg > jpeg > png)
const imageIndex = {};
if (fs.existsSync(pictureDir)) {
  const files = fs.readdirSync(pictureDir);
  const priority = ['.jpg', '.jpeg', '.png', '.PNG', '.JPG', '.JPEG'];
  files.forEach(f => {
    const ext = path.extname(f).toLowerCase();
    const base = f.substring(0, f.length - ext.length);
    const baseUpper = base.toUpperCase();
    if (priority.includes(path.extname(f))) {
      // Index both original case and uppercase
      if (!imageIndex[base]) {
        imageIndex[base] = { file: f, extPriority: priority.indexOf(ext) };
      }
      if (!imageIndex[baseUpper]) {
        imageIndex[baseUpper] = { file: f, extPriority: priority.indexOf(ext) };
      }
    }
  });
  app.use('/images', express.static(pictureDir, {
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }));
  
  // Fallback middleware: tự động tìm extension nếu file không tồn tại
  app.use('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const baseName = filename.replace(/\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i, '');
    const extensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];
    
    for (const ext of extensions) {
      const filePath = path.join(pictureDir, baseName + ext);
      if (fs.existsSync(filePath)) {
        console.log(`✅ Found image: ${baseName + ext} for request ${filename}`);
        return res.sendFile(filePath);
      }
    }
    
    console.warn(`❌ Image not found: ${filename} (tried all extensions for ${baseName})`);
    return res.status(404).json({ error: 'Image not found', requested: filename });
  });
  
  console.log(`📁 Indexed ${Object.keys(imageIndex).length / 2} material images.`);
  console.log('First 10 indexed:', Object.keys(imageIndex).slice(0, 20).join(', '));
} else {
  console.warn('⚠️ Folder not found for images:', pictureDir);
}

// Helper: get file path by code với chuẩn hóa và biến thể
function resolveImageByCode(rawCode) {
  if (!rawCode) return null;
  const trimmed = String(rawCode).trim();
  
  // Thử exact match trước
  if (imageIndex[trimmed]) {
    return path.join(pictureDir, imageIndex[trimmed].file);
  }
  
  // Thử uppercase
  const upper = trimmed.toUpperCase();
  if (imageIndex[upper]) {
    return path.join(pictureDir, imageIndex[upper].file);
  }
  
  // Thử cắt phần đầu (trước dấu - hoặc khoảng trắng)
  const firstSegment = upper.split(/[-\s]/)[0];
  if (firstSegment && imageIndex[firstSegment]) {
    return path.join(pictureDir, imageIndex[firstSegment].file);
  }
  
  // Thử loại bỏ ký tự đặc biệt
  const alnum = upper.replace(/[^A-Z0-9]/g, '');
  if (alnum && alnum !== upper && imageIndex[alnum]) {
    return path.join(pictureDir, imageIndex[alnum].file);
  }
  
  return null;
}

// HEAD route để kiểm tra tồn tại ảnh
app.head('/api/hinh-anh/:code', (req, res) => {
  let file = resolveImageByCode(req.params.code);
  if (!file && req.query.ss) file = resolveImageByCode(String(req.query.ss));
  if (!file) return res.sendStatus(404);
  res.setHeader('Content-Type', 'image/' + path.extname(file).substring(1));
  return res.sendStatus(200);
});

// GET ảnh gốc theo mã
app.get('/api/hinh-anh/:code', (req, res) => {
  const code = req.params.code;
  let file = resolveImageByCode(code);
  if (!file && req.query.ss) file = resolveImageByCode(String(req.query.ss));
  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ error: 'Không tìm thấy ảnh cho mã: ' + code });
  }
  return res.sendFile(file);
});

// GET webp chuyển đổi (cache) /api/hinh-anh/:code/webp
app.get('/api/hinh-anh/:code/webp', async (req, res) => {
  const code = req.params.code;
  let srcFile = resolveImageByCode(code);
  if (!srcFile && req.query.ss) srcFile = resolveImageByCode(String(req.query.ss));
  if (!srcFile || !fs.existsSync(srcFile)) {
    return res.status(404).json({ error: 'Không tìm thấy ảnh cho mã: ' + code });
  }
  // Sanitize code cho tên file cache
  const safeName = code.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cached = path.join(cacheDir, safeName + '.webp');
  try {
    if (fs.existsSync(cached)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.sendFile(cached);
    }
    await sharp(srcFile).resize({ width: 256, withoutEnlargement: true }).webp({ quality: 80 }).toFile(cached);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.sendFile(cached);
  } catch (err) {
    console.error('Lỗi chuyển đổi webp:', err.message);
    return res.sendFile(srcFile); // Fallback ảnh gốc
  }
});

// Đăng ký router sau khi đã có middleware
app.use('/api/vi-tri-kho-v2', viTriKhoV2Router);
app.use('/api/serial-detail', serialDetailRouter);
app.use('/api/chuyen-vi-tri', chuyenViTriRouter);

// Đường dẫn API
app.use(duongDan.vat_tu, vatTuRouter);
app.use(duongDan.nhap_kho, nhapKhoRouter);
app.use(duongDan.xuat_kho, xuatKhoRouter);
app.use(duongDan.vi_tri_kho, viTriKhoRouter);
app.use(duongDan.ton_kho, tonKhoRouter);
app.use(duongDan.jig, jigRouter);
app.use(duongDan.xuat_nhap_jig, xuatNhapJigRouter);
app.use(duongDan.bao_duong_jig, baoDuongJigRouter);
app.use(duongDan.phe_duyet, pheDuyetRouter);
app.use(duongDan.phan_quyen, phanQuyenRouter);
app.use(duongDan.nguoi_dung, nguoiDungRouter); // Đảm bảo route này được đăng ký
app.use(duongDan.bao_cao, baoCaoRouter);
app.use(duongDan.canh_bao, canhBaoRouter);
app.use(duongDan.bao_cao_xuat_kho, baoCaoXuatKhoRouter);
app.use(duongDan.auth, authRouter);
app.use(duongDan.phan_quyen_rbac, phanQuyenRBACRouter);
app.use('/api/phan-loai-nhap-kho', phanLoaiNhapKhoRouter);

// Khởi động server
const PORT = process.env.PORT || 3001;

// Khởi tạo database schema trước khi start server
async function initializeServer() {
  try {
    console.log('🔧 Initializing database...');
    const db = await getDb();
    console.log('✅ Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log('==============================');
      console.log('✅ Backend đã khởi động thành công!');
      console.log(`🌐 Truy cập: http://localhost:${PORT}`);
      console.log('Các API chính:');
      Object.entries(duongDan).forEach(([ten, duong]) => {
        console.log(`  - ${ten}: http://localhost:${PORT}${duong}`);
      });
      console.log('==============================');
    });
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

initializeServer();

setInterval(() => {}, 1000 * 60 * 60);

