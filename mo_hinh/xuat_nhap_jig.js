// File: mo_hinh/xuat_nhap_jig.js
// Mô tả: Định nghĩa model Xuất/Nhập JIG

class XuatNhapJig {
  constructor({
    so_phieu, tool_id, ten_jig, nguoi_muon, line_su_dung, muc_dich, thoi_gian_muon, thoi_gian_tra, tong_thoi_gian_su_dung, trang_thai, vi_tri, qua_han
  }) {
    this.so_phieu = so_phieu; // Số phiếu giao dịch
    this.tool_id = tool_id; // Mã JIG
    this.ten_jig = ten_jig; // Tên JIG
    this.nguoi_muon = nguoi_muon; // Người mượn
    this.line_su_dung = line_su_dung; // Line/Mục đích sử dụng
    this.muc_dich = muc_dich; // Mục đích sử dụng
    this.thoi_gian_muon = thoi_gian_muon; // Thời gian mượn
    this.thoi_gian_tra = thoi_gian_tra; // Thời gian trả
    this.tong_thoi_gian_su_dung = tong_thoi_gian_su_dung; // Tổng thời gian sử dụng
    this.trang_thai = trang_thai; // Trạng thái (Đang mượn, Đã trả, Quá hạn...)
    this.vi_tri = vi_tri; // Vị trí hiện tại
    this.qua_han = qua_han; // Cảnh báo quá hạn (true/false)
  }
}

export default XuatNhapJig;
