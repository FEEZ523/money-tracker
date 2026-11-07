import { NextRequest, NextResponse } from 'next/server';
import { moneyService } from '@/lib/service';

export async function GET(req: NextRequest) {
  try {
    const summary = await moneyService.getSummary('month');
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, source } = body;
    if (!text) {
      return NextResponse.json({ error: 'กรุณาระบุข้อความรายการ' }, { status: 400 });
    }

    const result = await moneyService.recordFromNaturalLanguage(text, source || 'web');
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactions } = body;
    const { db } = await import('@/lib/db');
    if (Array.isArray(transactions) && transactions.length > 0) {
      const count = await db.syncTransactions(transactions);
      return NextResponse.json({ success: true, synced: count });
    }
    return NextResponse.json({ success: true, synced: 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const restore = searchParams.get('restore') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    if (restore) {
      const restored = await moneyService.restoreTransaction(id);
      return NextResponse.json({ success: true, restored });
    } else {
      const success = await moneyService.deleteTransaction(id, true);
      return NextResponse.json({ success });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
