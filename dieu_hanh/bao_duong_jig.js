// File: dieu_hanh/bao_duong_jig.js
// Mô tả: Điều hành các API bảo dưỡng JIG


import express from 'express';
import BaoDuongJig from '../mo_hinh/bao_duong_jig.js';
const router = express.Router();
let dsBaoDuongJig = [];

// API: Lấy danh sách phiếu bảo dưỡng JIG
router.get('/', (req, res) => {
  res.json(dsBaoDuongJig);
});

// API: Thêm mới phiếu bảo dưỡng JIG
router.post('/', (req, res) => {
  const pmMoi = new BaoDuongJig(req.body);
  dsBaoDuongJig.push(pmMoi);
  res.status(201).json(pmMoi);
});

// API: Import phiếu bảo dưỡng JIG từ Excel (giả lập)
router.post('/import', (req, res) => {
  const danhSach = req.body;
  danhSach.forEach(item => dsBaoDuongJig.push(new BaoDuongJig(item)));
  res.status(201).json({ message: 'Đã import thành công', so_luong: danhSach.length });
});

export default router;
