/**
 * API Phân loại Vật tư khi Import Excel
 * Phân tích file Excel và đối chiếu với Master Data (bảng KHO)
 * để xác định vật tư nào đã có, vật tư nào mới tinh
 */

import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { getDb } from '../ket_noi_sqlite.js';

const router = express.Router();

// Cấu hình multer để xử lý file upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * POST /api/phan-loai-nhap-kho/classify
 * Phân loại vật tư từ file Excel thành: Đã có / Mới tinh
 */
router.post('/classify', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không tìm thấy file Excel' 
      });
    }

    // Đọc file Excel từ buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'File Excel không có dữ liệu' 
      });
    }

    const db = getDb();
    
    // Lấy toàn bộ SS_Code từ bảng KHO để đối chiếu
    const existingItems = await new Promise((resolve, reject) => {
      db.all('SELECT SS_Code, Vendor_code, Item, Model, UoM FROM KHO', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Tạo Set để tìm kiếm nhanh
    const existingSSCodes = new Set(existingItems.map(item => item.SS_Code));
    
    // Map để lưu thông tin chi tiết vật tư đã có
    const existingItemsMap = {};
    existingItems.forEach(item => {
      const key = `${item.SS_Code}_${item.Vendor_code || ''}`;
      existingItemsMap[key] = item;
    });

    // Phân loại từng dòng dữ liệu
    const classifiedData = {
      existingItems: [],  // Hàng đã có
      newItems: [],       // Hàng mới tinh
      invalidItems: [],   // Dòng lỗi (thiếu thông tin bắt buộc)
      summary: {
        total: jsonData.length,
        existing: 0,
        new: 0,
        invalid: 0
      }
    };

    jsonData.forEach((row, index) => {
      const lineNumber = index + 2; // +2 vì dòng 1 là header, index bắt đầu từ 0

      // Kiểm tra các trường bắt buộc
      const ssCode = row['SS_Code'] || row['SS_code'] || row['Mã vật tư'] || row['Ma_vat_tu'];
      const item = row['Item'] || row['Tên vật tư'] || row['Ten_vat_tu'];
      const quantity = parseInt(row['So_luong'] || row['Số lượng'] || row['Quantity'] || 0);
      const vendorCode = row['Vendor_code'] || row['Vendor'] || row['NCC'] || '';
      const model = row['Model'] || '';
      const uom = row['UoM'] || row['Don_vi'] || row['Đơn vị'] || 'PCS';

      // Validate dữ liệu bắt buộc
      if (!ssCode || !item) {
        classifiedData.invalidItems.push({
          lineNumber,
          data: row,
          reason: 'Thiếu thông tin bắt buộc: SS_Code hoặc Item'
        });
        classifiedData.summary.invalid++;
        return;
      }

      if (quantity <= 0 || isNaN(quantity)) {
        classifiedData.invalidItems.push({
          lineNumber,
          data: row,
          reason: 'Số lượng không hợp lệ'
        });
        classifiedData.summary.invalid++;
        return;
      }

      // Đối chiếu với Master Data
      const isExisting = existingSSCodes.has(ssCode);
      const compositeKey = `${ssCode}_${vendorCode}`;
      const existingItemDetail = existingItemsMap[compositeKey];

      const itemData = {
        lineNumber,
        ss_code: ssCode,
        item: item,
        model: model,
        vendor_code: vendorCode,
        uom: uom,
        quantity: quantity,
        lot: row['Lot'] || row['Lo'] || '',
        ngay_nhap: row['Ngay_nhap'] || row['Ngày nhập'] || new Date().toISOString().split('T')[0],
        nguoi_thuc_hien: row['Nguoi_thuc_hien'] || row['Người thực hiện'] || 'System',
        ghi_chu: row['Ghi_chu'] || row['Ghi chú'] || ''
      };

      if (isExisting) {
        // Hàng đã có trong kho
        classifiedData.existingItems.push({
          ...itemData,
          status: 'EXISTING',
          masterData: existingItemDetail || null,
          action: 'UPDATE_QUANTITY',
          requiresConfirmation: false
        });
        classifiedData.summary.existing++;
      } else {
        // Hàng mới tinh
        classifiedData.newItems.push({
          ...itemData,
          status: 'NEW',
          action: 'CREATE_MASTER_AND_GR',
          requiresConfirmation: true,
          confirmed: false  // Bắt buộc phải xác nhận
        });
        classifiedData.summary.new++;
      }
    });

    res.json({
      success: true,
      message: 'Phân loại thành công',
      data: classifiedData
    });

  } catch (error) {
    console.error('Lỗi phân loại vật tư:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi phân loại vật tư: ' + error.message 
    });
  }
});

/**
 * POST /api/phan-loai-nhap-kho/execute
 * Thực thi nhập kho hỗn hợp với Transaction đảm bảo tính toàn vẹn
 */
router.post('/execute', async (req, res) => {
  const db = getDb();
  
  try {
    const { existingItems, newItems, loaiGiaoDich = 'nhap_cro', nguoiThucHien } = req.body;

    if (!existingItems && !newItems) {
      return res.status(400).json({
        success: false,
        message: 'Không có dữ liệu để xử lý'
      });
    }

    // Kiểm tra tất cả newItems phải được confirmed
    if (newItems && newItems.length > 0) {
      const unconfirmedItems = newItems.filter(item => !item.confirmed);
      if (unconfirmedItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Có ${unconfirmedItems.length} vật tư mới chưa được xác nhận`,
          unconfirmedItems
        });
      }
    }

    const results = {
      success: true,
      processedItems: {
        newMasterCreated: 0,
        existingUpdated: 0,
        grTransactionsCreated: 0,
        errors: []
      }
    };

    // Bắt đầu Transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      // BƯỚC 1: Xử lý Hàng Mới Tinh
      if (newItems && newItems.length > 0) {
        for (const item of newItems) {
          try {
            // 1.1: Tạo Master Data trong bảng KHO
            await new Promise((resolve, reject) => {
              db.run(
                `INSERT INTO KHO (
                  SS_Code, Item, Model, Vendor_code, UoM, 
                  Kho_OK, Ton_Muon, Ton_C_Tien, Tong_ton,
                  Ngay_tao, Nguoi_tao
                ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, datetime('now'), ?)`,
                [
                  item.ss_code,
                  item.item,
                  item.model || '',
                  item.vendor_code || '',
                  item.uom || 'PCS',
                  nguoiThucHien || item.nguoi_thuc_hien || 'System'
                ],
                function(err) {
                  if (err) {
                    // Nếu đã tồn tại (race condition), bỏ qua lỗi
                    if (err.message.includes('UNIQUE constraint')) {
                      console.warn(`SS_Code ${item.ss_code} đã tồn tại, bỏ qua tạo mới`);
                      resolve();
                    } else {
                      reject(err);
                    }
                  } else {
                    results.processedItems.newMasterCreated++;
                    resolve();
                  }
                }
              );
            });

            // 1.2: Tạo giao dịch GR cho hàng mới (gán vào TEMP-BIN-01)
            const soPhieu = `GR-NEW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            await new Promise((resolve, reject) => {
              db.run(
                `INSERT INTO GIAO_DICH_NHAP_KHO (
                  SoPhieu, NgayGiaoDich, LoaiGiaoDich, MaVatTu, MaNCC,
                  SoLuong, Don_vi, ViTriNhap, NguoiThucHien, GhiChu, Lot
                ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  soPhieu,
                  loaiGiaoDich,
                  item.ss_code,
                  item.vendor_code || '',
                  item.quantity,
                  item.uom || 'PCS',
                  'TEMP-BIN-01',
                  nguoiThucHien || item.nguoi_thuc_hien || 'System',
                  `Nhập mới: ${item.ghi_chu || ''}`,
                  item.lot || ''
                ],
                function(err) {
                  if (err) reject(err);
                  else {
                    results.processedItems.grTransactionsCreated++;
                    resolve();
                  }
                }
              );
            });

          } catch (itemError) {
            results.processedItems.errors.push({
              item: item.ss_code,
              line: item.lineNumber,
              error: itemError.message
            });
          }
        }
      }

      // BƯỚC 2: Xử lý Hàng Đã Có
      if (existingItems && existingItems.length > 0) {
        for (const item of existingItems) {
          try {
            const soPhieu = `GR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Tạo giao dịch GR
            await new Promise((resolve, reject) => {
              db.run(
                `INSERT INTO GIAO_DICH_NHAP_KHO (
                  SoPhieu, NgayGiaoDich, LoaiGiaoDich, MaVatTu, MaNCC,
                  SoLuong, Don_vi, ViTriNhap, NguoiThucHien, GhiChu, Lot
                ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  soPhieu,
                  loaiGiaoDich,
                  item.ss_code,
                  item.vendor_code || '',
                  item.quantity,
                  item.uom || 'PCS',
                  'TEMP-BIN-01', // Sẽ được phân bổ sau
                  nguoiThucHien || item.nguoi_thuc_hien || 'System',
                  item.ghi_chu || '',
                  item.lot || ''
                ],
                function(err) {
                  if (err) reject(err);
                  else {
                    results.processedItems.existingUpdated++;
                    results.processedItems.grTransactionsCreated++;
                    resolve();
                  }
                }
              );
            });

          } catch (itemError) {
            results.processedItems.errors.push({
              item: item.ss_code,
              line: item.lineNumber,
              error: itemError.message
            });
          }
        }
      }

      // COMMIT Transaction nếu không có lỗi nghiêm trọng
      if (results.processedItems.errors.length === 0) {
        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        results.message = 'Nhập kho hỗn hợp thành công';
      } else {
        // ROLLBACK nếu có lỗi
        await new Promise((resolve, reject) => {
          db.run('ROLLBACK', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        results.success = false;
        results.message = `Có ${results.processedItems.errors.length} lỗi xảy ra, đã rollback toàn bộ`;
      }

    } catch (transactionError) {
      // ROLLBACK khi có lỗi trong transaction
      await new Promise((resolve) => {
        db.run('ROLLBACK', () => resolve());
      });
      
      throw transactionError;
    }

    res.json(results);

  } catch (error) {
    console.error('Lỗi thực thi nhập kho hỗn hợp:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi thực thi: ' + error.message
    });
  }
});

export default router;
