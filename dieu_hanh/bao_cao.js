// File: dieu_hanh/bao_cao.js
// Mô tả: API báo cáo xuất nhập kho theo loại giao dịch

import express from 'express';
import { getDb } from '../ket_noi_postgres.js';
const router = express.Router();

// API: Báo cáo giao dịch nhập kho theo loại
router.get('/nhap-kho', async (req, res) => {
  try {
    const { loai, tu_ngay, den_ngay } = req.query;
    const db = await getDb();
    
    let sql = `
      SELECT 
        n.*,
        k.Item, k.Model, k.Type_Item, k.Don_vi, k.UoM
      FROM GIAO_DICH_NHAP_KHO n
      LEFT JOIN KHO k ON n.MaVatTu = k.SS_Code AND n.MaNCC = k.Vendor_code
      WHERE 1=1
    `;
    const params = [];
    
    if (loai) {
      sql += ' AND n.LoaiGiaoDich = ?';
      params.push(loai);
    }
    
    if (tu_ngay) {
      sql += ' AND DATE(n.NgayGiaoDich) >= DATE(?)';
      params.push(tu_ngay);
    }
    
    if (den_ngay) {
      sql += ' AND DATE(n.NgayGiaoDich) <= DATE(?)';
      params.push(den_ngay);
    }
    
    sql += ' ORDER BY n.NgayGiaoDich DESC';
    
    const rows = await db.all(sql, params);
    
    // Tính tổng
    const tongSoLuong = rows.reduce((sum, row) => sum + (Number(row.SoLuong) || 0), 0);
    const soGiaoDich = rows.length;
    
    res.json({
      data: rows,
      summary: {
        tongSoLuong,
        soGiaoDich,
        loai: loai || 'Tất cả',
        tuNgay: tu_ngay,
        denNgay: den_ngay
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn báo cáo nhập kho', details: err.message });
  }
});

// API: Báo cáo giao dịch xuất kho theo loại
router.get('/xuat-kho', async (req, res) => {
  try {
    const { loai, tu_ngay, den_ngay } = req.query;
    const db = await getDb();
    
    let sql = `
      SELECT 
        x.*,
        k.Item, k.Model, k.Type_Item, k.Don_vi, k.UoM
      FROM GIAO_DICH_XUAT_KHO x
      LEFT JOIN KHO k ON x.MaVatTu = k.SS_Code AND x.MaNCC = k.Vendor_code
      WHERE 1=1
    `;
    const params = [];
    
    if (loai) {
      sql += ' AND x.LoaiGiaoDich = ?';
      params.push(loai);
    }
    
    if (tu_ngay) {
      sql += ' AND DATE(x.NgayGiaoDich) >= DATE(?)';
      params.push(tu_ngay);
    }
    
    if (den_ngay) {
      sql += ' AND DATE(x.NgayGiaoDich) <= DATE(?)';
      params.push(den_ngay);
    }
    
    sql += ' ORDER BY x.NgayGiaoDich DESC';
    
    const rows = await db.all(sql, params);
    
    // Tính tổng
    const tongSoLuong = rows.reduce((sum, row) => sum + (Number(row.SoLuong) || 0), 0);
    const soGiaoDich = rows.length;
    
    res.json({
      data: rows,
      summary: {
        tongSoLuong,
        soGiaoDich,
        loai: loai || 'Tất cả',
        tuNgay: tu_ngay,
        denNgay: den_ngay
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn báo cáo xuất kho', details: err.message });
  }
});

// API: Thống kê theo loại giao dịch (cho biểu đồ)
router.get('/thong-ke-theo-loai', async (req, res) => {
  try {
    const { tu_ngay, den_ngay, loai_giao_dich } = req.query; // loai_giao_dich: 'nhap' hoặc 'xuat'
    const db = await getDb();
    
    const table = loai_giao_dich === 'nhap' ? 'GIAO_DICH_NHAP_KHO' : 'GIAO_DICH_XUAT_KHO';
    
    let sql = `
      SELECT 
        LoaiGiaoDich,
        COUNT(*) as SoGiaoDich,
        SUM(SoLuong) as TongSoLuong
      FROM ${table}
      WHERE 1=1
    `;
    const params = [];
    
    if (tu_ngay) {
      sql += ' AND DATE(NgayGiaoDich) >= DATE(?)';
      params.push(tu_ngay);
    }
    
    if (den_ngay) {
      sql += ' AND DATE(NgayGiaoDich) <= DATE(?)';
      params.push(den_ngay);
    }
    
    sql += ' GROUP BY LoaiGiaoDich ORDER BY TongSoLuong DESC';
    
    const rows = await db.all(sql, params);
    
    res.json({
      data: rows,
      loaiGiaoDich: loai_giao_dich,
      tuNgay: tu_ngay,
      denNgay: den_ngay
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi thống kê theo loại', details: err.message });
  }
});

// API: Top vật tư xuất/nhập nhiều nhất
router.get('/top-vat-tu', async (req, res) => {
  try {
    const { tu_ngay, den_ngay, loai_giao_dich, loai, limit = 10 } = req.query;
    const db = await getDb();
    
    const table = loai_giao_dich === 'nhap' ? 'GIAO_DICH_NHAP_KHO' : 'GIAO_DICH_XUAT_KHO';
    
    let sql = `
      SELECT 
        g.MaVatTu,
        g.MaNCC,
        g.TenVatTu,
        k.Item,
        k.Model,
        k.Type_Item,
        COUNT(*) as SoLanGiaoDich,
        SUM(g.SoLuong) as TongSoLuong
      FROM ${table} g
      LEFT JOIN KHO k ON g.MaVatTu = k.SS_Code AND g.MaNCC = k.Vendor_code
      WHERE 1=1
    `;
    const params = [];
    
    if (loai) {
      sql += ' AND g.LoaiGiaoDich = ?';
      params.push(loai);
    }
    
    if (tu_ngay) {
      sql += ' AND DATE(g.NgayGiaoDich) >= DATE(?)';
      params.push(tu_ngay);
    }
    
    if (den_ngay) {
      sql += ' AND DATE(g.NgayGiaoDich) <= DATE(?)';
      params.push(den_ngay);
    }
    
    sql += ' GROUP BY g.MaVatTu, g.MaNCC ORDER BY TongSoLuong DESC LIMIT ?';
    params.push(Number(limit));
    
    const rows = await db.all(sql, params);
    
    res.json({
      data: rows,
      loaiGiaoDich: loai_giao_dich,
      loai,
      limit: Number(limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn top vật tư', details: err.message });
  }
});

export default router;
