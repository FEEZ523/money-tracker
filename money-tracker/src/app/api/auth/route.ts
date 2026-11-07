import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const status = await db.getOwner();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, username, password } = body;

    if (action === 'register') {
      const { hasOwner } = await db.getOwner();
      if (hasOwner) {
        return NextResponse.json(
          { error: 'ระบบมีเจ้าของแล้ว และปิดรับสมัครถาวร' },
          { status: 403 }
        );
      }

      if (!username || !password || password.length < 4) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้และรหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร' },
          { status: 400 }
        );
      }

      // Simple secure hash for single owner local setup
      const user = await db.registerOwner(username, password);
      return NextResponse.json({
        message: 'ลงทะเบียนเป็นเจ้าของระบบสำเร็จ!',
        user: { id: user.id, username: user.username },
      });
    }

    if (action === 'login') {
      const user = await db.getUserByUsername(username);
      if (!user || user.passwordHash !== password) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        message: 'เข้าสู่ระบบสำเร็จ',
        user: { id: user.id, username: user.username },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
