// File: mo_hinh/ton_kho.js
// Mô tả: Định nghĩa model Tồn kho (Inventory)

class TonKho {
  constructor({
    ma_vat_tu, ten_vat_tu, lot_batch, vi_tri_bin, tong_ton, kho_ok, kho_ng, ton_line, ton_c_tien, ton_muon, nguoi_cap_nhat_cuoi, thoi_gian_cap_nhat_cuoi
  }) {
    this.ma_vat_tu = ma_vat_tu;
    this.ten_vat_tu = ten_vat_tu;
    this.lot_batch = lot_batch;
    this.vi_tri_bin = vi_tri_bin;
    this.tong_ton = tong_ton;
    this.kho_ok = kho_ok;
    this.kho_ng = kho_ng;
    this.ton_line = ton_line;
    this.ton_c_tien = ton_c_tien;
    this.ton_muon = ton_muon;
    this.nguoi_cap_nhat_cuoi = nguoi_cap_nhat_cuoi;
    this.thoi_gian_cap_nhat_cuoi = thoi_gian_cap_nhat_cuoi;
  }
}

export default TonKho;
