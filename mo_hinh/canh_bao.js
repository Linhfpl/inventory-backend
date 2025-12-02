// File: mo_hinh/canh_bao.js
// Mô tả: Định nghĩa model Cảnh báo

class CanhBao {
  constructor({
    loai_canh_bao, noi_dung, muc_do, thoi_gian, trang_thai
  }) {
    this.loai_canh_bao = loai_canh_bao; // Loại cảnh báo
    this.noi_dung = noi_dung; // Nội dung cảnh báo
    this.muc_do = muc_do; // Mức độ cảnh báo (Min/Max, Hạn sử dụng, PM JIG...)
    this.thoi_gian = thoi_gian; // Thời gian phát sinh
    this.trang_thai = trang_thai; // Trạng thái (Đã xử lý, Chưa xử lý...)
  }
}

export default CanhBao;
