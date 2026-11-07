import fs from 'fs';
import path from 'path';
import { Category, Transaction } from './types';
import { getThaiDate } from './thai-nlp';

// Default categories to seed
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'อาหารและเครื่องดื่ม', type: 'expense', icon: 'Utensils', color: '#f97316' },
  { id: 'cat_transport', name: 'การเดินทาง/พาหนะ', type: 'expense', icon: 'Car', color: '#3b82f6' },
  { id: 'cat_shopping', name: 'ช้อปปิ้ง/ของใช้', type: 'expense', icon: 'ShoppingBag', color: '#a855f7' },
  { id: 'cat_bills', name: 'บิล/สาธารณูปโภค', type: 'expense', icon: 'Receipt', color: '#ef4444' },
  { id: 'cat_entertainment', name: 'บันเทิง/สังสรรค์', type: 'expense', icon: 'Film', color: '#ec4899' },
  { id: 'cat_health', name: 'สุขภาพ/รักษาพยาบาล', type: 'expense', icon: 'HeartPulse', color: '#10b981' },
  { id: 'cat_salary', name: 'เงินเดือน/โบนัส', type: 'income', icon: 'Wallet', color: '#22c55e' },
  { id: 'cat_side_income', name: 'รายได้เสริม/ขายของ', type: 'income', icon: 'TrendingUp', color: '#06b6d4' },
  { id: 'cat_other', name: 'อื่นๆ', type: 'expense', icon: 'MoreHorizontal', color: '#64748b' },
];

interface LocalDatabaseState {
  users: { id: string; username: string; passwordHash: string; createdAt: string }[];
  categories: Category[];
  transactions: Transaction[];
  ownerId: string | null;
}

// Local storage path for Windows / Node / Vercel Serverless environment
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', '.data') : path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'money_tracker_db.json');
const SEED_FILE = path.join(process.cwd(), '.data', 'money_tracker_db.json');

function ensureDataFile(): LocalDatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('Could not create DATA_DIR', e);
    }
  }

  if (!fs.existsSync(DATA_FILE)) {
    // If seed file exists (bundled with deployment), copy it
    if (fs.existsSync(SEED_FILE)) {
      try {
        const seedContent = fs.readFileSync(SEED_FILE, 'utf-8');
        fs.writeFileSync(DATA_FILE, seedContent, 'utf-8');
        return JSON.parse(seedContent);
      } catch (err) {
        console.warn('Error reading seed file, using defaults', err);
      }
    }

    const initialState: LocalDatabaseState = {
      users: [],
      categories: DEFAULT_CATEGORIES,
      transactions: [],
      ownerId: null,
    };
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialState, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Error writing initial state to DATA_FILE', err);
    }
    return initialState;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading data file, re-initializing', err);
    return {
      users: [],
      categories: DEFAULT_CATEGORIES,
      transactions: [],
      ownerId: null,
    };
  }
}

function saveData(state: LocalDatabaseState) {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('Could not create DATA_DIR', e);
    }
  }
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data file', err);
  }
}

export const db = {
  // Categories
  getCategories: async (): Promise<Category[]> => {
    const state = ensureDataFile();
    return state.categories;
  },

  // Transactions
  getTransactions: async (includeDeleted = false): Promise<Transaction[]> => {
    const state = ensureDataFile();
    if (includeDeleted) return state.transactions;
    return state.transactions.filter((t) => !t.deletedAt);
  },

  getTransactionById: async (id: string): Promise<Transaction | null> => {
    const state = ensureDataFile();
    const item = state.transactions.find((t) => t.id === id);
    return item || null;
  },

  findRecentByNote: async (noteQuery: string): Promise<Transaction | null> => {
    const state = ensureDataFile();
    const active = state.transactions.filter((t) => !t.deletedAt);
    const found = active.reverse().find((t) => t.note.toLowerCase().includes(noteQuery.toLowerCase()));
    return found || null;
  },

  insertTransactions: async (newItems: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Transaction[]> => {
    const state = ensureDataFile();
    const nowIso = new Date().toISOString();
    const created: Transaction[] = [];

    for (const item of newItems) {
      const tx: Transaction = {
        ...item,
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      };
      state.transactions.push(tx);
      created.push(tx);
    }

    saveData(state);
    return created;
  },

  updateTransaction: async (id: string, updates: Partial<Transaction>): Promise<Transaction | null> => {
    const state = ensureDataFile();
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const current = state.transactions[index];
    const updated: Transaction = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    state.transactions[index] = updated;
    saveData(state);
    return updated;
  },

  deleteTransaction: async (id: string, soft = true): Promise<boolean> => {
    const state = ensureDataFile();
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) return false;

    if (soft) {
      state.transactions[index].deletedAt = new Date().toISOString();
      state.transactions[index].updatedAt = new Date().toISOString();
    } else {
      state.transactions.splice(index, 1);
    }

    saveData(state);
    return true;
  },

  restoreTransaction: async (id: string): Promise<Transaction | null> => {
    const state = ensureDataFile();
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) return null;

    state.transactions[index].deletedAt = null;
    state.transactions[index].updatedAt = new Date().toISOString();
    saveData(state);
    return state.transactions[index];
  },

  syncTransactions: async (items: Transaction[]): Promise<number> => {
    const state = ensureDataFile();
    let added = 0;
    const existingIds = new Set(state.transactions.map((t) => t.id));
    for (const item of items) {
      if (!existingIds.has(item.id)) {
        state.transactions.push(item);
        existingIds.add(item.id);
        added++;
      }
    }
    if (added > 0) saveData(state);
    return added;
  },

  // Owner & Authentication
  getOwner: async () => {
    const state = ensureDataFile();
    return {
      hasOwner: state.users.length > 0,
      ownerUsername: state.users[0]?.username || null,
    };
  },

  registerOwner: async (username: string, passwordHash: string) => {
    const state = ensureDataFile();
    if (state.users.length > 0) {
      throw new Error('Registration closed: System already has an owner');
    }
    const user = {
      id: `usr_${Date.now()}`,
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    state.users.push(user);
    state.ownerId = user.id;
    saveData(state);
    return user;
  },

  getUserByUsername: async (username: string) => {
    const state = ensureDataFile();
    return state.users.find((u) => u.username === username) || null;
  },
};
