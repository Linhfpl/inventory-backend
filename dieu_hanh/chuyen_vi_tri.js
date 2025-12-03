// File: dieu_hanh/chuyen_vi_tri.js
// Mô tả: API chuyển vị trí vật tư trong kho

import express from 'express';
import TonKho from '../mo_hinh/ton_kho.js';
const router = express.Router();
import axios from 'axios';

// Giả lập tồn kho (nên thay bằng DB thực tế)
let dsTonKho = [];

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

// API: Chuyển vị trí vật tư
router.post('/', checkRBAC, async (req, res) => {
  const { ma_vat_tu, so_luong, vi_tri_nguon, vi_tri_dich, nguoi_thuc_hien } = req.body;
  if (!ma_vat_tu || !so_luong || !vi_tri_nguon || !vi_tri_dich) {
    return res.status(400).json({ error: 'Thiếu thông tin chuyển vị trí' });
  }
  let db;
  let transactionStarted = false;
  try {
    const { getDb } = await import('../ket_noi_sqlite.js');
    db = await getDb();
    const quantity = Number(so_luong) || 0;
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng chuyển phải lớn hơn 0' });
    }
    // Lấy tồn kho nguồn
    const binNguon = await db.get('SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ? AND SS_code = ?', [vi_tri_nguon, ma_vat_tu]);
    if (!binNguon) {
      return res.status(404).json({ error: 'Không tìm thấy bin nguồn chứa vật tư' });
    }
    const sourceQty = Number(binNguon.OK) || 0;
    if (sourceQty < quantity) {
      return res.status(400).json({ error: 'Không đủ tồn kho ở vị trí nguồn' });
    }
    const remainingSource = sourceQty - quantity;
    await db.run('BEGIN TRANSACTION');
    transactionStarted = true;
    if (remainingSource <= 0) {
      await db.run(
        `UPDATE BIN_VI_TRI
         SET OK = 0,
             Trang_thai_Bin = 'Empty',
             SS_code = NULL,
             Vendor_code = NULL,
             Item = NULL,
             Model = NULL,
             Type_Item = NULL,
             Don_vi = NULL
         WHERE Bin_Code = ? AND SS_code = ?`,
        [vi_tri_nguon, ma_vat_tu]
      );
    } else {
      await db.run(
        'UPDATE BIN_VI_TRI SET OK = ?, Trang_thai_Bin = "Occupied" WHERE Bin_Code = ? AND SS_code = ?',
        [remainingSource, vi_tri_nguon, ma_vat_tu]
      );
    }
    const binDichCungMa = await db.get('SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ? AND SS_code = ?', [vi_tri_dich, ma_vat_tu]);
    if (binDichCungMa) {
      const newDestQty = (Number(binDichCungMa.OK) || 0) + quantity;
      await db.run(
        `UPDATE BIN_VI_TRI
         SET OK = ?,
             Trang_thai_Bin = 'Occupied',
             Vendor_code = COALESCE(Vendor_code, ?),
             Item = COALESCE(Item, ?),
             Model = COALESCE(Model, ?),
             Type_Item = COALESCE(Type_Item, ?),
             Don_vi = COALESCE(Don_vi, ?)
         WHERE Bin_Code = ? AND SS_code = ?`,
        [
          newDestQty,
          binNguon.Vendor_code || null,
          binNguon.Item || null,
          binNguon.Model || null,
          binNguon.Type_Item || null,
          binNguon.Don_vi || null,
          vi_tri_dich,
          ma_vat_tu
        ]
      );
    } else {
      const binDichBatKy = await db.get('SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ?', [vi_tri_dich]);
      if (binDichBatKy) {
        const destCurrent = Number(binDichBatKy.OK) || 0;
        const destTotal = destCurrent + quantity;
        await db.run(
          `UPDATE BIN_VI_TRI
           SET SS_code = ?,
               Vendor_code = ?,
               Item = ?,
               Model = ?,
               Type_Item = ?,
               Don_vi = ?,
               OK = ?,
               Trang_thai_Bin = 'Occupied'
           WHERE Bin_Code = ?`,
          [
            ma_vat_tu,
            binNguon.Vendor_code || null,
            binNguon.Item || null,
            binNguon.Model || null,
            binNguon.Type_Item || null,
            binNguon.Don_vi || null,
            destTotal,
            vi_tri_dich
          ]
        );
      } else {
        const parts = String(vi_tri_dich).split('-');
        const rackCode = binNguon.Rack || parts[0] || null;
        const layoutCode = binNguon.Layout || parts[1] || null;
        const binCode = binNguon.Bin || parts[2] || parts[1] || null;
        await db.run(
          `INSERT INTO BIN_VI_TRI (Rack, Layout, Bin, Bin_Code, Vendor_code, SS_code, Item, Model, Type_Item, Don_vi, OK, NG, Stock, Trang_thai_Bin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Occupied')`,
          [
            rackCode,
            layoutCode,
            binCode,
            vi_tri_dich,
            binNguon.Vendor_code || null,
            ma_vat_tu,
            binNguon.Item || null,
            binNguon.Model || null,
            binNguon.Type_Item || null,
            binNguon.Don_vi || null,
            quantity
          ]
        );
      }
    }
    // Ghi log chuyển vị trí
    await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['CHUYEN_VI_TRI', `Chuyển ${so_luong} ${ma_vat_tu} từ ${vi_tri_nguon} sang ${vi_tri_dich} bởi ${nguoi_thuc_hien}`]);
    await db.run('COMMIT');
    transactionStarted = false;
    const nguonSau = await db.get('SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ?', [vi_tri_nguon]);
    const dichSau = await db.get('SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ?', [vi_tri_dich]);
    res.json({
      message: 'Chuyển vị trí thành công',
      bin_nguon: nguonSau,
      bin_dich: dichSau
    });
  } catch (err) {
    if (transactionStarted && db) {
      try {
        await db.run('ROLLBACK');
      } catch {}
    }
    res.status(500).json({ error: 'Lỗi chuyển vị trí', details: err.message });
  }
});

export default router;
