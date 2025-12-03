// File: dieu_hanh/ton_kho.js
// Mô tả: Điều hành các API tồn kho


import express from 'express';
import TonKho from '../mo_hinh/ton_kho.js';
const router = express.Router();
let dsTonKho = [];

// API: Lấy danh sách tồn kho
router.get('/', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_postgres.js');
    const db = await getDb();
    const rows = await db.all('SELECT * FROM KHO');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn tồn kho', details: err.message });
  }
});

// API: Thêm mới tồn kho
router.post('/', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_postgres.js');
    const db = await getDb();
    const keys = Object.keys(req.body);
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO KHO (${keys.join(',')}) VALUES (${placeholders})`;
    await db.run(sql, values);
    res.status(201).json({ message: 'Đã thêm tồn kho', data: req.body });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thêm tồn kho', details: err.message });
  }
});

// API: Import tồn kho từ Excel (giả lập)
router.post('/import', (req, res) => {
  const danhSach = req.body;
  danhSach.forEach(item => dsTonKho.push(new TonKho(item)));
  res.status(201).json({ message: 'Đã import thành công', so_luong: danhSach.length });
});

export default router;
