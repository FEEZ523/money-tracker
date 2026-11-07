import { db } from './db';
import { parseThaiExpenseInput, getThaiDate } from './thai-nlp';
import { FinancialSummary, Transaction } from './types';

export const moneyService = {
  /**
   * Record transactions from natural language Thai input
   * e.g. "ข้าวมันไก่ 60 กาแฟ 55"
   */
  async recordFromNaturalLanguage(
    text: string,
    source: 'web' | 'antigravity' | 'chatgpt' | 'gemini' = 'web',
    userId: string = 'owner'
  ): Promise<{ message: string; created: Transaction[]; isCorrection?: boolean }> {
    const parsed = parseThaiExpenseInput(text);
    if (parsed.length === 0) {
      throw new Error('ไม่สามารถระบุยอดเงินหรือรายการได้ กรุณาพิมพ์เช่น "ข้าวมันไก่ 60" หรือ "กาแฟ 55"');
    }

    // Check if user is trying to correct a recent entry (e.g. "เมื่อกี้ใส่ผิด ข้าวมันไก่เป็น 65")
    if (text.includes('เมื่อกี้ใส่ผิด') || text.includes('แก้เป็น') || text.includes('เปลี่ยนเป็น')) {
      const correction = parsed[0];
      const match = await db.findRecentByNote(correction.note);
      if (match) {
        const updated = await db.updateTransaction(match.id, {
          amountSatang: correction.amountSatang,
          note: correction.note,
          source,
        });
        return {
          message: `แก้ไขรายการ "${match.note}" เป็น ${(correction.amountSatang / 100).toLocaleString('th-TH')} บาท เรียบร้อยแล้ว`,
          created: updated ? [updated] : [],
          isCorrection: true,
        };
      }
    }

    const categories = await db.getCategories();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const itemsToInsert = parsed.map((item) => ({
      userId,
      amountSatang: item.amountSatang,
      type: item.type,
      categoryId: item.categoryGuessId,
      categoryName: catMap.get(item.categoryGuessId) || 'ทั่วไป',
      note: item.note,
      source,
      transactionDate: item.dateStr || getThaiDate(0),
      deletedAt: null,
    }));

    const created = await db.insertTransactions(itemsToInsert);
    const summaryText = created
      .map((t) => `• ${t.note}: ${(t.amountSatang / 100).toLocaleString('th-TH')} บาท (${t.categoryName})`)
      .join('\n');

    return {
      message: `บันทึกเรียบร้อย ${created.length} รายการ:\n${summaryText}`,
      created,
    };
  },

  /**
   * Get financial summary with category breakdown, comparison, and heatmap data
   */
  async getSummary(period: 'month' | 'today' | 'all' = 'month'): Promise<FinancialSummary> {
    const all = await db.getTransactions(false);
    const categories = await db.getCategories();
    const catMap = new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }]));

    const todayStr = getThaiDate(0);
    const currentYearMonth = todayStr.substring(0, 7); // e.g. "2026-11"

    // Previous month string
    const [y, m] = currentYearMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevYearMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // Filter by period
    const currentPeriodTransactions = all.filter((t) => {
      if (period === 'today') return t.transactionDate === todayStr;
      if (period === 'month') return t.transactionDate.startsWith(currentYearMonth);
      return true;
    });

    const prevPeriodTransactions = all.filter((t) => t.transactionDate.startsWith(prevYearMonth));

    let totalIncomeSatang = 0;
    let totalExpenseSatang = 0;
    const catTotals: Record<string, { satang: number; count: number }> = {};

    for (const t of currentPeriodTransactions) {
      if (t.type === 'income') {
        totalIncomeSatang += t.amountSatang;
      } else {
        totalExpenseSatang += t.amountSatang;
        if (!catTotals[t.categoryId]) {
          catTotals[t.categoryId] = { satang: 0, count: 0 };
        }
        catTotals[t.categoryId].satang += t.amountSatang;
        catTotals[t.categoryId].count += 1;
      }
    }

    const previousPeriodExpenseSatang = prevPeriodTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountSatang, 0);

    const expenseChangePercentage =
      previousPeriodExpenseSatang > 0
        ? Math.round(((totalExpenseSatang - previousPeriodExpenseSatang) / previousPeriodExpenseSatang) * 100)
        : 0;

    const categoryBreakdown = Object.entries(catTotals).map(([catId, data]) => {
      const catInfo = catMap.get(catId) || { name: 'อื่นๆ', color: '#64748b' };
      const percentage = totalExpenseSatang > 0 ? Math.round((data.satang / totalExpenseSatang) * 100) : 0;
      return {
        categoryId: catId,
        categoryName: catInfo.name,
        totalSatang: data.satang,
        count: data.count,
        percentage,
        color: catInfo.color,
      };
    });

    // Sort by largest spending first
    categoryBreakdown.sort((a, b) => b.totalSatang - a.totalSatang);

    // Heatmap data (last 14 days)
    const dailySpendingMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = getThaiDate(-i);
      dailySpendingMap[d] = 0;
    }
    for (const t of all) {
      if (t.type === 'expense' && dailySpendingMap[t.transactionDate] !== undefined) {
        dailySpendingMap[t.transactionDate] += t.amountSatang;
      }
    }

    const maxDailySatang = Math.max(...Object.values(dailySpendingMap), 1);
    const dailySpending = Object.entries(dailySpendingMap).map(([date, satang]) => {
      const ratio = satang / maxDailySatang;
      let intensity = 0;
      if (satang > 0) intensity = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
      return { date, totalSatang: satang, intensity };
    });

    // Recent 20 transactions sorted by date descending
    const recent = [...all].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 20);

    return {
      period: period === 'month' ? currentYearMonth : period === 'today' ? todayStr : 'ทั้งหมด',
      totalIncomeSatang,
      totalExpenseSatang,
      netBalanceSatang: totalIncomeSatang - totalExpenseSatang,
      previousPeriodExpenseSatang,
      expenseChangePercentage,
      categoryBreakdown,
      recentTransactions: recent,
      dailySpending,
    };
  },

  async deleteTransaction(id: string, soft = true) {
    return await db.deleteTransaction(id, soft);
  },

  async restoreTransaction(id: string) {
    return await db.restoreTransaction(id);
  },

  async updateTransaction(id: string, updates: Partial<Transaction>) {
    return await db.updateTransaction(id, updates);
  },

  async listCategories() {
    return await db.getCategories();
  },
};
