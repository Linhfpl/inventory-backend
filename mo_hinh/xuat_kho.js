// File: mo_hinh/xuat_kho.js
// Mô tả: Định nghĩa model Xuất kho (Goods Issue)

class XuatKho {
  constructor({
    so_phieu_xuat, ngay_xuat, ma_vat_tu, ten_vat_tu, so_luong, don_vi, lot_batch, han_su_dung, vi_tri_bin, work_order, nguoi_xuat, thoi_gian_xuat, trang_thai
  }) {
    this.so_phieu_xuat = so_phieu_xuat; // Số phiếu xuất
    this.ngay_xuat = ngay_xuat; // Ngày xuất kho
    this.ma_vat_tu = ma_vat_tu; // Mã vật tư
    this.ten_vat_tu = ten_vat_tu; // Tên vật tư
    this.so_luong = so_luong; // Số lượng xuất
    this.don_vi = don_vi; // Đơn vị tính
    this.lot_batch = lot_batch; // Số lô/batch
    this.han_su_dung = han_su_dung; // Hạn sử dụng
    this.vi_tri_bin = vi_tri_bin; // Vị trí Bin
    this.work_order = work_order; // Số Work Order hoặc Picking List
    this.nguoi_xuat = nguoi_xuat; // Người xuất
    this.thoi_gian_xuat = thoi_gian_xuat; // Thời gian xuất
    this.trang_thai = trang_thai; // Trạng thái (OK, hết hạn, v.v.)
  }
}

export default XuatKho;
