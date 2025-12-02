// File: mo_hinh/vat_tu.js
// Mô tả: Định nghĩa model Vật tư

class VatTu {
  constructor({ ma_vat_tu, ten_vat_tu, don_vi_tinh, quy_cach, min_stock, max_stock, lead_time }) {
    this.ma_vat_tu = ma_vat_tu; // Mã vật tư duy nhất
    this.ten_vat_tu = ten_vat_tu;
    this.don_vi_tinh = don_vi_tinh;
    this.quy_cach = quy_cach;
    this.min_stock = min_stock;
    this.max_stock = max_stock;
    this.lead_time = lead_time;
  }
}

export default VatTu;
