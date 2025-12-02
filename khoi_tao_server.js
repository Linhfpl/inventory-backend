// File: khoi_tao_server.js
// Mô tả: Khởi tạo server backend cho hệ thống quản lý vật tư & JIG
// Ngôn ngữ: Node.js (Express)

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import duongDan from './duong_dan.js';
import vatTuRouter from './dieu_hanh/vat_tu.js';
import nhapKhoRouter from './dieu_hanh/nhap_kho.js';
import xuatKhoRouter from './dieu_hanh/xuat_kho.js';
import viTriKhoRouter from './dieu_hanh/vi_tri_kho.js';
import tonKhoRouter from './dieu_hanh/ton_kho.js';
import jigRouter from './dieu_hanh/jig.js';
import xuatNhapJigRouter from './dieu_hanh/xuat_nhap_jig.js';
import baoDuongJigRouter from './dieu_hanh/bao_duong_jig.js';
import pheDuyetRouter from './dieu_hanh/phe_duyet.js';
import phanQuyenRouter from './dieu_hanh/phan_quyen.js';

import nguoiDungRouter from './dieu_hanh/nguoi_dung.js';
import baoCaoRouter from './dieu_hanh/bao_cao.js';
import canhBaoRouter from './dieu_hanh/canh_bao.js';

import chuyenViTriRouter from './dieu_hanh/chuyen_vi_tri.js';
import viTriKhoV2Router from './dieu_hanh/vi_tri_kho_v2.js';
import serialDetailRouter from './dieu_hanh/serial_detail.js';
import baoCaoXuatKhoRouter from './dieu_hanh/bao_cao_xuat_kho.js';
import phanQuyenRBACRouter from './dieu_hanh/phan_quyen_rbac.js';
import authRouter from './dieu_hanh/auth.js';

const app = express();

// Sử dụng middleware chung cho toàn bộ app
app.use(cors());
app.use(bodyParser.json());

// Đăng ký router sau khi đã có middleware
app.use('/api/vi-tri-kho-v2', viTriKhoV2Router);
app.use('/api/serial-detail', serialDetailRouter);
app.use('/api/chuyen-vi-tri', chuyenViTriRouter);

// Đường dẫn API
app.use(duongDan.vat_tu, vatTuRouter);
app.use(duongDan.nhap_kho, nhapKhoRouter);
app.use(duongDan.xuat_kho, xuatKhoRouter);
app.use(duongDan.vi_tri_kho, viTriKhoRouter);
app.use(duongDan.ton_kho, tonKhoRouter);
app.use(duongDan.jig, jigRouter);
app.use(duongDan.xuat_nhap_jig, xuatNhapJigRouter);
app.use(duongDan.bao_duong_jig, baoDuongJigRouter);
app.use(duongDan.phe_duyet, pheDuyetRouter);
app.use(duongDan.phan_quyen, phanQuyenRouter);
app.use(duongDan.nguoi_dung, nguoiDungRouter); // Đảm bảo route này được đăng ký
app.use(duongDan.bao_cao, baoCaoRouter);
app.use(duongDan.canh_bao, canhBaoRouter);
app.use(duongDan.bao_cao_xuat_kho, baoCaoXuatKhoRouter);
app.use(duongDan.auth, authRouter);
app.use(duongDan.phan_quyen_rbac, phanQuyenRBACRouter);

// Khởi động server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('==============================');
  console.log('✅ Backend đã khởi động thành công!');
  console.log(`🌐 Truy cập: http://localhost:${PORT}`);
  console.log('Các API chính:');
  Object.entries(duongDan).forEach(([ten, duong]) => {
    console.log(`  - ${ten}: http://localhost:${PORT}${duong}`);
  });
  console.log('==============================');
});
