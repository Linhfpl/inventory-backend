import express from 'express';
import { getDb } from '../ket_noi_postgres.js';
const router = express.Router();

const BIN_DECISION_SEPARATOR = '::';
const KEY_ESCAPE_PATTERN = new RegExp(BIN_DECISION_SEPARATOR, 'g');
const BIN_NUMERIC_FIELDS = ['OK', 'NG', 'Stock', 'Capacity'];
const BIN_UPDATE_FIELDS = [
  'Rack',
  'Layout',
  'Bin',
  'Bin_Code',
  'SS_code',
  'Vendor_code',
  'Item',
  'Model',
  'Type_Item',
  'Don_vi',
  'OK',
  'NG',
  'Stock',
  'Capacity',
  'Trang_thai_Bin'
];
const BIN_STRING_REQUIRE_EMPTY = new Set(['SS_code', 'Vendor_code']);

const BIN_FIELD_ALIAS_MAP = new Map([
  ['rack', 'Rack'],
  ['ke', 'Rack'],
  ['kệ', 'Rack'],
  ['layout', 'Layout'],
  ['tầng', 'Layout'],
  ['tang', 'Layout'],
  ['shelf', 'Layout'],
  ['bin', 'Bin'],
  ['ô', 'Bin'],
  ['o', 'Bin'],
  ['hộc', 'Bin'],
  ['bin_code', 'Bin_Code'],
  ['bin code', 'Bin_Code'],
  ['ma bin', 'Bin_Code'],
  ['mã bin', 'Bin_Code'],
  ['ss_code', 'SS_code'],
  ['sscode', 'SS_code'],
  ['ss code', 'SS_code'],
  ['ma_vat_tu', 'SS_code'],
  ['mã vật tư', 'SS_code'],
  ['stt', 'STT'],
  ['so_thu_tu', 'STT'],
  ['so thu tu', 'STT'],
  ['số thứ tự', 'STT'],
  ['vendor_code', 'Vendor_code'],
  ['vendorcode', 'Vendor_code'],
  ['vendor code', 'Vendor_code'],
  ['ma_ncc', 'Vendor_code'],
  ['mã ncc', 'Vendor_code'],
  ['item', 'Item'],
  ['ten_vat_tu', 'Item'],
  ['tên vật tư', 'Item'],
  ['ten hang', 'Item'],
  ['tên hàng', 'Item'],
  ['ten hang hoa', 'Item'],
  ['tên hàng hóa', 'Item'],
  ['model', 'Model'],
  ['type_item', 'Type_Item'],
  ['type item', 'Type_Item'],
  ['loai', 'Type_Item'],
  ['loại', 'Type_Item'],
  ['loai vat tu', 'Type_Item'],
  ['loại vật tư', 'Type_Item'],
  ['don_vi', 'Don_vi'],
  ['donvi', 'Don_vi'],
  ['đơn vị', 'Don_vi'],
  ['unit', 'Don_vi'],
  ['ok', 'OK'],
  ['sl ok', 'OK'],
  ['ng', 'NG'],
  ['stock', 'Stock'],
  ['capacity', 'Capacity'],
  ['suc chua', 'Capacity'],
  ['suc chứa', 'Capacity'],
  ['trang_thai_bin', 'Trang_thai_Bin'],
  ['trang thai', 'Trang_thai_Bin'],
  ['status', 'Trang_thai_Bin']
]);

const BIN_ALIAS_FALLBACKS = [
  { test: (key) => key.includes('stt'), field: 'STT' },
  { test: (key) => key.includes('item') && !key.includes('type'), field: 'Item' },
  { test: (key) => key.includes('model'), field: 'Model' },
  { test: (key) => key.includes('type') && key.includes('item'), field: 'Type_Item' },
  { test: (key) => key.includes('don') && key.includes('vi'), field: 'Don_vi' },
  { test: (key) => key.includes('vendor'), field: 'Vendor_code' },
  { test: (key) => key.includes('ss') && key.includes('code'), field: 'SS_code' },
  { test: (key) => key.includes('rack') || key === 'ke', field: 'Rack' },
  { test: (key) => key.includes('layout') || key.includes('tang'), field: 'Layout' },
  { test: (key) => key.includes('bin'), field: 'Bin' }
];

function resolveFieldAlias(normalizedKey) {
  if (!normalizedKey) return null;
  if (BIN_FIELD_ALIAS_MAP.has(normalizedKey)) {
    return BIN_FIELD_ALIAS_MAP.get(normalizedKey);
  }
  const fallback = BIN_ALIAS_FALLBACKS.find((entry) => {
    try {
      return typeof entry.test === 'function' ? entry.test(normalizedKey) : false;
    } catch (err) {
      return false;
    }
  });
  return fallback ? fallback.field : null;
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

function toSafeBinNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function toOptionalString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function escapeKeyValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(KEY_ESCAPE_PATTERN, '__');
}

function buildBinDecisionKey(record) {
  const keyParts = [];
  if (record.STT !== null && record.STT !== undefined) {
    keyParts.push(`stt=${escapeKeyValue(record.STT)}`);
  }
  if (record.Bin_Code) {
    keyParts.push(`code=${escapeKeyValue(record.Bin_Code)}`);
  }
  keyParts.push(
    `combo=${[
      escapeKeyValue(record.Rack),
      escapeKeyValue(record.Layout),
      escapeKeyValue(record.Bin),
      escapeKeyValue(record.Vendor_code),
      escapeKeyValue(record.SS_code)
    ].join('|')}`
  );
  const indexPart = record.__index !== undefined && record.__index !== null ? record.__index : Math.random().toString(36).slice(2, 10);
  keyParts.push(`idx=${escapeKeyValue(indexPart)}`);
  return keyParts.join(BIN_DECISION_SEPARATOR);
}

function normaliseBinRecord(raw, index, headerTracker) {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Dòng dữ liệu không hợp lệ', index, raw };
  }

  const normalisedEntries = new Map();
  Object.entries(raw).forEach(([key, value]) => {
    headerTracker.rawHeaders.add(key);
    const normalizedKey = normaliseFieldName(key);
    if (!normalizedKey) return;
    normalisedEntries.set(normalizedKey, value);
  });

  const record = { __index: index };
  const presentFields = new Set();
  let hasExplicitBinCode = false;

  for (const [normalizedKey, rawValue] of normalisedEntries.entries()) {
    const field = resolveFieldAlias(normalizedKey);
    if (!field) continue;
    if (presentFields.has(field)) continue;
    const value = rawValue;
    if (BIN_NUMERIC_FIELDS.includes(field)) {
      record[field] = toSafeBinNumber(value);
    } else {
      const text = toOptionalString(value);
      if (BIN_STRING_REQUIRE_EMPTY.has(field)) {
        record[field] = text ?? '';
      } else if (text !== null) {
        record[field] = text;
      }
    }
    headerTracker.normalizedHeaders.add(field);
    presentFields.add(field);
    if (field === 'Bin_Code') {
      hasExplicitBinCode = true;
    }
  }

  record.Rack = toOptionalString(record.Rack);
  record.Bin = toOptionalString(record.Bin);
  if (!record.Rack) {
    return { error: 'Thiếu Rack', index, raw };
  }
  if (!record.Bin) {
    return { error: 'Thiếu Bin', index, raw };
  }

  if (record.STT !== undefined && record.STT !== null) {
    const rawStt = String(record.STT).trim();
    if (rawStt.length === 0) {
      record.STT = null;
    } else {
      const numericStt = Number(rawStt);
      record.STT = Number.isFinite(numericStt) ? numericStt : null;
    }
  } else {
    record.STT = null;
  }

  record.Layout = toOptionalString(record.Layout);
  record.Bin_Code = toOptionalString(record.Bin_Code);
  if (!record.Bin_Code) {
    const parts = [record.Rack, record.Layout, record.Bin].filter((part) => !!part);
    record.Bin_Code = parts.join('-');
  }
  record.Bin_Code = record.Bin_Code || '';

  record.SS_code = toOptionalString(record.SS_code) ?? '';
  record.Vendor_code = toOptionalString(record.Vendor_code) ?? '';
  record.Item = toOptionalString(record.Item);
  record.Model = toOptionalString(record.Model);
  record.Type_Item = toOptionalString(record.Type_Item);
  record.Don_vi = toOptionalString(record.Don_vi);
  record.OK = toSafeBinNumber(record.OK);
  record.NG = toSafeBinNumber(record.NG);
  record.Stock = toSafeBinNumber(record.Stock);
  record.Capacity = toSafeBinNumber(record.Capacity);
  record.Trang_thai_Bin = toOptionalString(record.Trang_thai_Bin);
  if (!record.Trang_thai_Bin) {
    record.Trang_thai_Bin = record.OK > 0 ? 'Occupied' : 'Empty';
  }

  record.__presentFields = Array.from(presentFields);
  record.__hasExplicitBinCode = hasExplicitBinCode;
  record.__key = buildBinDecisionKey(record);
  return { record };
}

async function findExistingBin(db, record) {
  if (record.STT !== null && record.STT !== undefined) {
    const existingByStt = await db.get(
      'SELECT * FROM BIN_VI_TRI WHERE STT = ? LIMIT 1',
      [record.STT]
    );
    if (existingByStt) return existingByStt;
    // Nếu có STT nhưng chưa tồn tại, coi như bản ghi mới và không fallback theo tổ hợp
    return null;
  }

  if (record.Bin_Code) {
    const existing = await db.get(
      'SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ?',
      [record.Bin_Code]
    );
    if (existing) return existing;
  }

  if (record.Rack && record.Bin) {
    const params = [record.Rack, record.Bin];
    let sql = 'SELECT * FROM BIN_VI_TRI WHERE Rack = ? AND Bin = ?';
    if (record.Layout) {
      sql += ' AND Layout = ?';
      params.push(record.Layout);
    } else {
      sql += ' AND (Layout IS NULL OR Layout = "")';
    }

    sql += ' AND IFNULL(Vendor_code, "") = ? AND IFNULL(SS_code, "") = ?';
    params.push(record.Vendor_code ?? '', record.SS_code ?? '');

    const existingByCombo = await db.get(sql, params);
    if (existingByCombo) return existingByCombo;
  }

  return null;
}

function buildBinInsertPayload(record) {
  const payload = {
    STT: record.STT,
    Rack: record.Rack,
    Layout: record.Layout,
    Bin: record.Bin,
    Bin_Code: record.Bin_Code,
    SS_code: record.SS_code ?? '',
    Vendor_code: record.Vendor_code ?? '',
    Item: record.Item,
    Model: record.Model,
    Type_Item: record.Type_Item,
    Don_vi: record.Don_vi,
    OK: toSafeBinNumber(record.OK),
    NG: toSafeBinNumber(record.NG),
    Stock: toSafeBinNumber(record.Stock),
    Capacity: toSafeBinNumber(record.Capacity),
    Trang_thai_Bin: record.Trang_thai_Bin || (record.OK > 0 ? 'Occupied' : 'Empty')
  };
  return payload;
}

function buildBinUpdatePayload(record) {
  const payload = {};
  const present = Array.isArray(record.__presentFields)
    ? new Set(record.__presentFields)
    : record.__presentFields instanceof Set
      ? record.__presentFields
      : new Set();

  BIN_UPDATE_FIELDS.forEach((field) => {
    if (!present.has(field)) return;
    if (field === 'Bin_Code' && !record.__hasExplicitBinCode) return;
    if (record[field] === undefined) return;
    if (BIN_NUMERIC_FIELDS.includes(field)) {
      payload[field] = toSafeBinNumber(record[field]);
    } else {
      const text = toOptionalString(record[field]);
        if (BIN_STRING_REQUIRE_EMPTY.has(field)) {
          payload[field] = text ?? '';
        } else {
          payload[field] = text !== null ? text : null;
        }
    }
  });
  return payload;
}

function buildBinWhereClause(existing) {
  if (existing.ID !== undefined && existing.ID !== null) {
    return { clause: 'WHERE ID = ?', params: [existing.ID] };
  }
  if (existing.Bin_Code) {
    return { clause: 'WHERE Bin_Code = ?', params: [existing.Bin_Code] };
  }
  const params = [existing.Rack, existing.Bin];
  let clause = 'WHERE Rack = ? AND Bin = ?';
  if (existing.Layout === null || existing.Layout === undefined || existing.Layout === '') {
    clause += ' AND (Layout IS NULL OR Layout = "")';
  } else {
    clause += ' AND Layout = ?';
    params.push(existing.Layout);
  }
  return { clause, params };
}
// API: Tạo mới Bin
router.post('/create', async (req, res) => {
  try {
    const { Bin_Code, Rack, Layout, Bin, SS_code, Vendor_code, Capacity, Trang_thai_Bin } = req.body;
    if (!Bin_Code) return res.status(400).json({ error: 'Thiếu Bin_Code' });
    const db = await getDb();
    await db.run(`INSERT INTO BIN_VI_TRI (Bin_Code, Rack, Layout, Bin, SS_code, Vendor_code, Capacity, Trang_thai_Bin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [Bin_Code, Rack, Layout, Bin, SS_code, Vendor_code, Capacity, Trang_thai_Bin]);
    res.json({ message: 'Tạo Bin thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo Bin', details: err.message });
  }
});

// API: Cập nhật Bin
router.post('/update', async (req, res) => {
  try {
    const { Bin_Code, Rack, Layout, Bin, SS_code, Vendor_code, Capacity, Trang_thai_Bin } = req.body;
    if (!Bin_Code) return res.status(400).json({ error: 'Thiếu Bin_Code' });
    const db = await getDb();
    await db.run(`UPDATE BIN_VI_TRI SET Rack=?, Layout=?, Bin=?, SS_code=?, Vendor_code=?, Capacity=?, Trang_thai_Bin=? WHERE Bin_Code=?`, [Rack, Layout, Bin, SS_code, Vendor_code, Capacity, Trang_thai_Bin, Bin_Code]);
    res.json({ message: 'Cập nhật Bin thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật Bin', details: err.message });
  }
});

// API: Xóa Bin
router.post('/delete', async (req, res) => {
  try {
    const { bin_code } = req.body;
    if (!bin_code) return res.status(400).json({ error: 'Thiếu bin_code' });
    const db = await getDb();
    await db.run(`DELETE FROM BIN_VI_TRI WHERE Bin_Code = ?`, [bin_code]);
    res.json({ message: 'Xóa Bin thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa Bin', details: err.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { records, mode = 'preview', decisions = {} } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Không có dữ liệu để import' });
    }

    const headerTracker = {
      rawHeaders: new Set(),
      normalizedHeaders: new Set()
    };

    const normalised = records.map((row, index) => ({
      index,
      raw: row,
      ...normaliseBinRecord(row, index, headerTracker)
    }));

    let missingKeyCount = 0;
    const invalidBasic = normalised
      .filter((item) => item.error)
      .map((item) => {
        if (item.error === 'Thiếu Rack' || item.error === 'Thiếu Bin') {
          missingKeyCount += 1;
        }
        return { index: item.index, reason: item.error, raw: item.raw };
      });

    const validRecords = normalised
      .filter((item) => !item.error && item.record)
      .map((item) => item.record);

    const db = await getDb();
    const summary = {
      inserts: [],
      overwrites: [],
      invalid: [...invalidBasic]
    };

    for (const record of validRecords) {
      const existing = await findExistingBin(db, record);
      if (existing) {
        summary.overwrites.push({ key: record.__key, record, existing });
      } else {
        summary.inserts.push({ key: record.__key, record });
      }
    }

    const overwriteKeys = new Set(summary.overwrites.map((item) => item.key));
    const invalidKeys = new Set(
      summary.invalid
        .map((entry) => entry.key)
        .filter((key) => typeof key === 'string' && key.length > 0)
    );

    const headers = {
      raw: Array.from(headerTracker.rawHeaders),
      normalized: Array.from(headerTracker.normalizedHeaders),
      missingKeyCount
    };

    if (mode === 'preview') {
      return res.json({ mode: 'preview', records: validRecords, summary, headers });
    }

    if (mode !== 'commit') {
      return res.status(400).json({ error: 'Chế độ import không hợp lệ' });
    }

    const inserted = [];
    const updated = [];
    const skipped = [];
    const processedKeys = new Set();

    await db.run('BEGIN');
    try {
      for (const record of validRecords) {
        if (processedKeys.has(record.__key)) {
          skipped.push({ key: record.__key, reason: 'Khóa bị trùng trong file import' });
          continue;
        }
        processedKeys.add(record.__key);

        if (invalidKeys.has(record.__key)) {
          skipped.push({ key: record.__key, reason: 'Dữ liệu không hợp lệ' });
          continue;
        }

        const existing = await findExistingBin(db, record);
        if (existing) {
          const decisionRaw = decisions[record.__key];
          const decision = typeof decisionRaw === 'string' ? decisionRaw.toLowerCase() : 'skip';
          if (decision !== 'overwrite') {
            skipped.push({ key: record.__key, reason: 'Bỏ qua theo lựa chọn' });
            continue;
          }

          const updatePayload = buildBinUpdatePayload(record);
          const fields = Object.keys(updatePayload).filter((field) => updatePayload[field] !== undefined);
          if (!fields.length) {
            skipped.push({ key: record.__key, reason: 'Không có dữ liệu để cập nhật' });
            continue;
          }

          if (
            updatePayload.Bin_Code &&
            updatePayload.Bin_Code !== existing.Bin_Code
          ) {
            const conflict = await db.get(
              'SELECT Bin_Code FROM BIN_VI_TRI WHERE Bin_Code = ?',
              [updatePayload.Bin_Code]
            );
            if (conflict) {
              skipped.push({
                key: record.__key,
                reason: `Bin_Code ${updatePayload.Bin_Code} đã được sử dụng`
              });
              continue;
            }
          }

          const { clause, params } = buildBinWhereClause(existing);
          const setClause = fields.map((field) => `${field} = ?`).join(', ');
          try {
            await db.run(
              `UPDATE BIN_VI_TRI SET ${setClause} ${clause}`,
              [...fields.map((field) => updatePayload[field]), ...params]
            );
            updated.push({ key: record.__key, fields });
          } catch (err) {
            if (err?.message?.includes('SQLITE_CONSTRAINT')) {
              skipped.push({
                key: record.__key,
                reason: `Không thể cập nhật bin: ${err.message}`
              });
              continue;
            }
            throw err;
          }
          continue;
        }

        const payload = buildBinInsertPayload(record);
        const fields = Object.keys(payload).filter((field) => payload[field] !== undefined);
        const placeholders = fields.map(() => '?').join(', ');
        try {
          await db.run(
            `INSERT INTO BIN_VI_TRI (${fields.join(',')}) VALUES (${placeholders})`,
            fields.map((field) => payload[field])
          );
          inserted.push({ key: record.__key });
        } catch (err) {
          if (err?.message?.includes('SQLITE_CONSTRAINT')) {
            skipped.push({
              key: record.__key,
              reason: `Không thể thêm bin mới: ${err.message}`
            });
            continue;
          }
          throw err;
        }
      }
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }

    res.json({
      mode: 'commit',
      headers,
      result: {
        inserted,
        updated,
        skipped,
        invalid: summary.invalid
      },
      summary
    });
  } catch (err) {
    console.error('[BIN IMPORT] Lỗi import vị trí kho:', err);
    res.status(500).json({ error: 'Lỗi import vị trí kho', details: err?.message, stack: err?.stack });
  }
});

// API: Cập nhật trạng thái Bin thủ công
router.post('/update-status', async (req, res) => {
  try {
    const { bin_code, status } = req.body;
    if (!bin_code || !status) return res.status(400).json({ error: 'Thiếu thông tin' });
    const db = await getDb();
    await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = ? WHERE Bin_Code = ?`, [status, bin_code]);
    res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật trạng thái', details: err.message });
  }
});
// API: Cảnh báo tổng hợp tồn kho và vị trí
router.get('/canh-bao', async (req, res) => {
  try {
    const db = await getDb();
    // 1. Cảnh báo tồn kho thấp (OK < 5)
    const lowStock = await db.all(`SELECT * FROM BIN_VI_TRI WHERE OK < 5 AND Trang_thai_Bin = 'Occupied'`);
    // 2. Cảnh báo Bin đầy (OK >= Capacity)
    const binFull = await db.all(`SELECT * FROM BIN_VI_TRI WHERE Capacity IS NOT NULL AND OK >= Capacity`);
    // 3. Cảnh báo Bin Locked/InActive
    const binLocked = await db.all(`SELECT * FROM BIN_VI_TRI WHERE Trang_thai_Bin IN ('Locked', 'Inactive')`);
    // 4. Cảnh báo tồn kho âm
    const negativeStock = await db.all(`SELECT * FROM BIN_VI_TRI WHERE OK < 0`);
    // 5. Cảnh báo tồn kho lệch thực tế (nâng cao, cần kiểm kê thực tế)
    // (Chỉ trả về cấu trúc, thực tế cần truyền vào danh sách kiểm kê)
    res.json({ lowStock, binFull, binLocked, negativeStock });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cảnh báo', details: err.message });
  }
});
// API: Báo cáo tồn kho chi tiết (theo Bin, Lot, trạng thái)
router.get('/bao-cao-chi-tiet', async (req, res) => {
  try {
    const db = await getDb();
    // Lấy tồn kho chi tiết từng Bin, Lot, trạng thái
    const rows = await db.all(`
      SELECT v.Bin_Code, v.Rack, v.Layout, v.Bin, v.SS_code, v.Vendor_code, v.OK, v.NG, v.Capacity, v.Trang_thai_Bin,
             l.Lot, l.So_Luong, l.Loai_Giao_Dich, l.Ngay_Giao_Dich
      FROM BIN_VI_TRI v
      LEFT JOIN BIN_LOT_DETAIL l ON v.Bin = l.Bin AND v.SS_code = l.SS_code AND v.Vendor_code = l.Vendor_code
      ORDER BY v.Rack, v.Layout, v.Bin, l.Lot
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi báo cáo tồn kho chi tiết', details: err.message });
  }
});
// API: Kiểm kê (so sánh thực tế - hệ thống, cập nhật trạng thái Bin)
router.post('/kiem-ke', async (req, res) => {
  try {
    const { bin_code, serial_ids } = req.body; // serial_ids: mảng Serial_ID thực tế quét được tại Bin
    const db = await getDb();
    // 1. Lấy danh sách Serial_ID hệ thống tại Bin này
    const systemSerials = await db.all(`SELECT Serial_ID FROM SERIAL_DETAIL WHERE Bin_Code = ?`, [bin_code]);
    const systemSet = new Set(systemSerials.map(s => s.Serial_ID));
    const actualSet = new Set(serial_ids);
    // 2. Tìm thiếu/thừa
    const missing = [...systemSet].filter(x => !actualSet.has(x));
    const extra = [...actualSet].filter(x => !systemSet.has(x));
    // 3. Cập nhật trạng thái Bin: Locked nếu đang kiểm kê, Empty nếu không còn hàng, Occupied nếu còn hàng
    let newStatus = 'Occupied';
    if (serial_ids.length === 0) newStatus = 'Empty';
    await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Locked' WHERE Bin_Code = ?`, [bin_code]);
    // 4. Trả kết quả kiểm kê
    res.json({ bin_code, missing, extra, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi kiểm kê', details: err.message });
  }
});
// API: Picking (xuất kho, FEFO/FIFO)
router.post('/picking', async (req, res) => {
  try {
    const { ss_code, vendor_code, so_luong, nguoi_thuc_hien } = req.body;
    const db = await getDb();
    // 1. Tìm Bin chứa Lot ưu tiên (FEFO/FIFO: hạn sử dụng gần nhất, nhập trước)
    const lotRow = await db.get(`SELECT * FROM BIN_LOT_DETAIL WHERE SS_code = ? AND Vendor_code = ? AND So_Luong > 0 ORDER BY Ngay_Giao_Dich ASC, Lot ASC LIMIT 1`, [ss_code, vendor_code]);
    if (!lotRow) return res.status(400).json({ error: 'Không còn Lot nào để xuất!' });
    // 2. Trừ số lượng khỏi Bin/Lot này
    await db.run(`UPDATE BIN_LOT_DETAIL SET So_Luong = So_Luong - ? WHERE ID = ?`, [so_luong, lotRow.ID]);
    await db.run(`UPDATE BIN_VI_TRI SET OK = OK - ? WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [so_luong, lotRow.Bin_Code, ss_code, vendor_code]);
    // 3. Tự động cập nhật trạng thái Bin
    const binCheck = await db.get(`SELECT OK FROM BIN_VI_TRI WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [lotRow.Bin_Code, ss_code, vendor_code]);
    if (binCheck) {
      if (Number(binCheck.OK) <= 0) {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Empty' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [lotRow.Bin_Code, ss_code, vendor_code]);
      } else {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Occupied' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [lotRow.Bin_Code, ss_code, vendor_code]);
      }
    }
    // 4. Ghi nhận giao dịch xuất kho vào BIN_LOT_DETAIL
    await db.run(`INSERT INTO BIN_LOT_DETAIL (Rack, Layout, Bin, Vendor_code, SS_code, Lot, So_Luong, Loai_Giao_Dich, Nguoi_Thuc_Hien) VALUES (?, ?, ?, ?, ?, ?, ?, 'PICKING', ?)`, [lotRow.Rack, lotRow.Layout, lotRow.Bin, vendor_code, ss_code, lotRow.Lot, so_luong, nguoi_thuc_hien]);
    res.json({ message: 'Picking thành công', bin_code: lotRow.Bin_Code, lot: lotRow.Lot });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi picking', details: err.message });
  }
});
// API: Putaway (nhập kho, gán vị trí tối ưu)
router.post('/putaway', async (req, res) => {
  try {
    const { ss_code, vendor_code, so_luong, lot, nguoi_thuc_hien } = req.body;
    const db = await getDb();
    // 1. Tìm Bin tối ưu (Empty hoặc còn chỗ, ưu tiên tầng thấp)
    const bin = await db.get(`SELECT * FROM BIN_VI_TRI WHERE (Trang_thai_Bin = 'Empty' OR (Capacity IS NOT NULL AND OK < Capacity)) ORDER BY Layout ASC, Rack ASC, Bin ASC LIMIT 1`);
    if (!bin) return res.status(400).json({ error: 'Không còn Bin trống hoặc đủ chỗ!' });
    // 2. Gán vật tư vào Bin này, cập nhật số lượng OK
    await db.run(`UPDATE BIN_VI_TRI SET OK = OK + ? WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [so_luong, bin.Bin_Code, ss_code, vendor_code]);
    // 2.1. Tự động cập nhật trạng thái Bin
    const binCheck = await db.get(`SELECT OK FROM BIN_VI_TRI WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [bin.Bin_Code, ss_code, vendor_code]);
    if (binCheck) {
      if (Number(binCheck.OK) <= 0) {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Empty' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [bin.Bin_Code, ss_code, vendor_code]);
      } else {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Occupied' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [bin.Bin_Code, ss_code, vendor_code]);
      }
    }
    // 3. Ghi nhận giao dịch chi tiết vào BIN_LOT_DETAIL
    await db.run(`INSERT INTO BIN_LOT_DETAIL (Rack, Layout, Bin, Vendor_code, SS_code, Lot, So_Luong, Loai_Giao_Dich, Nguoi_Thuc_Hien) VALUES (?, ?, ?, ?, ?, ?, ?, 'PUTAWAY', ?)`, [bin.Rack, bin.Layout, bin.Bin, vendor_code, ss_code, lot, so_luong, nguoi_thuc_hien]);
    res.json({ message: 'Putaway thành công', bin_code: bin.Bin_Code });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi putaway', details: err.message });
  }
});
// File: dieu_hanh/vi_tri_kho_v2.js
// API quản lý vị trí kho (CRUD, putaway, picking, chuyển vị trí, FEFO/FIFO)

// (duplicate import removed)

// Lấy danh sách tất cả vị trí kho (có phân cấp, trạng thái, capacity)
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM BIN_VI_TRI');
    const updates = [];
    const normalized = rows.map((row) => {
      const ok = Number(row.OK) || 0;
      const ng = Number(row.NG) || 0;
      const stock = Number(row.Stock) || 0;
      const hasInventory = ok > 0 || ng > 0 || stock > 0;
      const currentStatus = (row.Trang_thai_Bin || '').trim();
      const lowered = currentStatus.toLowerCase();
      const normalizedStatus = lowered
        ? lowered.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : '';
      let nextStatus = currentStatus;
      const emptyAliases = new Set(['', 'empty', 'trong']);
      if (hasInventory) {
        if (emptyAliases.has(normalizedStatus)) {
          nextStatus = 'Occupied';
        }
      } else {
        if (!currentStatus || normalizedStatus === 'occupied') {
          nextStatus = 'Empty';
        }
      }
      if (nextStatus !== currentStatus) {
        updates.push({
          status: nextStatus,
          rack: row.Rack,
          bin: row.Bin,
          vendor: row.Vendor_code,
          ssCode: row.SS_code
        });
      }
      return {
        ...row,
        Trang_thai_Bin: nextStatus || (hasInventory ? 'Occupied' : 'Empty')
      };
    });
    for (const update of updates) {
      await db.run(
        'UPDATE BIN_VI_TRI SET Trang_thai_Bin = ? WHERE Rack = ? AND Bin = ? AND Vendor_code = ? AND SS_code = ?',
        [update.status, update.rack, update.bin, update.vendor, update.ssCode]
      );
    }
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn vị trí kho', details: err.message });
  }
});

// Lấy danh sách Bin trống hoặc có thể chứa thêm (putaway suggestion)
router.get('/putaway-suggestion', async (req, res) => {
  try {
    const db = await getDb();
    // Ưu tiên Bin trạng thái Empty hoặc có thể chứa thêm (theo Capacity)
    const rows = await db.all(`SELECT * FROM BIN_VI_TRI WHERE (Trang_thai_Bin = 'Empty' OR (Capacity IS NOT NULL AND OK < Capacity)) ORDER BY Layout ASC, Rack ASC, Bin ASC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn putaway', details: err.message });
  }
});

// Lấy danh sách Bin đề xuất picking (FEFO/FIFO)
router.get('/picking-suggestion', async (req, res) => {
  try {
    const db = await getDb();
    // FEFO/FIFO: Ưu tiên Bin chứa Lot có hạn sử dụng gần nhất hoặc nhập trước
    const rows = await db.all(`SELECT * FROM BIN_LOT_DETAIL ORDER BY Ngay_Giao_Dich ASC, Lot ASC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy vấn picking', details: err.message });
  }
});

// API chuyển vị trí nội bộ (Internal Transfer)
router.post('/transfer', async (req, res) => {
  try {
    const { fromBin, toBin, ss_code, vendor_code, so_luong, lot, nguoi_thuc_hien } = req.body;
    const db = await getDb();
    // Giảm số lượng khỏi Bin cũ
    await db.run(`UPDATE BIN_VI_TRI SET OK = OK - ? WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [so_luong, fromBin, ss_code, vendor_code]);
    // Tăng số lượng vào Bin mới
    await db.run(`UPDATE BIN_VI_TRI SET OK = OK + ? WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [so_luong, toBin, ss_code, vendor_code]);
    // Tự động cập nhật trạng thái Bin cũ
    const fromBinCheck = await db.get(`SELECT OK FROM BIN_VI_TRI WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [fromBin, ss_code, vendor_code]);
    if (fromBinCheck) {
      if (Number(fromBinCheck.OK) <= 0) {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Empty' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [fromBin, ss_code, vendor_code]);
      } else {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Occupied' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [fromBin, ss_code, vendor_code]);
      }
    }
    // Tự động cập nhật trạng thái Bin mới
    const toBinCheck = await db.get(`SELECT OK FROM BIN_VI_TRI WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [toBin, ss_code, vendor_code]);
    if (toBinCheck) {
      if (Number(toBinCheck.OK) <= 0) {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Empty' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [toBin, ss_code, vendor_code]);
      } else {
        await db.run(`UPDATE BIN_VI_TRI SET Trang_thai_Bin = 'Occupied' WHERE Bin_Code = ? AND SS_code = ? AND Vendor_code = ?`, [toBin, ss_code, vendor_code]);
      }
    }
    // Ghi nhận giao dịch chi tiết
    await db.run(`INSERT INTO BIN_LOT_DETAIL (Rack, Layout, Bin, Vendor_code, SS_code, Lot, So_Luong, Loai_Giao_Dich, Nguoi_Thuc_Hien) VALUES (?, ?, ?, ?, ?, ?, ?, 'TRANSFER', ?)`, [/* rack, layout, bin... */ null, null, toBin, vendor_code, ss_code, lot, so_luong, nguoi_thuc_hien]);
    res.json({ message: 'Chuyển vị trí thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi chuyển vị trí', details: err.message });
  }
});

export default router;
