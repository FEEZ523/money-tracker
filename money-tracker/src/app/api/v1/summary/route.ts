import { NextRequest, NextResponse } from 'next/server';
import { moneyService } from '@/lib/service';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') as 'month' | 'today' | 'all') || 'month';
    const summary = await moneyService.getSummary(period);

    return NextResponse.json(
      {
        period: summary.period,
        totalIncomeBaht: summary.totalIncomeSatang / 100,
        totalExpenseBaht: summary.totalExpenseSatang / 100,
        netBalanceBaht: summary.netBalanceSatang / 100,
        categoryBreakdown: summary.categoryBreakdown.map((c) => ({
          name: c.categoryName,
          amountBaht: c.totalSatang / 100,
          percentage: c.percentage,
          count: c.count,
        })),
        recentTransactions: summary.recentTransactions.slice(0, 10).map((t) => ({
          note: t.note,
          amountBaht: t.amountSatang / 100,
          type: t.type,
          category: t.categoryName,
          date: t.transactionDate,
          source: t.source,
        })),
      },
      {
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}
