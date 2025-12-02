// File: mo_hinh/phan_quyen.js
// Mô tả: Định nghĩa model Phân quyền người dùng

class PhanQuyen {
  constructor({
    ten_dang_nhap, ho_ten, vai_tro, mat_khau, trang_thai
  }) {
    this.ten_dang_nhap = ten_dang_nhap; // Tên đăng nhập
    this.ho_ten = ho_ten; // Họ tên
    this.vai_tro = vai_tro; // Vai trò (Thủ kho, Quản lý, Admin...)
    this.mat_khau = mat_khau; // Mật khẩu (hash)
    this.trang_thai = trang_thai; // Trạng thái (Hoạt động, Khóa...)
  }
}

export default PhanQuyen;
