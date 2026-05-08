
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Admin check
        const cookieStore = await cookies();
    const sid = cookieStore.get('cg.sid.v2')?.value;
        if (!sid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const session = await prisma.session.findUnique({
            where: { id: sid },
            include: { User: true }
        });

        if (!session?.User || session.User.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const key = searchParams.get('key');

        if (!key) {
            return NextResponse.json({ ok: false, error: 'Key is required' }, { status: 400 });
        }

        const config = await prisma.systemConfig.findUnique({
            where: { configKey: key }
        });

        return NextResponse.json({ ok: true, config });
    } catch (error) {
        console.error('[SystemConfig API] GET Error:', error);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        // Admin check
        const cookieStore = await cookies();
    const sid = cookieStore.get('cg.sid.v2')?.value;
        if (!sid) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const session = await prisma.session.findUnique({
            where: { id: sid },
            include: { User: true }
        });

        if (!session?.User || session.User.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { key, value, description } = body;

        if (!key) {
            return NextResponse.json({ ok: false, error: 'Key is required' }, { status: 400 });
        }

        const config = await prisma.systemConfig.upsert({
            where: { configKey: key },
            update: {
                configValue: value,
                description: description,
                updatedAt: new Date(),
            },
            create: {
                configKey: key,
                configValue: value,
                description: description,
                category: body.category || 'general',
                updatedAt: new Date(),
            }
        });

        return NextResponse.json({ ok: true, config });
    } catch (error) {
        console.error('[SystemConfig API] POST Error:', error);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
