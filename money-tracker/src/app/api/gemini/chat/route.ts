import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moneyService } from '@/lib/service';
import { parseThaiExpenseInput, getThaiDate } from '@/lib/thai-nlp';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], apiKey: clientApiKey } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุข้อความ' }, { status: 400 });
    }

    const trimmedMsg = message.trim();
    const apiKey =
      clientApiKey ||
      req.headers.get('x-gemini-api-key') ||
      process.env.GEMINI_API_KEY ||
      '';

    // Fetch live financial summaries for context
    const monthSummary = await moneyService.getSummary('month');
    const todaySummary = await moneyService.getSummary('today');

    const totalIncomeBaht = monthSummary.totalIncomeSatang / 100;
    const totalExpenseBaht = monthSummary.totalExpenseSatang / 100;
    const netBalanceBaht = monthSummary.netBalanceSatang / 100;
    const todayExpenseBaht = todaySummary.totalExpenseSatang / 100;

    const topCategories = [...monthSummary.categoryBreakdown].sort(
      (a, b) => b.totalSatang - a.totalSatang
    );

    // Helper: Determine if message is primarily a query vs transaction
    const isQuery =
      trimmedMsg.includes('สรุป') ||
      trimmedMsg.includes('หายไปไหน') ||
      trimmedMsg.includes('มากที่สุด') ||
      trimmedMsg.includes('มากสุด') ||
      trimmedMsg.includes('เท่าไหร่') ||
      trimmedMsg.includes('กี่บาท') ||
      trimmedMsg.includes('เหลือ') ||
      trimmedMsg.includes('วิเคราะห์') ||
      trimmedMsg.includes('วันนี้ใช้') ||
      trimmedMsg.includes('เดือนนี้') ||
      trimmedMsg.includes('ช่วยดู') ||
      trimmedMsg.endsWith('?') ||
      trimmedMsg.endsWith('ไหม') ||
      trimmedMsg.endsWith('มั้ย');

    // Case 1: Transaction Recording Intent
    if (!isQuery) {
      let parsedItems: {
        note: string;
        amountSatang: number;
        type: 'expense' | 'income';
        categoryId: string;
      }[] = [];
      let aiReply = '';

      if (apiKey) {
        try {
          const geminiPrompt = `You are a high-speed Scuderia Ferrari AI financial assistant.
User says: "${trimmedMsg}"
If this is recording expenses or income, extract all items into JSON:
{
  "reply": "Inspiring, cool confirmation in Thai (under 25 words, Ferrari vibe)",
  "items": [
    {
      "note": "name in Thai",
      "amountBaht": number,
      "type": "expense" or "income",
      "categoryId": one of ["cat_food", "cat_transport", "cat_shopping", "cat_bills", "cat_entertainment", "cat_health", "cat_salary", "cat_side_income", "cat_other"]
    }
  ]
}
Return ONLY valid JSON.`;

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: geminiPrompt }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
              }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const textJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textJson) {
              const parsed = JSON.parse(textJson);
              aiReply = parsed.reply || '';
              if (Array.isArray(parsed.items)) {
                parsedItems = parsed.items.map((it: any) => ({
                  note: it.note || 'รายการทั่วไป',
                  amountSatang: Math.round(Math.abs(Number(it.amountBaht) || 0) * 100),
                  type: it.type === 'income' ? 'income' : 'expense',
                  categoryId: it.categoryId || 'cat_food',
                }));
              }
            }
          }
        } catch (e) {
          console.warn('Gemini API call failed, using local NLP:', e);
        }
      }

      // Fallback to local NLP
      if (parsedItems.length === 0) {
        const local = parseThaiExpenseInput(trimmedMsg);
        parsedItems = local.map((p) => ({
          note: p.note,
          amountSatang: p.amountSatang,
          type: p.type,
          categoryId: p.categoryGuessId || 'cat_food',
        }));
        if (!aiReply) {
          aiReply = 'จดเข้าบัญชีเรียบร้อยครับบอส! คุมเงินแน่นๆ Ferrari อยู่ไม่ไกล 🏎️';
        }
      }

      if (parsedItems.length > 0) {
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
        const itemsSummary = created
          .map(
            (c) =>
              `• ${c.note}: ${c.type === 'income' ? '+' : '-'}฿${(c.amountSatang / 100).toLocaleString('th-TH')}`
          )
          .join('\n');

        return NextResponse.json({
          reply: `${aiReply}\n\n${itemsSummary}`,
          recorded: true,
          created,
        });
      }
    }

    // Case 2: Financial Query / Question Intent
    // Build context summary string
    const topCatStr = topCategories
      .slice(0, 4)
      .map((c) => `- ${c.categoryName}: ฿${(c.totalSatang / 100).toLocaleString('th-TH')} (${c.percentage}%)`)
      .join('\n');

    const recentTxStr = monthSummary.recentTransactions
      .slice(0, 6)
      .map((t) => `- ${t.note}: ${t.type === 'income' ? '+' : '-'}฿${(t.amountSatang / 100).toLocaleString('th-TH')} (${t.categoryName})`)
      .join('\n');

    if (apiKey) {
      try {
        const chatPrompt = `You are "Scuderia AI", an executive personal financial coach and CFO for the user who loves Ferrari and financial freedom.
User's Question: "${trimmedMsg}"

Current Live Financial Data for the user (Month: ${monthSummary.period}):
- Total Income: ฿${totalIncomeBaht.toLocaleString('th-TH')}
- Total Expense: ฿${totalExpenseBaht.toLocaleString('th-TH')}
- Net Balance: ฿${netBalanceBaht.toLocaleString('th-TH')}
- Today's Spending: ฿${todayExpenseBaht.toLocaleString('th-TH')}

Top Expense Categories this month:
${topCatStr || '(ยังไม่มีรายจ่าย)'}

Recent Transactions:
${recentTxStr || '(ยังไม่มีรายการ)'}

Instructions:
1. Answer the user's question directly, accurately, and politely in Thai.
2. Use bullet points or numbers for clarity.
3. If they ask "เงินหายไปไหนหมด" (Where did my money go?): Breakdown the highest expense categories with percentages and call out the biggest expenses.
4. If they ask "เดือนนี้ใช้จ่ายอะไรมากที่สุด" (What did I spend the most on?): Name the top category and highest single items.
5. If they ask "สรุปค่าใช้จ่ายเดือนนี้": Give an executive overview (income, expense, net balance, top category).
6. Keep the tone sharp, energetic, encouraging, and motivational (Scuderia Ferrari theme, drive towards freedom). Under 100 words.`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: chatPrompt }] }],
              generationConfig: { temperature: 0.3 },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) {
            return NextResponse.json({
              reply: aiText.trim(),
              recorded: false,
            });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini chat failed, using local analytical engine:', geminiErr);
      }
    }

    // High-quality Local Analytical Engine (Offline / No Key Fallback)
    let localReply = '';
    const topCat = topCategories[0];

    if (trimmedMsg.includes('เงินหายไปไหน') || trimmedMsg.includes('หายไปไหน')) {
      if (totalExpenseBaht === 0) {
        localReply = 'เดือนนี้ยังไม่มีการบันทึกรายจ่ายเลยครับบอส เงินยังอยู่ครบเต็มถัง! 🏎️💨';
      } else {
        localReply = `บอสครับ จากข้อมูลเดือนนี้ เงินถูกนำไปใช้ทั้งหมด ฿${totalExpenseBaht.toLocaleString('th-TH')} โดยไหลไปที่:\n\n` +
          topCategories.slice(0, 3).map((c, i) => `${i + 1}. **${c.categoryName}**: ฿${(c.totalSatang / 100).toLocaleString('th-TH')} (${c.percentage}%)`).join('\n') +
          `\n\n💡 หมวดที่ดึงเงินออกไปหนักสุดคือ **${topCat ? topCat.categoryName : '-'}** ครับ ยอดเงินสุทธิตอนนี้เหลือ ฿${netBalanceBaht.toLocaleString('th-TH')}!`;
      }
    } else if (trimmedMsg.includes('มากที่สุด') || trimmedMsg.includes('มากสุด')) {
      if (!topCat || totalExpenseBaht === 0) {
        localReply = 'เดือนนี้ยังไม่มีรายจ่ายบันทึกเข้ามาเลยครับ';
      } else {
        localReply = `🏆 หมวดที่ใช้จ่าย **มากที่สุดในเดือนนี้** คือ:\n\n• **${topCat.categoryName}** รวมทั้งหมด **฿${(topCat.totalSatang / 100).toLocaleString('th-TH')}** (คิดเป็น ${topCat.percentage}% ของรายจ่ายทั้งหมด)\n\nถ้าคุมจุดนี้อยู่ แรงม้าทางการเงินจะพุ่งขึ้นทันทีครับ! 🏎️`;
      }
    } else if (trimmedMsg.includes('วันนี้') && (trimmedMsg.includes('ใช้') || trimmedMsg.includes('เท่าไหร่'))) {
      localReply = `📅 **ค่าใช้จ่ายวันนี้**: รวมทั้งหมด **฿${todayExpenseBaht.toLocaleString('th-TH')}** ครับ\n(ยอดคงเหลือสุทธิปัจจุบัน: ฿${netBalanceBaht.toLocaleString('th-TH')})`;
    } else {
      // Default: Comprehensive Executive Summary
      localReply = `📊 **สรุปสถานะการเงินเดือนนี้ (${monthSummary.period})**:\n\n` +
        `• 🟢 รายรับรวม: ฿${totalIncomeBaht.toLocaleString('th-TH')}\n` +
        `• 🔴 รายจ่ายรวม: ฿${totalExpenseBaht.toLocaleString('th-TH')}\n` +
        `• 💰 ยอดเงินคงเหลือสุทธิ: **฿${netBalanceBaht.toLocaleString('th-TH')}**\n` +
        (topCat ? `• 📌 หมวดที่จ่ายหนักสุด: ${topCat.categoryName} (฿${(topCat.totalSatang / 100).toLocaleString('th-TH')})\n\n` : '\n') +
        `วินัยเป๊ะทุกวันแบบนี้ มีเงินเก็บสตาร์ท Ferrari แน่นอนครับ! 🏎️✨`;
    }

    return NextResponse.json({
      reply: localReply,
      recorded: false,
    });
  } catch (error: any) {
    console.error('Chatbot API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
