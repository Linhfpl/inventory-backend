// File: dieu_hanh/phan_quyen_rbac.js
// API kiểm tra phân quyền RBAC cho người dùng
import express from 'express';
import { getDb } from '../ket_noi_postgres.js';
const router = express.Router();

// Kiểm tra quyền thực hiện hành động
// POST /api/phan-quyen/check { MaNV, Action }
router.post('/check', async (req, res) => {
  const { MaNV, Action } = req.body;
  if (!MaNV || !Action) return res.status(400).json({ error: 'Thiếu thông tin' });
  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM NguoiDung WHERE MaNV = ? AND IsActive = 1', [MaNV]);
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    const role = await db.get('SELECT * FROM Roles WHERE RoleID = ?', [user.MaQuyen]);
    if (!role) return res.status(403).json({ error: 'Không xác định được vai trò' });
    // Mapping quyền chi tiết cho từng action và RoleID
    const actionRoleMap = {
      // Nhóm Quản trị hệ thống
      'quan_ly_he_thong': [1],
      'quan_ly_user': [1],
      'cau_hinh_he_thong': [1],
      'xem_log': [1],
      // Quản lý công nợ
      'giao_dich_muon_cro': [2],
      'xem_cong_no': [2, 1],
      // Quản lý dữ liệu master
      'quan_ly_danh_muc': [6, 1],
      'them_sua_xoa_item': [6, 1],
      // Nhóm nghiệp vụ kho
      'dieu_chinh_ton_kho': [3, 1],
      'duyet_dieu_chinh_ton_kho': [1, 3],
      'xuat_huy_tieu_hao': [4], // Thủ kho thực hiện, cần phê duyệt
      'duyet_xuat_huy_tieu_hao': [3, 1],
      'nhap_xuat_kho': [3, 4, 1],
      'xuat_line': [4, 1],
      'nhap_line': [4, 1],
      'nhap_line_ng': [4],
      'duyet_ng': [5, 1],
      // Nhóm chuyên môn
      'xem_ton_kho': [5, 7, 1, 3, 4],
      'xem_ton_line': [5, 7, 1, 3, 4],
      'tao_yeu_cau_xuat_line': [7],
      // Quản lý JIG
      'tao_lenh_pm_jig': [4, 1],
      // Quản lý người dùng
      'quan_ly_nguoi_dung': [1],
      // ...bổ sung các action khác nếu cần
    };
    const allowedRoles = actionRoleMap[Action] || [];
    if (allowedRoles.includes(user.MaQuyen)) {
      res.json({ allowed: true, role: role.RoleName });
    } else {
      res.json({ allowed: false, role: role.RoleName });
    }
  } catch (err) {
    res.status(500).json({ error: 'Lỗi kiểm tra quyền', details: err.message });
  }
});

export default router;
