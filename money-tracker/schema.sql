-- Schema for Cloudflare D1 / SQLite Database
-- Monetary amounts are stored in satang (1 THB = 100 satang)
-- Dates are stored according to Thai timezone (Asia/Bangkok)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', '+7 hours'))
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('expense', 'income')) NOT NULL,
    icon TEXT,
    color TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount_satang INTEGER NOT NULL,          -- e.g. 6000 satang = 60.00 THB
    type TEXT CHECK(type IN ('expense', 'income')) NOT NULL,
    category_id TEXT,
    note TEXT NOT NULL,                      -- e.g. "ข้าวมันไก่"
    source TEXT DEFAULT 'web',               -- 'web' or 'antigravity'
    transaction_date TEXT NOT NULL,          -- YYYY-MM-DD
    created_at DATETIME DEFAULT (datetime('now', '+7 hours')),
    updated_at DATETIME DEFAULT (datetime('now', '+7 hours')),
    deleted_at DATETIME                      -- NULL means active; datetime means soft deleted
);

-- Pre-seed default categories
INSERT OR IGNORE INTO categories (id, name, type, icon, color) VALUES
('cat_food', 'อาหารและเครื่องดื่ม', 'expense', 'Utensils', '#f97316'),
('cat_transport', 'การเดินทาง/พาหนะ', 'expense', 'Car', '#3b82f6'),
('cat_shopping', 'ช้อปปิ้ง/ของใช้', 'expense', 'ShoppingBag', '#a855f7'),
('cat_bills', 'บิล/สาธารณูปโภค', 'expense', 'Receipt', '#ef4444'),
('cat_entertainment', 'บันเทิง/สังสรรค์', 'expense', 'Film', '#ec4899'),
('cat_health', 'สุขภาพ/รักษาพยาบาล', 'expense', 'HeartPulse', '#10b981'),
('cat_salary', 'เงินเดือน/โบนัส', 'income', 'Wallet', '#22c55e'),
('cat_side_income', 'รายได้เสริม/ขายของ', 'income', 'TrendingUp', '#06b6d4'),
('cat_other', 'อื่นๆ', 'expense', 'MoreHorizontal', '#64748b');
