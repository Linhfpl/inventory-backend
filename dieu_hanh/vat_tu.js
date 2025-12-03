import express from 'express';
import { getDb } from '../ket_noi_postgres.js';
import axios from 'axios';
const router = express.Router();

const DECISION_SEPARATOR = '::';
const STATIC_UPDATE_FIELDS = ['Item', 'Trung', 'Model', 'Type_Item', 'Don_vi', 'Vendor_code'];
const NUMERIC_FIELDS = ['Kho_OK', 'Ton_Line', 'Ton_C_Tien', 'Ton_Muon', 'Kho_NG', 'Tong_ton', 'Min_Stock', 'Max_Stock', 'Trung'];
const INSERT_ALLOWED_FIELDS = [
  'SS_Code',
  'Vendor_code',
  'Item',
  'Type_Item',
  'Model',
  'Don_vi',
  'UoM',
  'Kho_OK',
  'Ton_Line',
  'Ton_C_Tien',
  'Ton_Muon',
  'Kho_NG',
  'Tong_ton',
  'Min_Stock',
  'Max_Stock',
  'Trung',
  'Hinh_anh',
  'Ghi_chu',
  'Nguoi_Cap_Nhat_Cuoi',
  'Thoi_Gian_Cap_Nhat_Cuoi'
];

const FIELD_ALIAS_MAP = new Map([
  ['ss_code', 'SS_Code'],
  ['ss code', 'SS_Code'],
  ['sscode', 'SS_Code'],
  ['s.s code', 'SS_Code'],
  ['ma_vat_tu', 'SS_Code'],
  ['mã vật tư', 'SS_Code'],
  ['code', 'SS_Code'],
  ['vendor_code', 'Vendor_code'],
  ['vendor code', 'Vendor_code'],
  ['vendorcode', 'Vendor_code'],
  ['mã ncc', 'Vendor_code'],
  ['ma_ncc', 'Vendor_code'],
  ['item', 'Item'],
  ['ten_vat_tu', 'Item'],
  ['ten vat tu', 'Item'],
  ['type_item', 'Type_Item'],
  ['type item', 'Type_Item'],
  ['typeitem', 'Type_Item'],
  ['model', 'Model'],
  ['don_vi', 'Don_vi'],
  ['don vi', 'Don_vi'],
  ['donvi', 'Don_vi'],
  ['đơn vị', 'Don_vi'],
  ['uom', 'UoM'],
  ['kho_ok', 'Kho_OK'],
  ['kho ok', 'Kho_OK'],
  ['khook', 'Kho_OK'],
  ['ton_line', 'Ton_Line'],
  ['ton line', 'Ton_Line'],
  ['tồn line', 'Ton_Line'],
  ['tonline', 'Ton_Line'],
  ['ton_c_tien', 'Ton_C_Tien'],
  ['ton c tien', 'Ton_C_Tien'],
  ['tonctien', 'Ton_C_Tien'],
  ['tồn c.tiến', 'Ton_C_Tien'],
  ['tồn c tiến', 'Ton_C_Tien'],
  ['ton_muon', 'Ton_Muon'],
  ['ton muon', 'Ton_Muon'],
  ['tồn mượn', 'Ton_Muon'],
  ['tonmuon', 'Ton_Muon'],
  ['kho_ng', 'Kho_NG'],
  ['kho ng', 'Kho_NG'],
  ['khong', 'Kho_NG'],
  ['tong_ton', 'Tong_ton'],
  ['tong ton', 'Tong_ton'],
  ['tổng tồn', 'Tong_ton'],
  ['tongton', 'Tong_ton'],
  ['min_stock', 'Min_Stock'],
  ['min stock', 'Min_Stock'],
  ['max_stock', 'Max_Stock'],
  ['max stock', 'Max_Stock'],
  ['trung', 'Trung'],
  ['trùng', 'Trung'],
  ['hinh_anh', 'Hinh_anh'],
  ['hình ảnh', 'Hinh_anh'],
  ['ghi_chu', 'Ghi_chu']
]);

function buildDecisionKey(ssCode, vendor, index) {
  const base = vendor ? `${ssCode}${DECISION_SEPARATOR}${vendor}` : ssCode;
  const suffix = index !== undefined && index !== null ? `${DECISION_SEPARATOR}idx${index}` : '';
  return base + suffix;
}

function toSafeNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function normaliseFieldName(name) {
  return name
    ? name
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    : '';
}

function normaliseKhoRecord(raw, index) {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Dòng dữ liệu không hợp lệ', index, raw };
  }
  const normalisedEntries = new Map();
  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = normaliseFieldName(key);
    if (!normalizedKey) return;
    normalisedEntries.set(normalizedKey, value);
  });

  const record = { __index: index };
  for (const [alias, field] of FIELD_ALIAS_MAP.entries()) {
    if (!normalisedEntries.has(alias)) continue;
    const value = normalisedEntries.get(alias);
    if (NUMERIC_FIELDS.includes(field)) {
      record[field] = toSafeNumber(value);
    } else {
      const text = value === null || value === undefined ? '' : String(value).trim();
      if (text.length > 0) {
        record[field] = text;
      }
    }
  }

  const ssCode = record.SS_Code ? String(record.SS_Code).trim() : '';
  if (!ssCode) {
    record.SS_Code = `__AUTO_${index}`;
  } else {
    record.SS_Code = ssCode;
  }

  if (record.Vendor_code !== undefined) {
    const vendor = record.Vendor_code === null ? '' : String(record.Vendor_code).trim();
    record.Vendor_code = vendor.length ? vendor : null;
  } else {
    record.Vendor_code = null;
  }

  NUMERIC_FIELDS.forEach((field) => {
    if (record[field] === undefined || record[field] === null || Number.isNaN(record[field])) {
      record[field] = 0;
    }
  });
  record.Tong_ton = toSafeNumber(record.Tong_ton);
  if (record.Tong_ton === 0) {
    record.Tong_ton = record.Kho_OK + record.Ton_Line + record.Ton_C_Tien + record.Ton_Muon + record.Kho_NG;
  }

  record.__key = buildDecisionKey(record.SS_Code, record.Vendor_code, index);
  return { record };
}

async function resolveExistingKho(db, record) {
  // First try STT lookup if available
  if (record.STT) {
    const row = await db.get('SELECT * FROM KHO WHERE STT = ?', [record.STT]);
    if (row) {
      return { status: 'match', row };
    }
  }
  
  // Then try SS_Code + Vendor_code lookup
  if (record.Vendor_code) {
    const match = await db.get('SELECT * FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [record.SS_Code, record.Vendor_code]);
    if (match) {
      return { status: 'match', row: match };
    }
  } else {
    // If no Vendor_code, check SS_Code with null Vendor_code
    const match = await db.get('SELECT * FROM KHO WHERE SS_Code = ? AND (Vendor_code IS NULL OR Vendor_code = "")', [record.SS_Code]);
    if (match) {
      return { status: 'match', row: match };
    }
  }
  
  // If no exact match found, this is a new record
  return { status: 'not-found' };
}

function buildInsertPayload(record) {
  const payload = {};
  INSERT_ALLOWED_FIELDS.forEach((field) => {
    if (field === 'Vendor_code') {
      if (record.Vendor_code) {
        payload.Vendor_code = record.Vendor_code;
      }
      return;
    }
    if (NUMERIC_FIELDS.includes(field)) {
      payload[field] = toSafeNumber(record[field]);
      return;
    }
    if (record[field] !== undefined && record[field] !== null) {
      const text = String(record[field]).trim();
      if (text.length) {
        payload[field] = text;
      }
    }
  });
  payload.SS_Code = record.SS_Code;
  payload.Kho_OK = toSafeNumber(payload.Kho_OK);
  payload.Ton_Line = toSafeNumber(payload.Ton_Line);
  payload.Ton_C_Tien = toSafeNumber(payload.Ton_C_Tien);
  payload.Ton_Muon = toSafeNumber(payload.Ton_Muon);
  payload.Kho_NG = toSafeNumber(payload.Kho_NG);
  payload.Tong_ton = payload.Kho_OK + payload.Ton_Line + payload.Ton_C_Tien + payload.Ton_Muon + payload.Kho_NG;
  return payload;
}

function buildUpdatePayload(record) {
  const payload = {};
  STATIC_UPDATE_FIELDS.forEach((field) => {
    if (record[field] === undefined || record[field] === null) return;
    const text = String(record[field]).trim();
    if (!text.length) return;
    payload[field] = field === 'Trung' ? toSafeNumber(text) : text;
  });
  return payload;
}
// API: Lấy cảnh báo tồn kho dưới min/max và nhập NG
router.get('/canh-bao-ton-kho', async (req, res) => {
  try {
    const db = await getDb();
    // Cảnh báo tồn kho dưới min
    const minRows = await db.all('SELECT * FROM KHO WHERE Kho_OK < Min_Stock');
    // Cảnh báo tồn kho vượt max
    const maxRows = await db.all('SELECT * FROM KHO WHERE Kho_OK > Max_Stock');
    // Cảnh báo nhập NG
    const ngRows = await db.all('SELECT * FROM NG_PHES_PHAM WHERE NgayGhiNhan >= DATE("now", "-7 day")');
    res.json({ canhBaoMin: minRows, canhBaoMax: maxRows, canhBaoNG: ngRows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn cảnh báo tồn kho', details: err.message });
  }
});

// Middleware kiểm tra RBAC (env-configurable and optional)
async function checkRBAC(req, res, next) {
  try {
    const { MaNV, Action } = req.body;
    if (!MaNV || !Action) return res.status(400).json({ error: 'Thiếu thông tin phân quyền' });
    const baseUrl = process.env.RBAC_URL;
    if (!baseUrl) {
      // No external RBAC configured: allow by default
      return next();
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/phan-quyen/check`;
    const rbacRes = await axios.post(url, { MaNV, Action });
    if (rbacRes.data && rbacRes.data.allowed) {
      next();
    } else {
      return res.status(403).json({ error: 'Không đủ quyền thực hiện hành động này', role: rbacRes.data?.role });
    }
  } catch (err) {
    // If RBAC server unreachable, fail open to avoid cloud crash
    return next();
  }
}
// API: Chuyển vị trí Serial_ID giữa hai Bin
router.post('/serial-detail/transfer', async (req, res) => {
  try {
    const { serial_id, bin_old, bin_new } = req.body;
    const db = await getDb();
    // Kiểm tra Serial_ID đúng Bin cũ
    const serial = await db.get('SELECT * FROM SERIAL_DETAIL WHERE Serial_ID = ?', [serial_id]);
    if (!serial) return res.status(404).json({ error: 'Serial_ID không tồn tại!' });
    if (serial.Bin_Code !== bin_old) return res.status(400).json({ error: 'Serial_ID không nằm ở Bin cũ!' });
    // Cập nhật Bin_Code mới
    await db.run('UPDATE SERIAL_DETAIL SET Bin_Code = ? WHERE Serial_ID = ?', [bin_new, serial_id]);
    res.json({ message: 'Chuyển vị trí thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi chuyển vị trí Serial', details: err.message });
  }
});
// API: Lấy Picking List (FEFO/FIFO)
router.get('/picking-list', async (req, res) => {
  try {
    const { ss_code, vendor_code, so_luong } = req.query;
    const db = await getDb();
    // FEFO/FIFO: Ưu tiên Serial/Lot có hạn sử dụng sớm nhất hoặc nhập trước
    const pickingList = await db.all(`SELECT s.Serial_ID, s.Lot_Batch_No, s.Bin_Code, s.Expiry_Date FROM SERIAL_DETAIL s WHERE s.SS_Code = ? AND s.Trang_thai_Hang = 'OK' ORDER BY s.Expiry_Date ASC, s.Serial_ID ASC LIMIT ?`, [ss_code, so_luong]);
    // Lấy lộ trình Bin (theo thứ tự xuất hiện)
    const binRoute = pickingList.map(s => s.Bin_Code);
    res.json({ pickingList, binRoute });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy Picking List', details: err.message });
  }
});

// API: Xuất kho GI chuẩn nghiệp vụ
router.post('/xuat-kho/gi', async (req, res) => {
  try {
    const { ss_code, vendor_code, serials } = req.body;
    const db = await getDb();
    // 1. Kiểm tra Serial_ID hợp lệ
    for (const serial of serials) {
      const serialRow = await db.get('SELECT * FROM SERIAL_DETAIL WHERE Serial_ID = ? AND SS_Code = ? AND Trang_thai_Hang = "OK"', [serial, ss_code]);
      if (!serialRow) return res.status(400).json({ error: `Serial ${serial} không hợp lệ hoặc đã xuất!` });
    }
    // 2. Trừ tồn kho
    await db.run('UPDATE KHO SET Kho_OK = Kho_OK - ?, Tong_ton = Tong_ton - ? WHERE SS_Code = ? AND Vendor_code = ?', [serials.length, serials.length, ss_code, vendor_code]);
    // 3. Cập nhật trạng thái Serial
    for (const serial of serials) {
      await db.run('UPDATE SERIAL_DETAIL SET Trang_thai_Hang = "ISSUED" WHERE Serial_ID = ?', [serial]);
    }
    // 4. Trừ số lượng Bin
    for (const serial of serials) {
      const binRow = await db.get('SELECT Bin_Code FROM SERIAL_DETAIL WHERE Serial_ID = ?', [serial]);
      if (binRow && binRow.Bin_Code) {
        await db.run('UPDATE BIN_VI_TRI SET OK = OK - 1 WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?', [binRow.Bin_Code, ss_code, vendor_code]);
      }
    }
    // 5. Ghi nhận giao dịch xuất kho
    await db.run('INSERT INTO BIN_LOT_DETAIL (Rack, Layout, Bin, Vendor_code, SS_code, Lot, So_Luong, Loai_Giao_Dich, Nguoi_Thuc_Hien) VALUES (?, ?, ?, ?, ?, ?, ?, "PICKING", ?)', [null, null, null, vendor_code, ss_code, null, serials.length, 'System']);
    res.json({ message: 'Xuất kho thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xuất kho GI', details: err.message });
  }
});
// API: Check SS_Code tồn tại trong KHO
router.get('/check-sscode', async (req, res) => {
  try {
    const { ss_code } = req.query;
    const db = await getDb();
    const row = await db.get('SELECT 1 FROM KHO WHERE SS_Code = ?', [ss_code]);
    res.json({ exists: !!row });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi kiểm tra SS_Code', details: err.message });
  }
});

// API: Nhập kho GR chuẩn nghiệp vụ
router.post('/nhap-kho/gr', checkRBAC, async (req, res) => {
  try {
    const { poNo, vendor_code, ss_code, lot, expiry, serials, bin_code, qc_pass } = req.body;
    if (!qc_pass) return res.status(400).json({ error: 'Chưa QC Pass!' });
    const db = await getDb();
    // 1. Kiểm tra SS_Code
    const row = await db.get('SELECT * FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [ss_code, vendor_code]);
    if (!row) return res.status(400).json({ error: 'SS_Code chưa có trong KHO!' });
    // 2. Thêm từng serial vào SERIAL_DETAIL
    for (const serial of serials) {
      await db.run('INSERT OR IGNORE INTO SERIAL_DETAIL (Serial_ID, SS_Code, Lot_Batch_No, Expiry_Date, Bin_Code, Trang_thai_Hang) VALUES (?, ?, ?, ?, ?, ?)', [serial, ss_code, lot, expiry, bin_code, 'OK']);
    }
    // 3. Cộng tồn kho
    await db.run('UPDATE KHO SET Kho_OK = Kho_OK + ?, Tong_ton = Tong_ton + ? WHERE SS_Code = ? AND Vendor_code = ?', [serials.length, serials.length, ss_code, vendor_code]);
    // 4. Ghi nhận vào BIN_VI_TRI
    await db.run('UPDATE BIN_VI_TRI SET OK = OK + ?, Trang_thai_Bin = "Occupied" WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?', [serials.length, bin_code, ss_code, vendor_code]);
    // 5. Ghi nhận giao dịch vào BIN_LOT_DETAIL
    await db.run('INSERT INTO BIN_LOT_DETAIL (Rack, Layout, Bin, Vendor_code, SS_code, Lot, So_Luong, Loai_Giao_Dich, Nguoi_Thuc_Hien) VALUES (?, ?, ?, ?, ?, ?, ?, "PUTAWAY", ?)', [null, null, bin_code, vendor_code, ss_code, lot, serials.length, 'System']);
    res.json({ message: 'Nhập kho thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi nhập kho GR', details: err.message });
  }
});
// API: Xuất kho vật tư (có kiểm tra tồn kho âm và tự động cập nhật tổng tồn)
router.post('/xuat-kho', checkRBAC, async (req, res) => {
  try {
    const db = await getDb();
    const { ss_code, vendor_code, so_luong, cho_san_xuat } = req.body;
    // Lấy tồn kho hiện tại
    const row = await db.get('SELECT * FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [ss_code, vendor_code]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy vật tư' });
    if (row.Kho_OK < so_luong) {
      return res.status(400).json({ error: 'Tồn kho không đủ, không thể xuất âm!' });
    }
    // Trừ tồn kho
    let new_Kho_OK = row.Kho_OK - so_luong;
    let new_Ton_Line = row.Ton_Line;
    if (cho_san_xuat) {
      new_Ton_Line = (row.Ton_Line || 0) + so_luong;
    }
    // Tính lại tổng tồn
    let new_Tong_ton = new_Kho_OK + (new_Ton_Line || 0) + (row.Kho_NG || 0);
    await db.run('UPDATE KHO SET Kho_OK = ?, Ton_Line = ?, Tong_ton = ? WHERE SS_Code = ? AND Vendor_code = ?', [new_Kho_OK, new_Ton_Line, new_Tong_ton, ss_code, vendor_code]);
    res.json({ message: 'Xuất kho thành công', Kho_OK: new_Kho_OK, Ton_Line: new_Ton_Line, Tong_ton: new_Tong_ton });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xuất kho', details: err.message });
  }
});
// File: dieu_hanh/vat_tu.js
// Mô tả: Điều hành các API quản lý vật tư




// API: Lấy danh sách vật tư từ SQLite

// API: Lấy danh sách vật tư từ bảng KHO
// API: Lấy danh sách vật tư từ bảng KHO, ánh xạ về định dạng frontend cần
// API: Lấy danh sách vật tư hoặc tìm theo tên
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const { ten } = req.query;
    let rows;
    if (ten) {
      // Tìm theo tên vật tư (Item), LIKE cho phép tìm gần đúng
      rows = await db.all('SELECT * FROM KHO WHERE Item LIKE ?', [`%${ten}%`]);
    } else {
      rows = await db.all('SELECT * FROM KHO');
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn database', details: err.message });
  }
});

// API: Thêm mới vật tư vào KHO (tự động tính tổng tồn)
router.post('/', async (req, res) => {
  try {
    const db = await getDb();
    // Tự động ghép Bin_Code nếu có Rack, Layout, Bin mà thiếu Bin_Code
    if (!req.body.Bin_Code && req.body.Rack && req.body.Layout && req.body.Bin) {
      req.body.Bin_Code = `${req.body.Rack}-${req.body.Layout}-${req.body.Bin}`;
    }
    const keys = Object.keys(req.body);
    const values = keys.map(k => req.body[k]);
    // Kiểm tra UoM
    if (!req.body.UoM || typeof req.body.UoM !== 'string' || req.body.UoM.length < 1) {
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['KHO', 'Thêm vật tư thiếu UoM']);
      return res.status(400).json({ error: 'Thiếu hoặc sai đơn vị tính (UoM)' });
    }
    // Tính tổng tồn nếu có Kho_OK, Ton_Line, Kho_NG
    let Kho_OK = Number(req.body.Kho_OK) || 0;
    let Ton_Line = Number(req.body.Ton_Line) || 0;
    let Kho_NG = Number(req.body.Kho_NG) || 0;
    let Tong_ton = Kho_OK + Ton_Line + Kho_NG;
    // Thêm vào fields nếu chưa có
    if (!keys.includes('Tong_ton')) {
      keys.push('Tong_ton');
      values.push(Tong_ton);
    }
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO KHO (${keys.join(',')}) VALUES (${placeholders})`;
    await db.run(sql, values);
    await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['KHO', `Thêm vật tư: ${req.body.SS_Code || ''}`]);
    res.status(201).json({ message: 'Đã thêm vật tư', data: req.body, Tong_ton });
  } catch (err) {
    try {
      const db = await getDb();
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['KHO', `Lỗi thêm vật tư: ${err.message}`]);
    } catch {}
    res.status(500).json({ error: 'Lỗi thêm vật tư', details: err.message });
  }
});

router.post('/import', async (req, res) => {
  let db;
  try {
    const { records, mode = 'preview', decisions = {} } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Không có dữ liệu để import' });
    }

    const rawHeaders = new Set();
    const normalizedHeaders = new Set();
    let missingKeyCount = 0;
    const normalised = records.map((row, index) => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach((key) => rawHeaders.add(key));
      }
      const result = normaliseKhoRecord(row, index);
      if (result.record) {
        Object.keys(result.record).forEach((key) => {
          if (!key.startsWith('__')) {
            normalizedHeaders.add(key);
          }
        });
      } else if (result.error === 'Thiếu SS_Code') {
        missingKeyCount += 1;
      }
      if (!result.record && result.error && row && typeof row === 'object') {
        Object.keys(row).forEach((key) => normalizedHeaders.add(normaliseFieldName(key)));
      }
      return { index, ...result };
    });
    const invalidBasic = normalised
      .filter((item) => item.error)
      .map((item) => ({
        index: item.index,
        reason: item.error,
        raw: item.raw
      }));
    const validRecords = normalised
      .filter((item) => !item.error && item.record)
      .map((item) => item.record);
    
    console.log(`[IMPORT STATS] Total records: ${records.length}, Valid: ${validRecords.length}, Invalid basic: ${invalidBasic.length}`);

    db = await getDb();
    const summary = {
      inserts: [],
      overwrites: [],
      invalid: [...invalidBasic]
    };

    for (const record of validRecords) {
      const resolution = await resolveExistingKho(db, record);
      if (resolution.status === 'match') {
        summary.overwrites.push({ key: record.__key, record, existing: resolution.row });
      } else {
        // All other cases are treated as new inserts
        summary.inserts.push({ key: record.__key, record });
      }
    }

    const invalidKeys = new Set(
      summary.invalid
        .map((entry) => entry.key)
        .filter((key) => typeof key === 'string' && key.length > 0)
    );

    if (mode === 'preview') {
      return res.json({
        mode: 'preview',
        records: validRecords,
        summary,
        headers: {
          raw: Array.from(rawHeaders),
          normalized: Array.from(normalizedHeaders),
          missingKeyCount
        }
      });
    }

    if (mode !== 'commit') {
      return res.status(400).json({ error: 'Chế độ import không hợp lệ' });
    }

    const inserted = [];
    const updated = [];
    const skipped = [];

    await db.run('BEGIN');
    try {
      for (const record of validRecords) {
        if (invalidKeys.has(record.__key)) {
          skipped.push({ key: record.__key, reason: 'Dòng dữ liệu không hợp lệ' });
          continue;
        }

        const resolution = await resolveExistingKho(db, record);
        
        if (resolution.status === 'match') {
          // TỰ ĐỘNG XỬ LÝ: Nếu tìm thấy hàng cũ
          // - Cộng số lượng vào Kho_OK và Tong_ton
          // - Cập nhật các thông tin khác nếu có
          const existingRow = resolution.row;
          const newKhoOK = (Number(existingRow.Kho_OK) || 0) + (Number(record.Kho_OK) || 0);
          const newTonLine = (Number(existingRow.Ton_Line) || 0) + (Number(record.Ton_Line) || 0);
          const newTonCTien = (Number(existingRow.Ton_C_Tien) || 0) + (Number(record.Ton_C_Tien) || 0);
          const newTonMuon = (Number(existingRow.Ton_Muon) || 0) + (Number(record.Ton_Muon) || 0);
          const newKhoNG = (Number(existingRow.Kho_NG) || 0) + (Number(record.Kho_NG) || 0);
          const newTongTon = newKhoOK + newTonLine + newTonCTien + newTonMuon + newKhoNG;
          
          // Cập nhật thông tin mô tả nếu có (Item, Model, Type_Item, etc.)
          const updatePayload = buildUpdatePayload(record);
          updatePayload.Kho_OK = newKhoOK;
          updatePayload.Ton_Line = newTonLine;
          updatePayload.Ton_C_Tien = newTonCTien;
          updatePayload.Ton_Muon = newTonMuon;
          updatePayload.Kho_NG = newKhoNG;
          updatePayload.Tong_ton = newTongTon;
          
          // Cập nhật Min_Stock, Max_Stock nếu có trong record mới
          if (record.Min_Stock !== undefined && record.Min_Stock !== null) {
            updatePayload.Min_Stock = Number(record.Min_Stock) || 0;
          }
          if (record.Max_Stock !== undefined && record.Max_Stock !== null) {
            updatePayload.Max_Stock = Number(record.Max_Stock) || 0;
          }
          
          const fields = Object.keys(updatePayload);
          const setClause = fields.map((field) => `${field} = ?`).join(', ');
          const params = fields.map((field) => updatePayload[field]);
          
          // Use ID for update if available
          let sql, whereParams;
          if (existingRow.ID) {
            sql = `UPDATE KHO SET ${setClause} WHERE ID = ?`;
            whereParams = [existingRow.ID];
          } else if (existingRow.Vendor_code) {
            sql = `UPDATE KHO SET ${setClause} WHERE SS_Code = ? AND Vendor_code = ?`;
            whereParams = [record.SS_Code, existingRow.Vendor_code];
          } else {
            sql = `UPDATE KHO SET ${setClause} WHERE SS_Code = ?`;
            whereParams = [record.SS_Code];
          }
          
          await db.run(sql, [...params, ...whereParams]);
          updated.push({ 
            key: record.__key, 
            ss_code: record.SS_Code,
            vendor_code: record.Vendor_code,
            old_kho_ok: existingRow.Kho_OK,
            new_kho_ok: newKhoOK,
            added_qty: record.Kho_OK || 0
          });
          console.log(`[UPDATE] Row ${record.__index}: Cộng thêm ${record.Kho_OK || 0} vào ${record.SS_Code}, tổng mới: ${newKhoOK}`);
          continue;
        }

        // HÀNG MỚI: Insert vào database
        const insertPayload = buildInsertPayload(record);
        const fields = Object.keys(insertPayload);
        if (!fields.length) {
          console.error(`[EMPTY PAYLOAD] Row ${record.__index}: No valid data (SS_Code: ${record.SS_Code})`);
          skipped.push({ key: record.__key, index: record.__index, reason: 'Không có dữ liệu hợp lệ để thêm mới', ss_code: record.SS_Code });
          continue;
        }
        try {
          const placeholders = fields.map(() => '?').join(', ');
          await db.run(
            `INSERT INTO KHO (${fields.join(',')}) VALUES (${placeholders})`,
            fields.map((field) => insertPayload[field])
          );
          inserted.push({ 
            key: record.__key,
            ss_code: record.SS_Code,
            vendor_code: record.Vendor_code,
            qty: record.Kho_OK || 0
          });
          console.log(`[INSERT] Row ${record.__index}: Thêm mới ${record.SS_Code} với số lượng ${record.Kho_OK || 0}`);
        } catch (err) {
          console.error(`[INSERT FAILED] Row ${record.__index}: ${err.message}`, { SS_Code: record.SS_Code, fields });
          skipped.push({ key: record.__key, index: record.__index, reason: `Insert failed: ${err.message}`, ss_code: record.SS_Code });
        }
      }
      await db.run('COMMIT');
      
      console.log(`[IMPORT COMMIT RESULT] Inserted: ${inserted.length}, Updated: ${updated.length}, Skipped: ${skipped.length}, Invalid: ${summary.invalid.length}`);
      console.log(`[IMPORT COMMIT RESULT] Total processed: ${inserted.length + updated.length + skipped.length + summary.invalid.length}, Expected: ${records.length}`);
      
      if (skipped.length > 0) {
        console.log('[SKIPPED DETAILS]', skipped.slice(0, 10));
      }
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackError) {
        console.error('[import] Rollback error', rollbackError);
      }
      throw err;
    }

    res.json({
      mode: 'commit',
      result: {
        inserted,
        updated,
        skipped,
        invalid: summary.invalid
      }
    });
  } catch (err) {
    console.error('[import] Failed', err);
    res.status(500).json({ error: 'Lỗi import vật tư', details: err.message });
  }
});


// API: Xem chi tiết vật tư theo SS_Code & Vendor_code
router.get('/:ss_code/:vendor_code', async (req, res) => {
  try {
    const db = await getDb();
    const { ss_code, vendor_code } = req.params;
    const row = await db.get('SELECT * FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [ss_code, vendor_code]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy vật tư' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn database', details: err.message });
  }
});

// API: Sửa thông tin vật tư (tự động tính lại tổng tồn)
router.put('/:ss_code/:vendor_code', async (req, res) => {
  try {
    // Tự động ghép Bin_Code nếu có Rack, Layout, Bin mà thiếu Bin_Code
    if (!req.body.Bin_Code && req.body.Rack && req.body.Layout && req.body.Bin) {
      req.body.Bin_Code = `${req.body.Rack}-${req.body.Layout}-${req.body.Bin}`;
    }
    console.log('PUT /api/vat-tu/:ss_code/:vendor_code', {
      params: req.params,
      body: req.body
    });
    const db = await getDb();
    const { ss_code, vendor_code } = req.params;
    
    // Map uppercase field names to lowercase for PostgreSQL
    const fieldMap = {
      'SS_Code': 'ss_code',
      'Vendor_code': 'vendor_code',
      'Hinh_anh': 'hinh_anh',
      'Trung': 'trung',
      'Item': 'item',
      'Type_Item': 'type_item',
      'Model': 'model',
      'Don_vi': 'don_vi',
      'Kho_OK': 'kho_ok',
      'Ton_Line': 'ton_line',
      'Ton_C_Tien': 'ton_c_tien',
      'Ton_Muon': 'ton_muon',
      'Kho_NG': 'kho_ng',
      'Tong_ton': 'tong_ton',
      'Ton_Cho_Kiem': 'ton_cho_kiem',
      'Min_Stock': 'min_stock',
      'Max_Stock': 'max_stock'
    };
    
    // Lọc bỏ SS_Code, Vendor_code và Tong_ton (sẽ tính lại tự động)
    const keys = Object.keys(req.body).filter(k => k !== 'SS_Code' && k !== 'Vendor_code' && k !== 'Tong_ton');
    if (keys.length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật' });
    
    // Convert to lowercase field names
    const dbKeys = keys.map(k => fieldMap[k] || k.toLowerCase());
    
    // Nếu có cập nhật Kho_OK, Ton_Line, Kho_NG thì tính lại tổng tồn
    let setClause = dbKeys.map(k => `${k} = $${dbKeys.indexOf(k) + 1}`).join(', ');
    let values = keys.map(k => req.body[k]);
    let updateTongTon = false;
    let Kho_OK, Ton_Line, Kho_NG;
    if (keys.includes('Kho_OK') || keys.includes('Ton_Line') || keys.includes('Kho_NG')) {
      // Lấy lại giá trị mới hoặc cũ
      const row = await db.get('SELECT * FROM kho WHERE ss_code = $1 AND vendor_code = $2', [ss_code, vendor_code]);
      Kho_OK = keys.includes('Kho_OK') ? Number(req.body.Kho_OK) : Number(row.kho_ok) || 0;
      Ton_Line = keys.includes('Ton_Line') ? Number(req.body.Ton_Line) : Number(row.ton_line) || 0;
      Kho_NG = keys.includes('Kho_NG') ? Number(req.body.Kho_NG) : Number(row.kho_ng) || 0;
      let Tong_ton = Kho_OK + Ton_Line + Kho_NG;
      setClause += `, tong_ton = $${values.length + 1}`;
      values.push(Tong_ton);
      updateTongTon = true;
    }
    values.push(ss_code, vendor_code);
    const sql = `UPDATE kho SET ${setClause} WHERE ss_code = $${values.length - 1} AND vendor_code = $${values.length}`;
    console.log('SQL:', sql);
    console.log('Values:', values);
    const result = await db.run(sql, values);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy vật tư để cập nhật' });
    // Ghi log nếu bảng log_nghiep_vu tồn tại, nếu không thì bỏ qua
    try {
      await db.run('INSERT INTO log_nghiep_vu (loai, noidung, thoigian) VALUES ($1, $2, CURRENT_TIMESTAMP)', ['KHO', `Cập nhật vật tư: ${ss_code}`]);
    } catch (e) {
      if (e && e.message && e.message.includes('does not exist')) {
        // Bỏ qua nếu không có bảng log
      } else {
        throw e;
      }
    }
    res.json({ message: 'Đã cập nhật vật tư', updateTongTon });
  } catch (err) {
    console.error('Lỗi PUT /api/vat-tu/:ss_code/:vendor_code', err);
    try {
      const db = await getDb();
      await db.run('INSERT INTO log_nghiep_vu (loai, noidung, thoigian) VALUES ($1, $2, CURRENT_TIMESTAMP)', ['KHO', `Lỗi cập nhật vật tư: ${err.message}`]);
    } catch (e) {
      if (e && e.message && e.message.includes('does not exist')) {
        // Bỏ qua nếu không có bảng log
      }
    }
    res.status(500).json({ error: 'Lỗi cập nhật vật tư', details: err.message, stack: err.stack });
  }
});

// API: Xóa vật tư
router.delete('/:ss_code/:vendor_code', async (req, res) => {
  try {
    const db = await getDb();
    const { ss_code, vendor_code } = req.params;
    const result = await db.run('DELETE FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [ss_code, vendor_code]);
    if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy vật tư để xóa' });
    await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['KHO', `Xóa vật tư: ${ss_code}`]);
    res.json({ message: 'Đã xóa vật tư' });
  } catch (err) {
    try {
      const db = await getDb();
      await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', ['KHO', `Lỗi xóa vật tư: ${err.message}`]);
    } catch {}
    res.status(500).json({ error: 'Lỗi xóa vật tư', details: err.message });
  }
});

export default router;
