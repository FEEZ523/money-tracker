import { NextRequest, NextResponse } from 'next/server';
import { moneyService } from '@/lib/service';

// Expected MCP Bearer token (can be configured in .env or defaults to a safe token)
const MCP_TOKEN = process.env.MCP_AUTH_TOKEN || 'antigravity_secret_mcp_token_2026';

function verifyAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === MCP_TOKEN;
  }
  if (queryToken) {
    return queryToken === MCP_TOKEN;
  }
  return false;
}

// MCP Tools Definition
const MCP_TOOLS = [
  {
    name: 'record_expense',
    description: 'บันทึกรายรับหรือรายจ่ายจากข้อความภาษาธรรมชาติภาษาไทย เช่น "ข้าวมันไก่ 60 กาแฟ 55" หรือ "เงินเดือนเข้า 28,000" หรือ "เมื่อวานค่าแท็กซี่ 120"',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'ข้อความภาษาธรรมชาติที่ผู้ใช้บอก เช่น "ข้าวมันไก่ 60 กาแฟ 55"',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_summary',
    description: 'ขอสรุปยอดเงินรายรับรายจ่าย ยอดแยกตามหมวดหมู่ และเปรียบเทียบกับช่วงเวลาก่อนหน้า',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'month', 'all'],
          description: 'ช่วงเวลาที่ต้องการสรุป: today (วันนี้), month (เดือนนี้), all (ทั้งหมด)',
        },
      },
    },
  },
  {
    name: 'update_expense',
    description: 'แก้ไขรายการที่มีอยู่ เช่น แก้จำนวนเงิน หรือชื่อรายการ เช่น "ข้าวมันไก่เป็น 65"',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'ข้อความบอกการแก้ไข เช่น "เมื่อกี้ใส่ผิด ข้าวมันไก่เป็น 65"',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'delete_expense',
    description: 'ลบรายการบันทึกรายรับรายจ่ายด้วย ID',
    inputSchema: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description: 'รหัสรายการที่ต้องการลบ',
        },
      },
      required: ['transactionId'],
    },
  },
  {
    name: 'list_categories',
    description: 'ดึงรายชื่อหมวดหมู่ค่าใช้จ่ายและรายรับทั้งหมด',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function GET(req: NextRequest) {
  // If not authenticated, return 401 as per specification
  if (!verifyAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid MCP authentication token is required' },
      { status: 401 }
    );
  }

  // Return server info and tools
  return NextResponse.json({
    name: 'antigravity-money-tracker-mcp',
    version: '1.0.0',
    capabilities: {
      tools: true,
    },
    tools: MCP_TOOLS,
  });
}

export async function POST(req: NextRequest) {
  // Check authentication
  if (!verifyAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid MCP authentication token is required' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    // Standard MCP / JSON-RPC handling
    const method = body.method || body.action;
    const params = body.params || body;
    const id = body.id || '1';

    // 1. Initialize
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'antigravity-money-tracker',
            version: '1.0.0',
          },
        },
      });
    }

    // 2. tools/list
    if (method === 'tools/list' || method === 'list_tools') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      });
    }

    // 3. tools/call
    if (method === 'tools/call' || method === 'call_tool') {
      const toolName = params.name || body.name;
      const args = params.arguments || body.arguments || {};

      if (toolName === 'record_expense' || toolName === 'record_transaction') {
        const result = await moneyService.recordFromNaturalLanguage(args.text, 'antigravity');
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `${result.message}\n(ลงบันทึกในฐานข้อมูลระบบเรียบร้อย มีป้าย "จาก Antigravity")`,
              },
            ],
            data: result.created,
          },
        });
      }

      if (toolName === 'update_expense') {
        const result = await moneyService.recordFromNaturalLanguage(args.text, 'antigravity');
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: result.message }],
            data: result.created,
          },
        });
      }

      if (toolName === 'get_summary') {
        const summary = await moneyService.getSummary(args.period || 'month');
        const breakdownLines = summary.categoryBreakdown
          .map((c) => `  - ${c.categoryName}: ${(c.totalSatang / 100).toLocaleString('th-TH')} บาท (${c.percentage}%)`)
          .join('\n');

        const summaryText = [
          `📊 สรุปยอดเงิน (${summary.period}):`,
          `• รายรับทั้งหมด: ${(summary.totalIncomeSatang / 100).toLocaleString('th-TH')} บาท`,
          `• รายจ่ายทั้งหมด: ${(summary.totalExpenseSatang / 100).toLocaleString('th-TH')} บาท`,
          `• คงเหลือสุทธิ: ${(summary.netBalanceSatang / 100).toLocaleString('th-TH')} บาท`,
          summary.previousPeriodExpenseSatang > 0
            ? `• เทียบกับเดือนก่อน: ${summary.expenseChangePercentage >= 0 ? '+' : ''}${summary.expenseChangePercentage}%`
            : '',
          `\nแยกตามหมวดหมู่:\n${breakdownLines || '  (ไม่มีรายการ)'}`,
        ]
          .filter(Boolean)
          .join('\n');

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: summaryText }],
            data: summary,
          },
        });
      }

      if (toolName === 'delete_expense') {
        const success = await moneyService.deleteTransaction(args.transactionId, true);
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: success ? 'ลบรายการเรียบร้อยแล้ว (กู้คืนได้)' : 'ไม่พบรายการที่ต้องการลบ',
              },
            ],
          },
        });
      }

      if (toolName === 'list_categories') {
        const categories = await moneyService.listCategories();
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `หมวดหมู่ทั้งหมด:\n${categories.map((c) => `• ${c.name} (${c.type})`).join('\n')}`,
              },
            ],
            data: categories,
          },
        });
      }

      return NextResponse.json(
        { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool "${toolName}" not found` } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: err.message || 'Internal server error' },
      },
      { status: 500 }
    );
  }
}
