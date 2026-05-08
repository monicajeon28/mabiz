export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST: Save partner-specific B2B landing template
export async function POST(req: NextRequest) {
    try {
        const sessionUser = await getSessionUser();
        if (!sessionUser) {
            return NextResponse.json(
                { ok: false, message: 'Unauthorized' },
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: sessionUser.id },
            select: { role: true },
        });

        if (dbUser?.role !== 'admin') {
            return NextResponse.json(
                { ok: false, message: 'Admin access required' },
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const body = await req.json();
        const { profileId, template } = body;

        if (!profileId || !template) {
            return NextResponse.json(
                { ok: false, message: 'profileId and template are required' },
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Fetch existing profile
        const profile = await prisma.affiliateProfile.findUnique({
            where: { id: Number(profileId) },
            select: { id: true, metadata: true },
        });

        if (!profile) {
            return NextResponse.json(
                { ok: false, message: 'Profile not found' },
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Update metadata with template
        const existingMetadata = (profile.metadata as any) || {};
        const updatedMetadata = {
            ...existingMetadata,
            b2bLandingTemplate: template,
            b2bLandingTemplateUpdatedAt: new Date().toISOString(),
            b2bLandingTemplateUpdatedBy: sessionUser.id,
        };

        await prisma.affiliateProfile.update({
            where: { id: Number(profileId) },
            data: {
                metadata: updatedMetadata,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json(
            { ok: true, message: 'Template saved successfully' },
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('[Save Partner Template] error:', error);
        return NextResponse.json(
            { ok: false, message: error.message || 'Server error' },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// DELETE: Remove partner-specific template (revert to global)
export async function DELETE(req: NextRequest) {
    try {
        const sessionUser = await getSessionUser();
        if (!sessionUser) {
            return NextResponse.json(
                { ok: false, message: 'Unauthorized' },
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: sessionUser.id },
            select: { role: true },
        });

        if (dbUser?.role !== 'admin') {
            return NextResponse.json(
                { ok: false, message: 'Admin access required' },
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get('profileId');

        if (!profileId) {
            return NextResponse.json(
                { ok: false, message: 'profileId is required' },
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Fetch existing profile
        const profile = await prisma.affiliateProfile.findUnique({
            where: { id: Number(profileId) },
            select: { id: true, metadata: true },
        });

        if (!profile) {
            return NextResponse.json(
                { ok: false, message: 'Profile not found' },
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Remove template from metadata
        const existingMetadata = (profile.metadata as any) || {};
        const { b2bLandingTemplate, b2bLandingTemplateUpdatedAt, b2bLandingTemplateUpdatedBy, ...restMetadata } = existingMetadata;

        await prisma.affiliateProfile.update({
            where: { id: Number(profileId) },
            data: {
                metadata: restMetadata,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json(
            { ok: true, message: 'Template removed, will use global template' },
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('[Delete Partner Template] error:', error);
        return NextResponse.json(
            { ok: false, message: error.message || 'Server error' },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
