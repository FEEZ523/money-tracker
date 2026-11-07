export type TransactionType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amountSatang: number; // Stored in satang (100 satang = 1 THB)
  type: TransactionType;
  categoryId: string;
  categoryName?: string;
  note: string;
  source: 'web' | 'antigravity' | 'chatgpt' | 'gemini';
  transactionDate: string; // YYYY-MM-DD (Thai timezone)
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface FinancialSummary {
  period: string;
  totalIncomeSatang: number;
  totalExpenseSatang: number;
  netBalanceSatang: number;
  previousPeriodExpenseSatang: number;
  expenseChangePercentage: number;
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    totalSatang: number;
    count: number;
    percentage: number;
    color: string;
  }[];
  recentTransactions: Transaction[];
  dailySpending: {
    date: string; // YYYY-MM-DD
    totalSatang: number;
    intensity: number; // 0 - 4 for heatmap
  }[];
}

export interface ParsedItem {
  note: string;
  amountSatang: number;
  type: TransactionType;
  categoryGuessId: string;
  dateStr?: string; // YYYY-MM-DD
}
