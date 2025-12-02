// File: mo_hinh/phe_duyet.js
// Mô tả: Định nghĩa model Phê duyệt giao dịch

class PheDuyet {
  constructor({
    so_phe_duyet, loai_giao_dich, noi_dung, nguoi_de_xuat, nguoi_phe_duyet, thoi_gian_de_xuat, thoi_gian_phe_duyet, trang_thai, ghi_chu
  }) {
    this.so_phe_duyet = so_phe_duyet; // Số phiếu phê duyệt
    this.loai_giao_dich = loai_giao_dich; // Loại giao dịch (Điều chỉnh tồn kho, Thanh lý...)
    this.noi_dung = noi_dung; // Nội dung chi tiết
    this.nguoi_de_xuat = nguoi_de_xuat; // Người đề xuất
    this.nguoi_phe_duyet = nguoi_phe_duyet; // Người phê duyệt
    this.thoi_gian_de_xuat = thoi_gian_de_xuat; // Thời gian đề xuất
    this.thoi_gian_phe_duyet = thoi_gian_phe_duyet; // Thời gian phê duyệt
    this.trang_thai = trang_thai; // Trạng thái (Chờ, Đã duyệt, Từ chối...)
    this.ghi_chu = ghi_chu; // Ghi chú
  }
}

export default PheDuyet;
