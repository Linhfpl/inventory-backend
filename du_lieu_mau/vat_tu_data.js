// File: backend/du_lieu_mau/vat_tu_data.js
// Mô tả: Chứa dữ liệu mẫu vật tư lấy từ file EQM_DATA.sql (chuyển đổi sang dạng JS)

const data = [
  {
    stt: 1,
    vendor_code: 'M891',
    ss_code: 'Z0000000-571843',
    hinh_anh: '',
    trung: '1',
    item: 'Pin Block SUB PBA A217',
    type_item: 'MRO',
    model: 'A217',
    don_vi: 'PCE',
    kho_ok: 0,
    ton_line: 0,
    ton_c_tien: 0,
    ton_muon: 0,
    kho_ng: 0,
    tong_ton: 0,
    nguoi_cap_nhat_cuoi: '123123',
    thoi_gian_cap_nhat_cuoi: '2025-10-31 09:22:38'
  },
  {
    stt: 2,
    vendor_code: 'M917',
    ss_code: 'Z0000000-943525',
    hinh_anh: '',
    trung: '1',
    item: 'PIN BLOCK FRONT OCTA OPTICAL Model A725',
    type_item: 'MRO',
    model: 'A725',
    don_vi: 'PCE',
    kho_ok: 2,
    ton_line: 0,
    ton_c_tien: 0,
    ton_muon: 0,
    kho_ng: 0,
    tong_ton: 2,
    nguoi_cap_nhat_cuoi: '',
    thoi_gian_cap_nhat_cuoi: ''
  },
  // ...Thêm các dòng dữ liệu khác tương tự ở đây (có thể sinh tự động từ file SQL nếu cần)...
];
export default data;
