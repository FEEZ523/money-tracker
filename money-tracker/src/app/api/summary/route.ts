import { NextRequest, NextResponse } from 'next/server';
import { moneyService } from '@/lib/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') as 'month' | 'today' | 'all') || 'month';
    const summary = await moneyService.getSummary(period);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
