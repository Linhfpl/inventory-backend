// File: dieu_hanh/nguoi_dung.js
// API CRUD cho bảng NguoiDung và Roles
import express from 'express';
import { getDb } from '../ket_noi_postgres.js';
const router = express.Router();

// Lấy danh sách người dùng
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM NguoiDung');
    // Map lại tên trường cho frontend
    const mapped = rows.map(u => ({
      MaNV: u.MaNV || '',
      HoTen: u.HoTen || '',
      MatKhau: u.MatKhau || '',
      SDT: u.SDT || '',
      ChucDanh: u.ChucDanh || '',
      PhongBan: u.PhongBan || '',
      VaiTro: u.VaiTro || '',
      TrangThai: u.IsActive === 1 ? 'Hoạt động' : 'Khóa',
      NgayTao: u.NgayTao || ''
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn', details: err.message });
  }
});

// Lấy chi tiết 1 người dùng
router.get('/:maNV', async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT * FROM NguoiDung WHERE MaNV = ?', [req.params.maNV]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn', details: err.message });
  }
});

// Thêm mới người dùng
router.post('/', async (req, res) => {
  try {
    const db = await getDb();
    const keys = Object.keys(req.body);
    const values = keys.map(k => req.body[k]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO NguoiDung (${keys.join(',')}) VALUES (${placeholders})`;
    await db.run(sql, values);
    res.status(201).json({ message: 'Đã thêm người dùng', data: req.body });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thêm người dùng', details: err.message });
  }
});

// Sửa thông tin người dùng
router.put('/:maNV', async (req, res) => {
  try {
    const db = await getDb();
    const keys = Object.keys(req.body).filter(k => k !== 'MaNV');
    if (keys.length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật' });
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => req.body[k]);
    values.push(req.params.maNV);
    const sql = `UPDATE NguoiDung SET ${setClause} WHERE MaNV = ?`;
    const result = await db.run(sql, values);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng để cập nhật' });
    res.json({ message: 'Đã cập nhật người dùng' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật', details: err.message });
  }
});

// Xóa người dùng
router.delete('/:maNV', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM NguoiDung WHERE MaNV = ?', [req.params.maNV]);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng để xóa' });
    res.json({ message: 'Đã xóa người dùng' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa', details: err.message });
  }
});

// Lấy danh sách roles
router.get('/roles/all', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM Roles');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn roles', details: err.message });
  }
});

export default router;
