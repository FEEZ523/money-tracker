import { NextRequest, NextResponse } from 'next/server';
import { moneyService } from '@/lib/service';

// Allow CORS so ChatGPT Actions & Web Clients can call directly
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, source = 'chatgpt' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อความรายการ เช่น "ข้าวมันไก่ 60"' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Determine source label
    const validSource = source.toLowerCase().includes('gemini')
      ? 'gemini'
      : source.toLowerCase().includes('chatgpt')
      ? 'chatgpt'
      : source.toLowerCase().includes('antigravity')
      ? 'antigravity'
      : 'web';

    const result = await moneyService.recordFromNaturalLanguage(
      text,
      validSource as any,
      'owner'
    );

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        source: validSource,
        itemsCount: result.created.length,
        created: result.created.map((t) => ({
          id: t.id,
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
      { error: err.message || 'เกิดข้อผิดพลาดในการบันทึก' },
      {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}
