// File: dieu_hanh/phan_quyen.js
// Mô tả: Điều hành các API phân quyền người dùng


import express from 'express';
import PhanQuyen from '../mo_hinh/phan_quyen.js';
const router = express.Router();
let dsPhanQuyen = [];

// API: Lấy danh sách người dùng
router.get('/', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    const db = await getDb();
    const rows = await db.all('SELECT * FROM USERS');
    // Map lại tên trường cho frontend
    const mapped = rows.map(u => ({
      MaNV: u.ten_dang_nhap || u.MaNV || '',
      HoTen: u.ho_ten || u.HoTen || '',
      Email: u.email || u.Email || '',
      SDT: u.sdt || u.SDT || '',
      ChucDanh: u.chuc_danh || u.ChucDanh || '',
      PhongBan: u.phong_ban || u.PhongBan || '',
      VaiTro: u.vai_tro || u.VaiTro || '',
      TrangThai: u.trang_thai || u.TrangThai || '',
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn người dùng', details: err.message });
  }
});

// API: Thêm mới người dùng
router.post('/', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    const db = await getDb();
    const keys = Object.keys(req.body);
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO USERS (${keys.join(',')}) VALUES (${placeholders})`;
    await db.run(sql, values);
    res.status(201).json({ message: 'Đã thêm người dùng', data: req.body });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thêm người dùng', details: err.message });
  }
});

// API: Import người dùng từ Excel (giả lập)
router.post('/import', (req, res) => {
  const danhSach = req.body;
  danhSach.forEach(item => dsPhanQuyen.push(new PhanQuyen(item)));
  res.status(201).json({ message: 'Đã import thành công', so_luong: danhSach.length });
});

export default router;
