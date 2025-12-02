// File: mo_hinh/bao_cao.js
// Mô tả: Định nghĩa model Báo cáo

class BaoCao {
  constructor({
    loai_bao_cao, thoi_gian_tu, thoi_gian_den, noi_dung, du_lieu
  }) {
    this.loai_bao_cao = loai_bao_cao; // Loại báo cáo
    this.thoi_gian_tu = thoi_gian_tu; // Thời gian bắt đầu
    this.thoi_gian_den = thoi_gian_den; // Thời gian kết thúc
    this.noi_dung = noi_dung; // Nội dung mô tả
    this.du_lieu = du_lieu; // Dữ liệu báo cáo (có thể là mảng)
  }
}

export default BaoCao;
