import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncApisInBackground } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { tripId, travelers } = body;

        // travelers: Array of { travelerId: number, roomNumber: number, phone?: string, name?: string }

        if (!tripId || !travelers || !Array.isArray(travelers)) {
            return NextResponse.json({ ok: false, message: 'Invalid request data' }, { status: 400 });
        }

        // Update each traveler's room number and handle User creation
        for (const item of travelers) {
            if (item.travelerId && item.roomNumber !== undefined) {
                const updateData: any = { roomNumber: parseInt(item.roomNumber) };

                // If phone number is provided, try to link or create User
                if (item.phone) {
                    // Check if user exists
                    let user = await prisma.user.findFirst({
                        where: { phone: item.phone }
                    });

                    if (!user) {
                        // Create new user
                        const password = item.phone.slice(-4); // Password is last 4 digits of phone
                        user = await prisma.user.create({
                            data: {
                                name: item.name || 'Unknown',
                                phone: item.phone,
                                password: password, // In production, this should be hashed
                                role: 'user',
                                onboarded: false,
                            }
                        });
                    }

                    // Link User to Traveler
                    updateData.userId = user.id;
                }

                await prisma.traveler.update({
                    where: { id: item.travelerId },
                    data: updateData,
                });
            }
        }

        // APIS 스프레드시트 즉시 동기화 (재시도 로직 포함, 비동기)
        syncApisInBackground(tripId);

        return NextResponse.json({ ok: true, message: 'PNR/Rooming list updated successfully' });
    } catch (error: any) {
        console.error('[PNR Submit] Error:', error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
