// File: dieu_hanh/auth.js
// API đăng nhập, đổi mật khẩu, quên mật khẩu (bỏ qua hash)
import express from 'express';
import { getDb } from '../ket_noi_postgres.js';
const router = express.Router();

// Đăng nhập
router.post('/login', async (req, res) => {
  const { MaNV, MatKhau } = req.body;
  if (!MaNV || !MatKhau) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM nguoidung WHERE manv = $1 AND isactive = true', [MaNV]);
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    if (user.matkhau !== MatKhau) return res.status(401).json({ error: 'Sai mật khẩu' });
    res.json({ message: 'Đăng nhập thành công', user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi đăng nhập', details: err.message });
  }
});

// Đổi mật khẩu
router.post('/change-password', async (req, res) => {
  const { MaNV, MatKhauCu, MatKhauMoi } = req.body;
  if (!MaNV || !MatKhauCu || !MatKhauMoi) return res.status(400).json({ error: 'Thiếu thông tin' });
  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM nguoidung WHERE manv = $1 AND isactive = true', [MaNV]);
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    if (user.matkhau !== MatKhauCu) return res.status(401).json({ error: 'Sai mật khẩu cũ' });
    await db.run('UPDATE nguoidung SET matkhau = $1 WHERE manv = $2', [MatKhauMoi, MaNV]);
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Lỗi đổi mật khẩu', details: err.message });
  }
});

// Quên mật khẩu (giả lập, không gửi email)
router.post('/forgot-password', async (req, res) => {
  const { MaNV, Email, MatKhauMoi } = req.body;
  if (!MaNV || !Email || !MatKhauMoi) return res.status(400).json({ error: 'Thiếu thông tin' });
  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM nguoidung WHERE manv = $1 AND email = $2', [MaNV, Email]);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản hoặc email không khớp' });
    await db.run('UPDATE nguoidung SET matkhau = $1 WHERE manv = $2', [MatKhauMoi, MaNV]);
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Lỗi đặt lại mật khẩu', details: err.message });
  }
});

export default router;
