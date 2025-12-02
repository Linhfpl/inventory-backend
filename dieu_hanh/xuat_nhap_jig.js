// File: dieu_hanh/xuat_nhap_jig.js
// Mô tả: Điều hành các API xuất/nhập JIG


import express from 'express';
import XuatNhapJig from '../mo_hinh/xuat_nhap_jig.js';
const router = express.Router();
let dsXuatNhapJig = [];

// API: Lấy danh sách giao dịch JIG
router.get('/', (req, res) => {
  res.json(dsXuatNhapJig);
});

// API: Thêm mới giao dịch JIG
router.post('/', (req, res) => {
  const gdMoi = new XuatNhapJig(req.body);
  dsXuatNhapJig.push(gdMoi);
  res.status(201).json(gdMoi);
});

// API: Import giao dịch JIG từ Excel (giả lập)
router.post('/import', (req, res) => {
  const danhSach = req.body;
  danhSach.forEach(item => dsXuatNhapJig.push(new XuatNhapJig(item)));
  res.status(201).json({ message: 'Đã import thành công', so_luong: danhSach.length });
});

export default router;
