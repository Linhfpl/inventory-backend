// File: dieu_hanh/jig.js
// Mô tả: Điều hành các API JIG/Tool


import express from 'express';
import Jig from '../mo_hinh/jig.js';
const router = express.Router();
let dsJig = [];

// API: Lấy danh sách JIG
router.get('/', (req, res) => {
  res.json(dsJig);
});

// API: Thêm mới JIG
router.post('/', (req, res) => {
  const jigMoi = new Jig(req.body);
  dsJig.push(jigMoi);
  res.status(201).json(jigMoi);
});

// API: Import JIG từ Excel (giả lập)
router.post('/import', (req, res) => {
  const danhSach = req.body;
  danhSach.forEach(item => dsJig.push(new Jig(item)));
  res.status(201).json({ message: 'Đã import thành công', so_luong: danhSach.length });
});

export default router;
