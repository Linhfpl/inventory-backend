
import express from 'express';
import PheDuyet from '../mo_hinh/phe_duyet.js';
const router = express.Router();
let dsPheDuyet = [];
import { getDb } from '../ket_noi_sqlite.js';
import axios from 'axios';

// Middleware kiểm tra RBAC
async function checkRBAC(req, res, next) {
  try {
    const { MaNV, Action } = req.body;
    if (!MaNV || !Action) return res.status(400).json({ error: 'Thiếu thông tin phân quyền' });
    // Gọi API RBAC nội bộ
    const rbacRes = await axios.post('http://localhost:3000/api/phan-quyen/check', { MaNV, Action });
    if (rbacRes.data && rbacRes.data.allowed) {
      next();
    } else {
      return res.status(403).json({ error: 'Không đủ quyền thực hiện hành động này', role: rbacRes.data.role });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi kiểm tra phân quyền', details: err.message });
  }
}

// API: Lấy danh sách phiếu phê duyệt từ DB
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM PHE_DUYET ORDER BY ThoiGianTao DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn phiếu phê duyệt', details: err.message });
  }
});

// API: Thêm mới phiếu phê duyệt vào DB
router.post('/', checkRBAC, async (req, res) => {
  try {
    const db = await getDb();
    const { so_phe_duyet, noi_dung, nguoi_tao, thoi_gian_tao } = req.body;
    await db.run('INSERT INTO PHE_DUYET (SoPheDuyet, NoiDung, NguoiTao, ThoiGianTao, TrangThai) VALUES (?, ?, ?, ?, ?)', [so_phe_duyet, noi_dung, nguoi_tao, thoi_gian_tao || new Date().toISOString(), 'CHO_DUYET']);
    await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['PHE_DUYET', `Tạo phiếu phê duyệt: ${so_phe_duyet}`]);
    res.status(201).json({ message: 'Đã tạo phiếu phê duyệt', so_phe_duyet });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo phiếu phê duyệt', details: err.message });
  }
});

// API: Duyệt hoặc từ chối phiếu, cập nhật DB
router.put('/:so_phe_duyet', checkRBAC, async (req, res) => {
  try {
    const db = await getDb();
    const { so_phe_duyet } = req.params;
    const { trang_thai, nguoi_phe_duyet, thoi_gian_phe_duyet, ghi_chu } = req.body;
    const result = await db.run('UPDATE PHE_DUYET SET TrangThai = ?, NguoiPheDuyet = ?, ThoiGianPheDuyet = ?, GhiChu = ? WHERE SoPheDuyet = ?', [trang_thai, nguoi_phe_duyet, thoi_gian_phe_duyet || new Date().toISOString(), ghi_chu, so_phe_duyet]);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy phiếu phê duyệt' });
    await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['PHE_DUYET', `Cập nhật phiếu phê duyệt: ${so_phe_duyet}, trạng thái: ${trang_thai}`]);
    res.json({ message: 'Đã cập nhật phiếu phê duyệt', so_phe_duyet, trang_thai });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật phiếu phê duyệt', details: err.message });
  }
});

export default router;

