import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  // DB 스키마 노출 차단 — GLOBAL_ADMIN만 접근 가능
  const ctx = await getMabizSession();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // NODE_ENV 체크는 보조 수단
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const client = new Client({
    connectionString: process.env.SUPABASE_BACKUP_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {

    await client.connect();

    // 모든 테이블 조회
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const allTables = result.rows.map(r => r.tablename);

    // 뉴스/커뮤니티 관련 테이블 필터링
    const newsKeywords = ['news', 'News', 'NEWS', 'article', 'Article', 'blog', 'Blog'];
    const communityKeywords = ['community', 'Community', 'post', 'Post', 'comment', 'Comment', 'forum', 'Forum', 'board', 'Board'];

    const relatedTables = allTables.filter(table => {
      const lower = table.toLowerCase();
      return (
        newsKeywords.some(k => lower.includes(k.toLowerCase())) ||
        communityKeywords.some(k => lower.includes(k.toLowerCase()))
      );
    });

    // 각 테이블의 행 수와 컬럼 정보
    const tableDetails: Record<string, { rowCount: number; columns: string[] }> = {};

    for (const table of relatedTables) {
      const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
      const rowCount = parseInt(String(countResult.rows[0]?.count ?? 0), 10);

      const columnsResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      const columns = columnsResult.rows.map(r => r.column_name);

      tableDetails[table] = { rowCount, columns };
    }

    // 샘플 데이터 가져오기 (데이터가 있는 테이블만)
    const samples: Record<string, any[]> = {};
    for (const [table, info] of Object.entries(tableDetails)) {
      if (info.rowCount > 0) {
        try {
          const sampleResult = await client.query(`SELECT * FROM "${table}" LIMIT 3`);
          samples[table] = sampleResult.rows;
        } catch (e) {
          // Skip if error
        }
      }
    }

    return NextResponse.json({
      totalTables: allTables.length,
      relatedTables: Object.keys(tableDetails),
      tableDetails,
      samplesAvailable: Object.keys(samples),
    });

  } catch (error) {
    logger.error('Search error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}
