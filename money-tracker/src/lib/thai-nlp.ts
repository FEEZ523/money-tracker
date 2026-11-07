import { ParsedItem, TransactionType } from './types';

// Thai timezone utility (Asia/Bangkok = UTC+7)
export function getThaiDate(offsetDays: number = 0): string {
  const now = new Date();
  if (offsetDays !== 0) {
    now.setDate(now.getDate() + offsetDays);
  }
  // Format as YYYY-MM-DD in Asia/Bangkok
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

// Category keywords for guessing
const CATEGORY_RULES: { id: string; type: TransactionType; keywords: string[] }[] = [
  {
    id: 'cat_salary',
    type: 'income',
    keywords: ['รายรับ', 'เงินเดือน', 'โบนัส', 'รายได้', 'เงินเข้า', 'รับเงิน', 'ค่าจ้าง', 'ปันผล', 'กำไร', 'ขายของได้', 'ได้เงิน'],
  },
  {
    id: 'cat_food',
    type: 'expense',
    keywords: [
      'ข้าว', 'ข้าวมันไก่', 'กะเพรา', 'หมูกรอบ', 'ไข่ดาว', 'ก๋วยเตี๋ยว', 'กาแฟ', 'ชา', 'ชาเขียว',
      'ชาบู', 'หมูกระทะ', 'อาหาร', 'ขนม', 'ส้มตำ', 'น้ำเปล่า', 'บุฟเฟต์', 'พิซซ่า', 'เบอร์เกอร์',
      'ไอติม', 'ของหวาน', 'เซเว่น', '7-11', 'เค้ก', 'โรตี', 'ลูกชิ้น', 'ข้าวเที่ยง', 'ข้าวเย็น', 'ข้าวเช้า'
    ],
  },
  {
    id: 'cat_transport',
    type: 'expense',
    keywords: [
      'แท็กซี่', 'taxi', 'รถเมล์', 'วิน', 'มอเตอร์ไซค์', 'bts', 'mrt', 'บีทีเอส', 'เอ็มอาร์ที',
      'น้ำมัน', 'เติมน้ำมัน', 'ค่ารถ', 'ค่าตั๋ว', 'grab', 'bolt', 'ทางด่วน', 'ที่จอดรถ'
    ],
  },
  {
    id: 'cat_shopping',
    type: 'expense',
    keywords: ['เสื้อผ้า', 'สั่งของ', 'shopee', 'lazada', 'tiktok shop', 'รองเท้า', 'ของใช้', 'กระเป๋า', 'กางเกง'],
  },
  {
    id: 'cat_bills',
    type: 'expense',
    keywords: ['ค่าไฟ', 'ค่าน้ำ', 'ค่าเน็ต', 'ค่าโทรศัพท์', 'ค่าห้อง', 'ค่าหอ', 'ผ่อนบ้าน', 'ผ่อนรถ', 'ค่าเช่า'],
  },
  {
    id: 'cat_entertainment',
    type: 'expense',
    keywords: ['ดูหนัง', 'เกม', 'เติมเกม', 'steam', 'netflix', 'youtube', 'เที่ยว', 'สังสรรค์', 'เบียร์', 'เหล้า'],
  },
  {
    id: 'cat_health',
    type: 'expense',
    keywords: ['ยา', 'ค่ายา', 'หาหมอ', 'คลินิก', 'โรงพยาบาล', 'ฟัน', 'ทำฟัน', 'วิตามิน', 'แว่นตา'],
  },
];

export function guessCategory(text: string): { categoryId: string; type: TransactionType } {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return { categoryId: rule.id, type: rule.type };
      }
    }
  }
  return { categoryId: 'cat_other', type: 'expense' };
}

/**
 * Smart Thai parser for multiple expense entries in a single string:
 * Examples:
 * - "ข้าวมันไก่ 60 กาแฟ 55" -> 2 items
 * - "เมื่อวานค่าแท็กซี่ 120" -> 1 item, date is yesterday
 * - "เงินเดือนเข้า 28,000" -> 1 income item
 */
export function parseThaiExpenseInput(input: string): ParsedItem[] {
  let cleaned = input.trim();
  if (!cleaned) return [];

  // Determine date offset
  let targetDate = getThaiDate(0);
  if (cleaned.includes('เมื่อวาน') || cleaned.includes('วานนี้')) {
    targetDate = getThaiDate(-1);
    cleaned = cleaned.replace(/เมื่อวาน(นี้)?|วานนี้/g, ' ').trim();
  } else if (cleaned.includes('วันนี้')) {
    targetDate = getThaiDate(0);
    cleaned = cleaned.replace(/วันนี้/g, ' ').trim();
  }

  // Check for correction syntax: e.g. "เมื่อกี้ใส่ผิด ข้าวมันไก่เป็น 65"
  if (cleaned.includes('เมื่อกี้ใส่ผิด') || cleaned.includes('แก้เป็น') || cleaned.includes('เปลี่ยนเป็น')) {
    // Return special flag for correction
    const numMatch = cleaned.match(/(\d[\d,]*(\.\d+)?)/);
    if (numMatch) {
      const amountVal = parseFloat(numMatch[1].replace(/,/g, ''));
      const notePart = cleaned
        .replace(/เมื่อกี้ใส่ผิด|แก้เป็น|เปลี่ยนเป็น|เป็น/g, ' ')
        .replace(numMatch[1], ' ')
        .trim();
      return [{
        note: notePart || 'แก้ไขรายการ',
        amountSatang: Math.round(amountVal * 100),
        type: 'expense',
        categoryGuessId: 'cat_food',
        dateStr: targetDate,
      }];
    }
  }

  // Tokenize pattern: [Word/Phrase] followed by [Number]
  // Regex looks for words ending with a number (with optional commas/decimals)
  // e.g. "ข้าวมันไก่ 60 กาแฟ 55"
  const items: ParsedItem[] = [];
  const regex = /([^\d\n]+?)\s*[:=]?\s*(\d[\d,]*(\.\d+)?)\s*(บาท|บ\.|thb)?/gi;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    const rawNote = match[1].trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
    const rawNumberStr = match[2].replace(/,/g, '');
    const amountNumber = parseFloat(rawNumberStr);

    if (rawNote && !isNaN(amountNumber) && amountNumber > 0) {
      const { categoryId, type } = guessCategory(rawNote);
      items.push({
        note: rawNote,
        amountSatang: Math.round(amountNumber * 100),
        type,
        categoryGuessId: categoryId,
        dateStr: targetDate,
      });
    }
  }

  // Fallback: If no regex match (e.g. user just typed "120 ค่าแท็กซี่" or "ข้าว 50")
  if (items.length === 0) {
    const reverseRegex = /(\d[\d,]*(\.\d+)?)\s*(บาท|บ\.|thb)?\s*([^\d\n]+)/gi;
    while ((match = reverseRegex.exec(cleaned)) !== null) {
      const rawNumberStr = match[1].replace(/,/g, '');
      const rawNote = match[4].trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
      const amountNumber = parseFloat(rawNumberStr);
      if (rawNote && !isNaN(amountNumber) && amountNumber > 0) {
        const { categoryId, type } = guessCategory(rawNote);
        items.push({
          note: rawNote,
          amountSatang: Math.round(amountNumber * 100),
          type,
          categoryGuessId: categoryId,
          dateStr: targetDate,
        });
      }
    }
  }

  return items;
}
