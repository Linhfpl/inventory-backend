// File: backend/dieu_hanh/serial_detail.js
import express from 'express';
import { getDb } from '../ket_noi_postgres.js';
const router = express.Router();

// API: Truy vấn thông tin Serial_ID
router.get('/:serial_id', async (req, res) => {
  try {
    const db = await getDb();
    const { serial_id } = req.params;
    const row = await db.get('SELECT * FROM SERIAL_DETAIL WHERE Serial_ID = ?', [serial_id]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy Serial_ID' });
    // Lấy thêm thông tin vật tư từ KHO nếu cần
    const kho = await db.get('SELECT * FROM KHO WHERE SS_Code = ?', [row.SS_Code]);
    res.json({ ...row, kho });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn Serial_ID', details: err.message });
  }
});

// API: Tạo mới Serial_ID (khi nhập kho)
router.post('/', async (req, res) => {
  try {
    const db = await getDb();
    const { Serial_ID, SS_Code, Trung, Vendor_code, Lot_Batch_No, Bin_Code, Trang_thai_Hang, Ngay_Nhap, Expiry_Date, Giao_dich_Cuoi } = req.body;
    await db.run(
      `INSERT INTO SERIAL_DETAIL (Serial_ID, SS_Code, Trung, Vendor_code, Lot_Batch_No, Bin_Code, Trang_thai_Hang, Ngay_Nhap, Expiry_Date, Giao_dich_Cuoi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Serial_ID, SS_Code, Trung, Vendor_code, Lot_Batch_No, Bin_Code, Trang_thai_Hang, Ngay_Nhap, Expiry_Date, Giao_dich_Cuoi]
    );
    res.status(201).json({ message: 'Đã tạo Serial_ID', Serial_ID });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo Serial_ID', details: err.message });
  }
});

export default router;
