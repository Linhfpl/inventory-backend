// File: mo_hinh/jig.js
// Mô tả: Định nghĩa model JIG/Tool

class Jig {
  constructor({
    tool_id, ten_jig, model, trang_thai, vi_tri, chu_ky_bao_duong, gio_hoat_dong, nguoi_cap_nhat_cuoi, thoi_gian_cap_nhat_cuoi
  }) {
    this.tool_id = tool_id; // Mã JIG
    this.ten_jig = ten_jig; // Tên JIG
    this.model = model; // Model sản phẩm liên kết
    this.trang_thai = trang_thai; // Trạng thái
    this.vi_tri = vi_tri; // Vị trí hiện tại
    this.chu_ky_bao_duong = chu_ky_bao_duong; // Chu kỳ PM
    this.gio_hoat_dong = gio_hoat_dong; // Số giờ hoạt động tích lũy
    this.nguoi_cap_nhat_cuoi = nguoi_cap_nhat_cuoi;
    this.thoi_gian_cap_nhat_cuoi = thoi_gian_cap_nhat_cuoi;
  }
}

export default Jig;
