import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseThaiExpenseInput, getThaiDate } from '@/lib/thai-nlp';
import { ParsedItem, Transaction } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, apiKey: clientApiKey } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อความที่ต้องการจด เช่น "ข้าวมันไก่ 60 กาแฟ 55"' },
        { status: 400 }
      );
    }

    const apiKey =
      clientApiKey ||
      req.headers.get('x-gemini-api-key') ||
      process.env.GEMINI_API_KEY ||
      '';

    let parsedItems: {
      note: string;
      amountSatang: number;
      type: 'expense' | 'income';
      categoryId: string;
    }[] = [];
    let aiMessage = '';

    // If Gemini API Key is provided, call Google Gemini API
    if (apiKey) {
      try {
        const prompt = `You are a high-speed Scuderia Ferrari AI financial expense tracker assistant.
The user speaks or types their expenses or income in natural Thai language:
"${text.trim()}"

Extract each transaction into JSON.
Return ONLY a valid JSON object matching this schema without markdown code blocks:
{
  "reply": "Short, cool, inspiring reply in Thai (Ferrari / Scuderia motivation style, under 25 words)",
  "items": [
    {
      "note": "name of expense/income in Thai",
      "amountBaht": number (e.g. 60 or 1500),
      "type": "expense" or "income",
      "categoryId": one of ["cat_food", "cat_transport", "cat_shopping", "cat_bills", "cat_entertainment", "cat_health", "cat_salary", "cat_side_income", "cat_other"]
    }
  ]
}

Categories guide:
- cat_food: อาหาร, ข้าว, กาแฟ, ชานม, ขนม, สเต็ก, บุฟเฟต์
- cat_transport: รถเมล์, BTS, MRT, วิน, แท็กซี่, ค่าน้ำมัน, ทางด่วน, ค่าซ่อมรถ
- cat_shopping: เสื้อผ้า, ซื้อของ, shopee, lazada, ของใช้
- cat_bills: ค่าน้ำ, ค่าไฟ, ค่าเน็ต, ค่าห้อง, บิลต่างๆ
- cat_entertainment: ดูหนัง, เที่ยว, สังสรรค์, เกม, netflix
- cat_health: ยา, หมอ, ฟิตเนส, อาหารเสริม
- cat_salary: เงินเดือน, โบนัส
- cat_side_income: ขายของได้, ได้เงินคืน, รายได้เสริม, ดอกเบี้ย
- cat_other: อื่นๆ`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawOutput = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawOutput) {
            const parsedJson = JSON.parse(rawOutput);
            aiMessage = parsedJson.reply || '';
            if (Array.isArray(parsedJson.items)) {
              parsedItems = parsedJson.items.map((it: any) => ({
                note: it.note || 'รายการทั่วไป',
                amountSatang: Math.round(Math.abs(Number(it.amountBaht) || 0) * 100),
                type: it.type === 'income' ? 'income' : 'expense',
                categoryId: it.categoryId || 'cat_food',
              }));
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to local NLP:', geminiErr);
      }
    }

    // Fallback to built-in Thai NLP if Gemini didn't return items
    if (parsedItems.length === 0) {
      const localParsed = parseThaiExpenseInput(text);
      parsedItems = localParsed.map((p) => ({
        note: p.note,
        amountSatang: p.amountSatang,
        type: p.type,
        categoryId: p.categoryGuessId || 'cat_food',
      }));
      if (!aiMessage) {
        aiMessage = 'บันทึกเรียบร้อยครับบอส! ขับเคลื่อนสู่เป้าหมายด้วยวินัยทุกวัน 🏎️';
      }
    }

    if (parsedItems.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบจำนวนเงินในข้อความ กรุณาระบุ เช่น "ข้าวมันไก่ 60"' },
        { status: 400 }
      );
    }

    const categories = await db.getCategories();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const today = getThaiDate(0);

    const newRows = parsedItems.map((item) => ({
      userId: 'owner',
      amountSatang: item.amountSatang,
      type: item.type,
      categoryId: item.categoryId,
      categoryName: catMap.get(item.categoryId) || 'ทั่วไป',
      note: item.note,
      source: 'gemini' as const,
      transactionDate: today,
      deletedAt: null,
    }));

    const created = await db.insertTransactions(newRows);

    const summaryText = created
      .map(
        (c) =>
          `• ${c.note}: ${c.type === 'income' ? '+' : '-'}฿ ${(c.amountSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
      )
      .join('\n');

    return NextResponse.json({
      success: true,
      message: `บันทึกผ่าน Gemini AI สำเร็จ ${created.length} รายการ:\n${summaryText}`,
      geminiReply: aiMessage,
      created,
      hasCustomApiKey: Boolean(apiKey),
    });
  } catch (error: any) {
    console.error('Gemini record API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
