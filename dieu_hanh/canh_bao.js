// File: dieu_hanh/canh_bao.js
// Mô tả: Điều hành các API cảnh báo


import express from 'express';
import CanhBao from '../mo_hinh/canh_bao.js';
const router = express.Router();
let dsCanhBao = [];

// API: Lấy danh sách cảnh báo
router.get('/', (req, res) => {
  res.json(dsCanhBao);
});

// API: Thêm mới cảnh báo
router.post('/', (req, res) => {
  const cbMoi = new CanhBao(req.body);
  dsCanhBao.push(cbMoi);
  res.status(201).json(cbMoi);
});

export default router;
