// File: dieu_hanh/bao_cao_xuat_kho.js
// API báo cáo xuất kho, lọc theo ngày/tuần/tháng, xuất Excel
import express from 'express';
import { getDb } from '../ket_noi_sqlite.js';
import ExcelJS from 'exceljs';
const router = express.Router();

// Lấy báo cáo xuất kho, lọc theo ngày/tuần/tháng
router.get('/', async (req, res) => {
  const { tuNgay, denNgay } = req.query;
  try {
    const db = await getDb();
    let sql = 'SELECT * FROM GIAO_DICH_XUAT_KHO WHERE 1=1';
    const params = [];
    if (tuNgay) {
      sql += ' AND DATE(NgayGiaoDich) >= DATE(?)';
      params.push(tuNgay);
    }
    if (denNgay) {
      sql += ' AND DATE(NgayGiaoDich) <= DATE(?)';
      params.push(denNgay);
    }
    sql += ' ORDER BY NgayGiaoDich DESC';
    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn báo cáo', details: err.message });
  }
});

// Xuất Excel báo cáo xuất kho
router.get('/excel', async (req, res) => {
  const { tuNgay, denNgay } = req.query;
  try {
    const db = await getDb();
    let sql = 'SELECT * FROM GIAO_DICH_XUAT_KHO WHERE 1=1';
    const params = [];
    if (tuNgay) {
      sql += ' AND DATE(NgayGiaoDich) >= DATE(?)';
      params.push(tuNgay);
    }
    if (denNgay) {
      sql += ' AND DATE(NgayGiaoDich) <= DATE(?)';
      params.push(denNgay);
    }
    sql += ' ORDER BY NgayGiaoDich DESC';
    const rows = await db.all(sql, params);

    // Tạo file Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('BaoCao_Xuat_YouSung');
    sheet.columns = [
      { header: 'Số phiếu', key: 'SoPhieu', width: 15 },
      { header: 'Mã vật tư', key: 'MaVatTu', width: 20 },
      { header: 'Tên vật tư', key: 'TenVatTu', width: 30 },
      { header: 'Số lượng', key: 'SoLuong', width: 10 },
      { header: 'Số lô', key: 'SoLo', width: 15 },
      { header: 'Vị trí', key: 'ViTri', width: 15 },
      { header: 'Hạn sử dụng', key: 'HanSuDung', width: 15 },
      { header: 'Người thực hiện', key: 'NguoiThucHien', width: 20 },
      { header: 'Khu vực nhận', key: 'KhuVucNhan', width: 20 },
      { header: 'Ngày giao dịch', key: 'NgayGiaoDich', width: 20 },
      { header: 'Ghi chú', key: 'GhiChu', width: 20 },
    ];
    rows.forEach(row => sheet.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=BaoCao_Xuat_YouSung.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xuất Excel', details: err.message });
  }
});

export default router;
