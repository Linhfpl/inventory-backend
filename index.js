import express from 'express';
import phanQuyenRouter from './phan_quyen.js';

const router = express.Router();

// Thêm route cho /api/nguoi-dung (alias cho /api/phan-quyen)
router.use('/nguoi-dung', phanQuyenRouter);

// Thêm route cho /api/nguoi-dung/roles/all (trả về danh sách vai trò mẫu)
router.get('/nguoi-dung/roles/all', async (req, res) => {
  // Có thể lấy từ bảng Roles nếu có, tạm trả mẫu
  res.json([
    { id: 1, name: 'Admin' },
    { id: 2, name: 'Quản lý' },
    { id: 3, name: 'Thủ kho' },
    { id: 4, name: 'Nhân viên' }
  ]);
});

export default router;