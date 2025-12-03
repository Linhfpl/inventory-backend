// File: dieu_hanh/xuat_kho.js
// Mô tả: Điều hành các API xuất kho

import express from 'express';
import XuatKho from '../mo_hinh/xuat_kho.js';
let dsXuatKho = [];
import axios from 'axios';
const router = express.Router();

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

// API: Lấy danh sách phiếu xuất kho
router.get('/', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    const db = await getDb();
    const rows = await db.all('SELECT * FROM GIAO_DICH_XUAT_KHO ORDER BY NgayGiaoDich DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn xuất kho', details: err.message });
  }
});

// API: Lịch sử xuất kho (giới hạn bản ghi gần nhất)
router.get('/lich-su', async (req, res) => {
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    const db = await getDb();
    const rows = await db.all('SELECT * FROM GIAO_DICH_XUAT_KHO ORDER BY NgayGiaoDich DESC LIMIT 50');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn lịch sử xuất kho', details: err.message });
  }
});

// API: Thêm mới phiếu xuất kho
router.post('/', (req, res) => {
  const phieuMoi = new XuatKho(req.body);
  dsXuatKho.push(phieuMoi);
  res.status(201).json(phieuMoi);
});

// API: Import phiếu xuất kho từ Excel (giả lập)
router.post('/import', (req, res) => {
  const danhSach = req.body;
  danhSach.forEach(item => dsXuatKho.push(new XuatKho(item)));
  res.status(201).json({ message: 'Đã import thành công', so_luong: danhSach.length });
});

// API: Ghi nhận xuất kho theo luật nghiệp vụ
router.post('/ghi-nhan', checkRBAC, async (req, res) => {
  try {
    const {
      loai_xuat,
      ma_vat_tu,
      vendor_code,
      so_luong,
      nguoi_xuat,
      uom,
      so_phieu,
      ten_vat_tu,
      so_lo,
      vi_tri,
      han_su_dung,
      khu_vuc_nhan,
      ghi_chu
    } = req.body;
    const db = await (await import('../ket_noi_sqlite.js')).getDb();
    // Lấy tồn kho hiện tại
    const row = await db.get('SELECT * FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [ma_vat_tu, vendor_code]);
    if (!row) {
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['XUAT_KHO', `Không tìm thấy vật tư: ${ma_vat_tu}`]);
      return res.status(404).json({ error: 'Không tìm thấy vật tư' });
    }
    // Kiểm tra đơn vị tính (UoM)
    if (uom && row.UoM && uom !== row.UoM) {
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['XUAT_KHO', `Sai đơn vị tính: ${uom} != ${row.UoM}`]);
      return res.status(400).json({ error: 'Đơn vị tính không khớp', expected: row.UoM, received: uom });
    }
    const currentKhoOK = Number(row.Kho_OK) || 0;
    const currentTonLine = Number(row.Ton_Line) || 0;
    const currentTonCTien = Number(row.Ton_C_Tien ?? row.Ton_C_tien) || 0;
    const currentTonMuon = Number(row.Ton_Muon) || 0;
    const currentKhoNG = Number(row.Kho_NG) || 0;
    const currentTongTon = Number(row.Tong_ton) || 0;
    const quantity = Number(so_luong) || 0;
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng xuất phải lớn hơn 0' });
    }
    // Kiểm tra tồn kho âm
    if (currentKhoOK < quantity) {
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['XUAT_KHO', `Tồn kho không đủ: ${row.Kho_OK} < ${so_luong}`]);
      return res.status(400).json({ error: 'Tồn kho không đủ, không thể xuất âm!' });
    }
    
    // Kiểm tra liên kết giao dịch nhập/xuất: chỉ áp dụng cho xuất line/cải tiến (không áp dụng cho xuất ra ngoài hẳn)
    const isExternalIssue = ['xuat_muon', 'xuat_cro', 'xuat_tieu_hao', 'xuat_huy'].includes(loai_xuat);
    if (!isExternalIssue) {
      const tongNhap = await db.get('SELECT SUM(SoLuong) as TongNhap FROM GIAO_DICH_NHAP_KHO WHERE MaVatTu = ? AND MaNCC = ?', [ma_vat_tu, vendor_code]);
      const tongXuat = await db.get('SELECT SUM(SoLuong) as TongXuat FROM GIAO_DICH_XUAT_KHO WHERE MaVatTu = ? AND MaNCC = ?', [ma_vat_tu, vendor_code]);
      if (tongNhap && tongXuat && (Number(tongXuat.TongXuat || 0) + quantity > Number(tongNhap.TongNhap || 0))) {
        await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['XUAT_KHO', `Xuất vượt tổng số đã nhập: ${Number(tongXuat.TongXuat || 0) + Number(so_luong)} > ${Number(tongNhap.TongNhap || 0)}`]);
        return res.status(400).json({ error: 'Xuất vượt tổng số đã nhập!' });
      }
    }
    const beforeKhoOK = currentKhoOK;
    let new_Kho_OK = currentKhoOK;
    let new_Ton_Line = currentTonLine;
    let new_Ton_C_Tien = currentTonCTien;
    let new_Ton_Muon = currentTonMuon;
    let new_Kho_NG = currentKhoNG;
    let new_Tong_ton = currentTongTon;

    if (['xuat_line', 'xuat_line_sx'].includes(loai_xuat)) {
      new_Kho_OK -= quantity;
      new_Ton_Line += quantity;
    } else if (loai_xuat === 'xuat_cai_tien') {
      // Xuất sang khu vực cải tiến (chuyển từ Kho_OK sang Ton_C_Tien, không giảm tổng)
      new_Kho_OK -= quantity;
      new_Ton_C_Tien += quantity;
    } else if (loai_xuat === 'xuat_cro') {
      // Xuất CRO - xuất ra ngoài hẳn (giảm Kho_OK và Tổng_ton)
      new_Kho_OK -= quantity;
    } else if (loai_xuat === 'tra_cai_tien') {
      // Trả từ khu vực cải tiến về kho
      if (new_Ton_C_Tien < quantity) {
        return res.status(400).json({ error: 'Tồn cải tiến không đủ để trả về kho' });
      }
      new_Ton_C_Tien -= quantity;
      new_Kho_OK += quantity;
    } else if (loai_xuat === 'xuat_muon') {
      // Xuất mượn - xuất ra ngoài hẳn (giảm Kho_OK và Tổng_ton)
      new_Kho_OK -= quantity;
    } else if (loai_xuat === 'xuat_tieu_hao') {
      // Xuất tiêu hao - xuất ra ngoài hẳn (giảm Kho_OK và Tổng_ton)
      new_Kho_OK -= quantity;
    } else if (loai_xuat === 'xuat_huy') {
      // Xuất hủy - xuất ra ngoài hẳn (giảm Kho_OK và Tổng_ton)
      new_Kho_OK -= quantity;
    } else {
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['XUAT_KHO', `Loại xuất không hợp lệ: ${loai_xuat}`]);
      return res.status(400).json({ error: 'Loại xuất không hợp lệ' });
    }
    // Không để giá trị âm cho các kho phụ trợ
    if (new_Ton_Line < 0 || new_Ton_C_Tien < 0 || new_Ton_Muon < 0) {
      return res.status(400).json({ error: 'Số lượng vượt tồn kho phụ trợ (Line/Cải tiến/Mượn)' });
    }
    new_Tong_ton = Math.max(0, new_Kho_OK + new_Ton_Line + new_Ton_C_Tien + new_Ton_Muon + new_Kho_NG);
    // Cập nhật tồn kho - use ID if available
    if (row.ID) {
      await db.run('UPDATE KHO SET Kho_OK = ?, Ton_Line = ?, Ton_C_Tien = ?, Ton_Muon = ?, Kho_NG = ?, Tong_ton = ? WHERE ID = ?',
        [new_Kho_OK, new_Ton_Line, new_Ton_C_Tien, new_Ton_Muon, new_Kho_NG, new_Tong_ton, row.ID]);
    } else {
      await db.run('UPDATE KHO SET Kho_OK = ?, Ton_Line = ?, Ton_C_Tien = ?, Ton_Muon = ?, Kho_NG = ?, Tong_ton = ? WHERE SS_Code = ? AND Vendor_code = ?',
        [new_Kho_OK, new_Ton_Line, new_Ton_C_Tien, new_Ton_Muon, new_Kho_NG, new_Tong_ton, ma_vat_tu, vendor_code]);
    }
    // Ghi nhận giao dịch xuất kho (đầy đủ trường)
    let soPhieu = so_phieu || null;
    if (!soPhieu) {
      const countRow = await db.get('SELECT COUNT(*) as cnt FROM GIAO_DICH_XUAT_KHO');
      const stt = (countRow?.cnt || 0) + 1;
      soPhieu = `XK_${String(stt).padStart(4, '0')}`;
    }
    await db.run(
      `INSERT INTO GIAO_DICH_XUAT_KHO (
        SoPhieu, MaVatTu, MaNCC, TenVatTu, SoLuong, SoLo, ViTri, HanSuDung, NguoiThucHien, KhuVucNhan, NgayGiaoDich, LoaiGiaoDich, GhiChu
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [
        soPhieu,
        ma_vat_tu,
        vendor_code,
        ten_vat_tu || null,
        so_luong,
        so_lo || null,
        vi_tri || null,
        han_su_dung || null,
        nguoi_xuat,
        khu_vuc_nhan || null,
        loai_xuat,
        ghi_chu || null
      ]
    );
    await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['XUAT_KHO', `Ghi nhận xuất kho: ${ma_vat_tu}, ${so_luong}, ${loai_xuat}`]);
    const deltaKhoOK = new_Kho_OK - beforeKhoOK;
    res.json({
      message: 'Đã ghi nhận xuất kho',
      Kho_OK: new_Kho_OK,
      Ton_Line: new_Ton_Line,
      Ton_C_Tien: new_Ton_C_Tien,
      Ton_Muon: new_Ton_Muon,
      Kho_NG: new_Kho_NG,
      Tong_ton: new_Tong_ton,
      inventoryChange: {
        transactionCode: soPhieu,
        transactionType: 'XUAT_KHO',
        timestamp: new Date().toISOString(),
        items: [
          {
            ssCode: ma_vat_tu,
            vendorCode: vendor_code,
            itemName: row.Item || ten_vat_tu || null,
            beforeQuantity: beforeKhoOK,
            deltaQuantity: deltaKhoOK,
            afterQuantity: new_Kho_OK,
            binCode: vi_tri || null
          }
        ]
      }
    });
    // await db.run('COMMIT'); // Nếu dùng row locking
  } catch (err) {
    // Log lỗi chi tiết
    try {
      const db = await (await import('../ket_noi_sqlite.js')).getDb();
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['XUAT_KHO', `Lỗi ghi nhận xuất kho: ${err.message}`]);
    } catch {}
    res.status(500).json({ error: 'Lỗi ghi nhận xuất kho', details: err.message });
  }
});

export default router;
