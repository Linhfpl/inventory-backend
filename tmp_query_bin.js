import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({ filename: '../BD.db', driver: sqlite3.Database });
const rows = await db.all("SELECT Bin_Code, Rack, Layout, Bin, OK, Trang_thai_Bin, SS_code FROM BIN_VI_TRI WHERE Rack = 'A6'");
console.log(rows);
await db.close();
