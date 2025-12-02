// File: mo_hinh/nhap_kho.js
// Mô tả: Định nghĩa model Nhập kho (Goods Receipt)

class NhapKho {
  constructor({
    so_phieu_nhap, ngay_nhap, ma_vat_tu, ten_vat_tu, so_luong, don_vi, lot_batch, han_su_dung, vi_tri_bin, po_no, supplier, nguoi_nhap, thoi_gian_nhap, trang_thai
  }) {
    this.so_phieu_nhap = so_phieu_nhap; // Số phiếu nhập
    this.ngay_nhap = ngay_nhap; // Ngày nhập kho
    this.ma_vat_tu = ma_vat_tu; // Mã vật tư
    this.ten_vat_tu = ten_vat_tu; // Tên vật tư
    this.so_luong = so_luong; // Số lượng nhập
    this.don_vi = don_vi; // Đơn vị tính
    this.lot_batch = lot_batch; // Số lô/batch
    this.han_su_dung = han_su_dung; // Hạn sử dụng
    this.vi_tri_bin = vi_tri_bin; // Vị trí Bin
    this.po_no = po_no; // Số PO
    this.supplier = supplier; // Nhà cung cấp
    this.nguoi_nhap = nguoi_nhap; // Người nhập
    this.thoi_gian_nhap = thoi_gian_nhap; // Thời gian nhập
    this.trang_thai = trang_thai; // Trạng thái (OK, hết hạn, v.v.)
  }
}

export default NhapKho;
