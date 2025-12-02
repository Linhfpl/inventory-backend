// File: mo_hinh/bao_duong_jig.js
// Mô tả: Định nghĩa model Bảo dưỡng JIG (PM)

class BaoDuongJig {
  constructor({
    so_pm, tool_id, ten_jig, thoi_gian_bat_dau, thoi_gian_hoan_thanh, linh_kien_thay_the, chi_phi, trang_thai, nguoi_thuc_hien, ghi_chu
  }) {
    this.so_pm = so_pm; // Số phiếu PM
    this.tool_id = tool_id; // Mã JIG
    this.ten_jig = ten_jig; // Tên JIG
    this.thoi_gian_bat_dau = thoi_gian_bat_dau; // Thời gian bắt đầu
    this.thoi_gian_hoan_thanh = thoi_gian_hoan_thanh; // Thời gian hoàn thành
    this.linh_kien_thay_the = linh_kien_thay_the; // Linh kiện thay thế
    this.chi_phi = chi_phi; // Chi phí
    this.trang_thai = trang_thai; // Trạng thái (Đang bảo dưỡng, Đã xong...)
    this.nguoi_thuc_hien = nguoi_thuc_hien; // Người thực hiện
    this.ghi_chu = ghi_chu; // Ghi chú
  }
}

export default BaoDuongJig;
