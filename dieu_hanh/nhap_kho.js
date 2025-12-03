import express from 'express';
import NhapKho from '../mo_hinh/nhap_kho.js';
import dsNhapKho from '../du_lieu_mau/vat_tu_data.js';
import axios from 'axios';
import { getDb } from '../ket_noi_postgres.js';

const router = express.Router();

// Middleware kiểm tra RBAC (env-configurable and optional)
async function checkRBAC(req, res, next) {
	try {
		const { MaNV, Action } = req.body;
		if (!MaNV || !Action) {
			return res.status(400).json({ error: 'Thiếu thông tin phân quyền' });
		}
		const baseUrl = process.env.RBAC_URL;
		if (!baseUrl) {
			// No external RBAC configured: allow by default
			return next();
		}
		const url = `${baseUrl.replace(/\/$/, '')}/api/phan-quyen/check`;
		const rbacRes = await axios.post(url, { MaNV, Action });
		if (rbacRes.data && rbacRes.data.allowed) {
			return next();
		}
		return res.status(403).json({ error: 'Không đủ quyền thực hiện hành động này', role: rbacRes.data?.role });
	} catch (err) {
		// If RBAC server unreachable, fail open to avoid cloud crash
		return next();
	}
}

function parseBinCode(binCode) {
	if (!binCode) return { rack: null, layout: null, bin: null };
	const segments = String(binCode).split('-');
	if (segments.length === 3) {
		return { rack: segments[0], layout: segments[1], bin: segments[2] };
	}
	if (segments.length === 2) {
		return { rack: segments[0], layout: null, bin: segments[1] };
	}
	return { rack: segments[0] || null, layout: null, bin: null };
}

// API: Lấy danh sách phiếu nhập kho
router.get('/', async (req, res) => {
	try {
		const db = await getDb();
		const rows = await db.all('SELECT * FROM GIAO_DICH_NHAP_KHO ORDER BY NgayGiaoDich DESC');
		res.json(rows);
	} catch (err) {
		res.status(500).json({ error: 'Lỗi truy vấn nhập kho', details: err.message });
	}
});

// API: Lịch sử nhập kho giới hạn (dùng cho dashboard)
router.get('/lich-su', async (req, res) => {
	const limitParam = Number.parseInt(req.query.limit, 10);
	const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 500 ? limitParam : 100;
	try {
		const db = await getDb();
		const rows = await db.all(
			'SELECT * FROM GIAO_DICH_NHAP_KHO ORDER BY NgayGiaoDich DESC LIMIT ?',
			[limit]
		);
		res.json(rows);
	} catch (err) {
		res.status(500).json({ error: 'Lỗi lấy lịch sử nhập kho', details: err.message });
	}
});

// API: Tạo mới phiếu nhập kho (demo in-memory)
router.post('/', (req, res) => {
	const phieuMoi = new NhapKho(req.body);
	dsNhapKho.push(phieuMoi);
	res.status(201).json(phieuMoi);
});

// API: Import phiếu nhập kho từ Excel (demo in-memory)
router.post('/import', (req, res) => {
	const danhSach = req.body;
	(Array.isArray(danhSach) ? danhSach : []).forEach((item) => dsNhapKho.push(new NhapKho(item)));
	res.status(201).json({ message: 'Đã import thành công', so_luong: Array.isArray(danhSach) ? danhSach.length : 0 });
});

// API: Ghi nhận nhập kho (bao gồm staging)
router.post('/ghi-nhan', checkRBAC, async (req, res) => {
	const {
		loai_nhap,
		ma_vat_tu,
		vendor_code,
		so_luong,
		nguoi_nhap,
		uom,
		so_phieu,
		ten_vat_tu,
		so_lo,
		vi_tri,
		han_su_dung,
		khu_vuc_nhan,
		ghi_chu,
		staging_mode,
		staging_bin_code,
		staging_zone_label
	} = req.body;

	let db;
	try {
		const quantity = Number(so_luong) || 0;
		if (!ma_vat_tu || quantity <= 0) {
			console.error('[NHAP KHO] Missing data:', { ma_vat_tu, vendor_code, quantity });
			return res.status(400).json({ error: 'Thiếu thông tin bắt buộc hoặc số lượng không hợp lệ', received: { ma_vat_tu, vendor_code, quantity } });
		}

		db = await getDb();
		await db.run('BEGIN');

		// Try to find material - if vendor_code provided, use it; otherwise find any match by SS_Code
		let row;
		if (vendor_code) {
			row = await db.get('SELECT * FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [ma_vat_tu, vendor_code]);
		} else {
			// If no vendor_code provided, try to find by SS_Code only
			const rows = await db.all('SELECT * FROM KHO WHERE SS_Code = ?', [ma_vat_tu]);
			if (rows.length === 1) {
				row = rows[0];
			} else if (rows.length > 1) {
				await db.run('ROLLBACK');
				return res.status(400).json({ error: 'SS_Code tồn tại với nhiều Vendor_code. Vui lòng chọn Vendor_code cụ thể.', options: rows });
			}
		}
		
		if (!row) {
			console.error('[NHAP KHO] Material not found:', { ma_vat_tu, vendor_code });
			await db.run('ROLLBACK');
			return res.status(404).json({ error: 'Không tìm thấy vật tư', ss_code: ma_vat_tu, vendor_code });
		}

		if (uom && row.UoM && uom !== row.UoM) {
			await db.run('ROLLBACK');
			return res.status(400).json({ error: 'Đơn vị tính không khớp', expected: row.UoM, received: uom });
		}

		const stagingMode = staging_mode === true || staging_mode === 'true' || staging_mode === 1;
		const targetBin = stagingMode ? (staging_bin_code || 'TEMP-BIN-01') : (vi_tri || null);
		const targetZone = stagingMode ? (staging_zone_label || 'Kho tạm') : (khu_vuc_nhan || null);

		const beforeKhoOK = Number(row.Kho_OK) || 0;
		const beforeTonChoKiem = Number(row.Ton_Cho_Kiem) || 0;
		let new_Kho_OK = beforeKhoOK;
		let new_Kho_NG = Number(row.Kho_NG) || 0;
		let new_Ton_Line = Number(row.Ton_Line) || 0;
		let new_Ton_C_Tien = Number(row.Ton_C_Tien ?? row.Ton_C_tien) || 0;
		let new_Ton_Muon = Number(row.Ton_Muon) || 0;
		let new_Ton_Cho_Kiem = beforeTonChoKiem;

		if (stagingMode) {
			new_Ton_Cho_Kiem += quantity;
		} else if (loai_nhap === 'nhap_line_ok') {
			if (new_Ton_Line < quantity) {
				await db.run('ROLLBACK');
				return res.status(400).json({ error: 'Tồn Line không đủ để trả về kho' });
			}
			new_Kho_OK += quantity;
			new_Ton_Line -= quantity;
		} else if (loai_nhap === 'nhap_line_ng') {
			if (new_Ton_Line < quantity) {
				await db.run('ROLLBACK');
				return res.status(400).json({ error: 'Tồn Line không đủ để ghi nhận NG' });
			}
			new_Kho_NG += quantity;
			new_Ton_Line -= quantity;
			await db.run(
				'INSERT INTO NG_PHES_PHAM (MaVatTu, MaNCC, SoLuong, NguoiThucHien, NgayGhiNhan, GhiChu) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
				[ma_vat_tu, vendor_code || row.Vendor_code, quantity, nguoi_nhap, ghi_chu || 'Nhập NG']
			);
		} else if (loai_nhap === 'nhap_cro') {
			// Nhập CRO = nhập mới từ bên ngoài vào kho (như nhập từ nhà cung cấp)
			new_Kho_OK += quantity;
		} else if (loai_nhap === 'nhap_cai_tien') {
			// Nhập vào khu vực cải tiến
			new_Ton_C_Tien += quantity;
		} else if (loai_nhap === 'nhap_muon') {
			if (new_Ton_Muon < quantity) {
				await db.run('ROLLBACK');
				return res.status(400).json({ error: 'Tồn mượn không đủ để trả về kho' });
			}
			new_Kho_OK += quantity;
			new_Ton_Muon -= quantity;
		} else if (loai_nhap === 'nhap_new_item') {
			new_Kho_OK += quantity;
		} else {
			await db.run('ROLLBACK');
			return res.status(400).json({ error: 'Loại nhập không hợp lệ' });
		}

		const new_Tong_ton = Math.max(0, new_Kho_OK + new_Kho_NG + new_Ton_Line + new_Ton_C_Tien + new_Ton_Muon + new_Ton_Cho_Kiem);

		// Update KHO using ID if available, otherwise use SS_Code + Vendor_code
		if (row.ID) {
			await db.run(
				'UPDATE KHO SET Kho_OK = ?, Kho_NG = ?, Ton_Line = ?, Ton_C_Tien = ?, Ton_Muon = ?, Ton_Cho_Kiem = ?, Tong_ton = ? WHERE ID = ?',
				[new_Kho_OK, new_Kho_NG, new_Ton_Line, new_Ton_C_Tien, new_Ton_Muon, new_Ton_Cho_Kiem, new_Tong_ton, row.ID]
			);
		} else {
			await db.run(
				'UPDATE KHO SET Kho_OK = ?, Kho_NG = ?, Ton_Line = ?, Ton_C_Tien = ?, Ton_Muon = ?, Ton_Cho_Kiem = ?, Tong_ton = ? WHERE SS_Code = ? AND Vendor_code = ?',
				[new_Kho_OK, new_Kho_NG, new_Ton_Line, new_Ton_C_Tien, new_Ton_Muon, new_Ton_Cho_Kiem, new_Tong_ton, ma_vat_tu, vendor_code || row.Vendor_code]
			);
		}

		if (targetBin) {
			const existingBin = await db.get('SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ?', [targetBin]);
			if (existingBin) {
				if (existingBin.SS_code && existingBin.SS_code !== ma_vat_tu) {
					await db.run('ROLLBACK');
					return res.status(409).json({ error: `Bin ${targetBin} đang được gán cho vật tư khác` });
				}
				const updatedOk = (Number(existingBin.OK) || 0) + quantity;
				await db.run(
					`UPDATE BIN_VI_TRI SET
						 OK = ?,
						 SS_code = ?,
						 Vendor_code = ?,
						 Item = COALESCE(Item, ?),
						 Model = COALESCE(Model, ?),
						 Type_Item = COALESCE(Type_Item, ?),
						 Don_vi = COALESCE(Don_vi, ?),
						 Trang_thai_Bin = ?
					 WHERE Bin_Code = ?`,
					[
						updatedOk,
						ma_vat_tu,
						vendor_code,
						row.Item || ten_vat_tu || null,
						row.Model || null,
						row.Type_Item || null,
						row.Don_vi || null,
						stagingMode ? 'Quarantine' : 'Occupied',
						targetBin
					]
				);
			} else {
				const { rack, layout, bin } = parseBinCode(targetBin);
				await db.run(
					`INSERT INTO BIN_VI_TRI (Rack, Layout, Bin, Bin_Code, SS_code, Vendor_code, Item, Model, Type_Item, Don_vi, OK, NG, Stock, Capacity, Trang_thai_Bin)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
					[
						rack,
						layout,
						bin,
						targetBin,
						ma_vat_tu,
						vendor_code,
						row.Item || ten_vat_tu || null,
						row.Model || null,
						row.Type_Item || null,
						row.Don_vi || null,
						quantity,
						stagingMode ? 'Quarantine' : 'Occupied'
					]
				);
			}
		}

		let soPhieuValue = so_phieu;
		if (!soPhieuValue) {
			const countRow = await db.get('SELECT COUNT(*) as cnt FROM GIAO_DICH_NHAP_KHO');
			const stt = (countRow?.cnt || 0) + 1;
			soPhieuValue = `MAGD_${String(stt).padStart(4, '0')}`;
		}

		await db.run(
			`INSERT INTO GIAO_DICH_NHAP_KHO (
				SoPhieu, MaVatTu, MaNCC, TenVatTu, SoLuong, ViTri, NguoiThucHien, KhuVucNhan, NgayGiaoDich, LoaiGiaoDich, GhiChu
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
			[
				soPhieuValue,
				ma_vat_tu,
				vendor_code,
				ten_vat_tu || row.Item || null,
				quantity,
				targetBin,
				nguoi_nhap,
				targetZone,
				loai_nhap,
				ghi_chu || null
			]
		);

		await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', [
			'NHAP_KHO',
			`Ghi nhận nhập kho: ${ma_vat_tu}, ${quantity}, ${loai_nhap}${stagingMode ? ' (staging)' : ''}`
		]);

		await db.run('COMMIT');

		const delta = stagingMode ? new_Ton_Cho_Kiem - beforeTonChoKiem : new_Kho_OK - beforeKhoOK;
		return res.json({
			message: 'Đã ghi nhận nhập kho',
			Kho_OK: new_Kho_OK,
			Kho_NG: new_Kho_NG,
			Ton_Line: new_Ton_Line,
			Ton_C_Tien: new_Ton_C_Tien,
			Ton_Muon: new_Ton_Muon,
			Ton_Cho_Kiem: new_Ton_Cho_Kiem,
			Tong_ton: new_Tong_ton,
			inventoryChange: {
				transactionCode: soPhieuValue,
				transactionType: stagingMode ? 'NHAP_STAGING' : 'NHAP_KHO',
				timestamp: new Date().toISOString(),
				items: [
					{
						ssCode: ma_vat_tu,
						vendorCode: vendor_code,
						itemName: row.Item || ten_vat_tu || null,
						beforeQuantity: stagingMode ? beforeTonChoKiem : beforeKhoOK,
						deltaQuantity: delta,
						afterQuantity: stagingMode ? new_Ton_Cho_Kiem : new_Kho_OK,
						binCode: targetBin || null,
						quantityLabel: stagingMode ? 'Tồn kho tạm' : 'Tồn kho OK',
						zone: targetZone
					}
				]
			}
		});
	} catch (err) {
		console.error('[NHAP KHO ERROR]', err);
		if (db) {
			try {
				await db.run('ROLLBACK');
			} catch {
				// ignore rollback error
			}
		}
		return res.status(500).json({ error: 'Lỗi ghi nhận nhập kho', details: err.message, stack: err.stack });
	}
});

// API: Khởi tạo vật tư mới và nhập kho nhanh (Master + GR)
router.post('/quick-receive', checkRBAC, async (req, res) => {
	const { master = {}, receipt = {} } = req.body || {};

	const ssCode = typeof master.ssCode === 'string' ? master.ssCode.trim() : '';
	const vendorCode = typeof master.vendorCode === 'string' ? master.vendorCode.trim() : '';
	const itemName = typeof master.itemName === 'string' ? master.itemName.trim() : '';
	const unit = typeof master.unit === 'string' ? master.unit.trim() : '';
	const typeItem = typeof master.typeItem === 'string' ? master.typeItem.trim() : '';
	const model = typeof master.model === 'string' ? master.model.trim() : null;
	const uom = typeof master.uom === 'string' ? master.uom.trim() : unit;

	if (!ssCode || !vendorCode || !itemName || !unit || !typeItem) {
		return res.status(400).json({ error: 'Thiếu thông tin master data bắt buộc (ssCode, vendorCode, itemName, unit, typeItem)' });
	}

	const quantity = Number(receipt.quantity) || 0;
	if (quantity <= 0) {
		return res.status(400).json({ error: 'Số lượng nhập phải lớn hơn 0' });
	}

	const stagingMode = receipt.stagingMode !== false;
	const targetBin = stagingMode
		? (typeof receipt.binCode === 'string' && receipt.binCode.trim() ? receipt.binCode.trim() : 'TEMP-BIN-01')
		: (typeof receipt.binCode === 'string' && receipt.binCode.trim() ? receipt.binCode.trim() : null);
	const targetZone = stagingMode ? 'Kho tạm' : (receipt.zone || null);
	const nguoiNhap = receipt.nguoiNhap || receipt.operator || 'system';
	const ghiChu = receipt.ghiChu || null;

	let db;
	try {
		db = await getDb();
		await db.run('BEGIN');

		const existing = await db.get('SELECT 1 FROM KHO WHERE SS_Code = ? AND Vendor_code = ?', [ssCode, vendorCode]);
		if (existing) {
			await db.run('ROLLBACK');
			return res.status(409).json({ error: `Vật tư ${ssCode} - ${vendorCode} đã tồn tại` });
		}

		await db.run(
			`INSERT INTO KHO (
				SS_Code, Vendor_code, Item, Trung, Don_vi, Type_Item, Model, UoM,
				Kho_OK, Ton_Line, Ton_C_Tien, Ton_Muon, Kho_NG, Ton_Cho_Kiem, Tong_ton
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0)`,
			[ssCode, vendorCode, itemName, itemName, unit, typeItem, model, uom]
		);

		const newKhoOK = stagingMode ? 0 : quantity;
		const newTonChoKiem = stagingMode ? quantity : 0;
		const newTongTon = newKhoOK + newTonChoKiem;

		await db.run(
			'UPDATE KHO SET Kho_OK = ?, Ton_Cho_Kiem = ?, Tong_ton = ? WHERE SS_Code = ? AND Vendor_code = ?',
			[newKhoOK, newTonChoKiem, newTongTon, ssCode, vendorCode]
		);

		if (targetBin) {
			const existingBin = await db.get('SELECT * FROM BIN_VI_TRI WHERE Bin_Code = ?', [targetBin]);
			if (existingBin) {
				if (existingBin.SS_code && existingBin.SS_code !== ssCode) {
					await db.run('ROLLBACK');
					return res.status(409).json({ error: `Bin ${targetBin} đang được gán cho vật tư khác` });
				}
				const updatedOk = (Number(existingBin.OK) || 0) + quantity;
				await db.run(
					`UPDATE BIN_VI_TRI SET
						 OK = ?,
						 SS_code = ?,
						 Vendor_code = ?,
						 Item = ?,
						 Model = COALESCE(Model, ?),
						 Type_Item = COALESCE(Type_Item, ?),
						 Don_vi = COALESCE(Don_vi, ?),
						 Trang_thai_Bin = ?
					 WHERE Bin_Code = ?`,
					[
						updatedOk,
						ssCode,
						vendorCode,
						itemName,
						model,
						typeItem,
						unit,
						stagingMode ? 'Quarantine' : 'Occupied',
						targetBin
					]
				);
			} else {
				const { rack, layout, bin } = parseBinCode(targetBin);
				await db.run(
					`INSERT INTO BIN_VI_TRI (Rack, Layout, Bin, Bin_Code, SS_code, Vendor_code, Item, Model, Type_Item, Don_vi, OK, NG, Stock, Capacity, Trang_thai_Bin)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`
					, [
						rack,
						layout,
						bin,
						targetBin,
						ssCode,
						vendorCode,
						itemName,
						model,
						typeItem,
						unit,
						quantity,
						stagingMode ? 'Quarantine' : 'Occupied'
					]
				);
			}
		}

		const countRow = await db.get('SELECT COUNT(*) as cnt FROM GIAO_DICH_NHAP_KHO');
		const stt = (countRow?.cnt || 0) + 1;
		const transactionCode = receipt.transactionCode || `MAGD_NEW_${String(stt).padStart(4, '0')}`;
		const loaiGiaoDich = stagingMode ? 'nhap_new_item_staging' : 'nhap_new_item';

		await db.run(
			`INSERT INTO GIAO_DICH_NHAP_KHO (
				SoPhieu, MaVatTu, MaNCC, TenVatTu, SoLuong, ViTri, NguoiThucHien, KhuVucNhan, NgayGiaoDich, LoaiGiaoDich, GhiChu
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
			[
				transactionCode,
				ssCode,
				vendorCode,
				itemName,
				quantity,
				targetBin,
				nguoiNhap,
				targetZone,
				loaiGiaoDich,
				ghiChu
			]
		);

		await db.run('INSERT INTO LOG_NGHIEP_VU (Loai, NoiDung, ThoiGian) VALUES (?, ?, CURRENT_TIMESTAMP)', [
			'NHAP_KHO',
			`Quick receive vật tư mới ${ssCode} (${quantity})${stagingMode ? ' vào kho tạm' : ''}`
		]);

		await db.run('COMMIT');

		return res.json({
			message: 'Đã khởi tạo vật tư mới và ghi nhận nhập kho',
			transactionCode,
			inventoryChange: {
				transactionCode,
				transactionType: stagingMode ? 'NHAP_STAGING' : 'NHAP_KHO',
				timestamp: new Date().toISOString(),
				items: [
					{
						ssCode,
						vendorCode,
						itemName,
						beforeQuantity: 0,
						deltaQuantity: quantity,
						afterQuantity: stagingMode ? quantity : quantity,
						binCode: targetBin,
						quantityLabel: stagingMode ? 'Tồn kho tạm' : 'Tồn kho OK',
						zone: targetZone
					}
				]
			}
		});
	} catch (err) {
		if (db) {
			try {
				await db.run('ROLLBACK');
			} catch {
				// ignore rollback error
			}
		}
		return res.status(500).json({ error: 'Lỗi quick receive vật tư mới', details: err.message });
	}
});

export default router;
