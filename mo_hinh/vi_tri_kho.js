// File: mo_hinh/vi_tri_kho.js
// Mô tả: Định nghĩa model Vị trí kho (Warehouse Location)

class ViTriKho {
  constructor({
    ma_kho, ten_kho, ma_ke, ten_ke, ma_bin, ten_bin, cap_bac, mo_ta
  }) {
    this.ma_kho = ma_kho; // Mã kho
    this.ten_kho = ten_kho; // Tên kho
    this.ma_ke = ma_ke; // Mã kệ
    this.ten_ke = ten_ke; // Tên kệ
    this.ma_bin = ma_bin; // Mã bin
    this.ten_bin = ten_bin; // Tên bin
    this.cap_bac = cap_bac; // Cấp bậc (Warehouse > Rack > Bin)
    this.mo_ta = mo_ta; // Mô tả thêm
  }
}

export default ViTriKho;
