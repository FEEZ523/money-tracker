import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const schema = {
    openapi: '3.1.0',
    info: {
      title: 'Money Tracker AI Connector (ChatGPT & Gemini)',
      description: 'API สำหรับให้ ChatGPT และ Gemini บันทึกรายรับรายจ่าย และสรุปข้อมูลทางการเงินของผู้ใช้',
      version: '1.0.0',
    },
    servers: [
      {
        url: baseUrl,
        description: 'Active Server URL',
      },
    ],
    paths: {
      '/api/v1/record': {
        post: {
          operationId: 'recordTransaction',
          summary: 'บันทึกรายรับหรือรายจ่ายจากข้อความภาษาธรรมชาติ',
          description: 'รับข้อความภาษาไทย เช่น "ข้าวมันไก่ 60 กาแฟ 55" หรือ "เงินเดือนเข้า 28,000" แล้วระบบจะแปลงเป็นสตางค์และเดาหมวดหมู่ให้ทันที',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    text: {
                      type: 'string',
                      description: 'ข้อความที่ผู้ใช้บอก เช่น "ข้าวมันไก่ 60 กาแฟ 55"',
                    },
                    source: {
                      type: 'string',
                      enum: ['chatgpt', 'gemini', 'antigravity', 'web'],
                      default: 'chatgpt',
                      description: 'แหล่งที่มาของคำสั่ง เช่น chatgpt หรือ gemini',
                    },
                  },
                  required: ['text'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'บันทึกรายการสำเร็จ',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      created: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/summary': {
        get: {
          operationId: 'getFinancialSummary',
          summary: 'ดึงรายงานสรุปรายรับรายจ่าย และหมวดหมู่ที่ใช้เงินเยอะสุด',
          parameters: [
            {
              name: 'period',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['today', 'month', 'all'],
                default: 'month',
              },
              description: 'ช่วงเวลาที่ต้องการดู: today (วันนี้), month (เดือนนี้), all (ทั้งหมด)',
            },
          ],
          responses: {
            '200': {
              description: 'ข้อมูลสรุปการเงิน',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      period: { type: 'string' },
                      totalIncomeBaht: { type: 'number' },
                      totalExpenseBaht: { type: 'number' },
                      netBalanceBaht: { type: 'number' },
                      categoryBreakdown: { type: 'array', items: { type: 'object' } },
                      recentTransactions: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(schema, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
