// File: dieu_hanh/vi_tri_kho.js
// Mô tả: Điều hành các API vị trí kho


import express from 'express';
import ViTriKho from '../mo_hinh/vi_tri_kho.js';
const router = express.Router();
let dsViTriKho = [];

// API: Lấy danh sách vị trí kho
router.get('/', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    const db = await getDb();
    const rows = await db.all('SELECT * FROM BIN_VI_TRI');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn vị trí kho', details: err.message });
  }
});

// API: Lấy danh sách bin code có thể dùng để nhập kho
router.get('/available-bins', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    const db = await getDb();
    // Lấy tất cả bin, sắp xếp theo Rack, Bin
    const rows = await db.all(`
      SELECT ID, Bin_Code, Rack, Bin, Layout, SS_code, Item, Trang_thai_Bin, OK, Capacity, Vendor_code
      FROM BIN_VI_TRI 
      WHERE Bin_Code IS NOT NULL 
      ORDER BY Rack, Bin
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn danh sách bin', details: err.message });
  }
});

// API: Thêm mới vị trí kho
router.post('/', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    const db = await getDb();
    const keys = Object.keys(req.body);
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO BIN_VI_TRI (${keys.join(',')}) VALUES (${placeholders})`;
    await db.run(sql, values);
    res.status(201).json({ message: 'Đã thêm vị trí kho', data: req.body });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thêm vị trí kho', details: err.message });
  }
});

// API: Import vị trí kho từ Excel (giả lập)
router.post('/import', (req, res) => {
  const danhSach = req.body;
  danhSach.forEach(item => dsViTriKho.push(new ViTriKho(item)));
  res.status(201).json({ message: 'Đã import thành công', so_luong: danhSach.length });
});

export default router;
