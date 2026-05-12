export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        // Verify Cron Secret (if configured)
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Calculate date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Find messages to delete (Soft delete or Hard delete? User said "auto delete", usually implies hard delete or soft delete. 
        // Given "server capacity" concern, hard delete might be preferred, but let's stick to soft delete first or check if we can hard delete.
        // The user said "server capacity", so hard delete is better for space.
        // However, referential integrity (UserMessageRead) must be handled.

        // 1. Find IDs of messages to delete
        // Target only specific message types to avoid deleting important system notifications if any?
        // User said "Team Messages", so we target those types.
        const messageTypes = [
            'team-dashboard',
            'agent-manager',
            'manager-agent',
            'manager-manager',
            'agent-admin',
            'manager-admin',
        ];

        const messagesToDelete = await prisma.adminMessage.findMany({
            where: {
                messageType: { in: messageTypes },
                createdAt: { lt: thirtyDaysAgo },
            },
            select: { id: true },
        });

        const ids = messagesToDelete.map(m => m.id);

        if (ids.length === 0) {
            return NextResponse.json({ ok: true, deletedCount: 0, message: 'No messages to delete.' });
        }

        // 2. Delete related UserMessageRead records first
        await prisma.userMessageRead.deleteMany({
            where: { messageId: { in: ids } },
        });

        // 3. Delete AdminMessage records
        const deleteResult = await prisma.adminMessage.deleteMany({
            where: { id: { in: ids } },
        });

        return NextResponse.json({
            ok: true,
            deletedCount: deleteResult.count,
            message: `Deleted ${deleteResult.count} messages older than 30 days.`,
        });

    } catch (error) {
        console.error('[Cleanup Messages] Error:', error);
        return NextResponse.json({ ok: false, error: 'Failed to cleanup messages' }, { status: 500 });
    }
}
