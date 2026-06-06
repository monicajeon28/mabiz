// Phase3 통합테스트 — 실제 Prisma 클라이언트로 임시 fixture 생성→전 흐름 실행→검증→삭제.
// "컴파일만 되는 게 아니라 실제 DB에 저장/조회/중복차단이 되는가"를 증명한다.
// DB는 현재 비어있으므로 안전. 끝나면 만든 데이터 전부 정리(finally).
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function loadEnv(f) { try { for (const l of readFileSync(f,'utf8').split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if(!m)continue; let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); if(!process.env[m[1]])process.env[m[1]]=v; } } catch {} }
loadEnv('.env.local'); loadEnv('.env');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TAG = 'ITEST_' + Date.now();
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n); } };
const isDup = (e) => { const s = String(e?.code ?? '') + String(e?.message ?? ''); return s.includes('P2002') || s.includes('23505') || s.toLowerCase().includes('unique'); };

let trip, user, reservation, submission;
try {
  // ── fixture ── (user → trip(userId) → reservation → submission)
  user = await prisma.gmUser.create({ data: { name: '통합테스트고객', phone: '010' + String(Date.now()).slice(-8), password: 'x', role: 'user' } });
  trip = await prisma.gmTrip.create({ data: { productCode: TAG, shipName: '통합테스트선박', departureDate: new Date(), status: 'Upcoming', updatedAt: new Date(), userId: user.id } });
  reservation = await prisma.gmReservation.create({ data: { tripId: trip.id, mainUserId: user.id, totalPeople: 2, passportStatus: 'PENDING' } });
  const token = TAG + '_tok_abcdefghij';
  submission = await prisma.gmPassportSubmission.create({ data: { userId: user.id, tripId: trip.id, token, tokenExpiresAt: new Date(Date.now() + 86400000) } });
  console.log(`[fixture] trip#${trip.id} user#${user.id} reservation#${reservation.id} submission#${submission.id}`);

  console.log('\n[1] scan GET — reservation 조회 (고객 본인확인 진입)');
  const resv = await prisma.gmReservation.findFirst({
    where: { mainUserId: submission.userId, ...(submission.tripId != null ? { tripId: submission.tripId } : {}) },
    orderBy: { id: 'desc' }, include: { trip: true },
  });
  ok('scan이 reservation을 찾음(고객이 Step0 통과 가능)', !!resv && resv.id === reservation.id);
  ok('reservation.totalPeople 존재(프리필 가능)', resv?.totalPeople === 2);
  ok('reservation.trip 연결됨', !!resv?.trip && resv.trip.id === trip.id);

  console.log('\n[2] submit — SEC-2 토큰 본인확인');
  const sub = await prisma.gmPassportSubmission.findFirst({ where: { token }, select: { id: true, userId: true, tripId: true, tokenExpiresAt: true } });
  const secPass = !!sub && sub.tokenExpiresAt.getTime() >= Date.now() && sub.userId === reservation.mainUserId && (sub.tripId == null || sub.tripId === reservation.tripId);
  ok('정상 고객 토큰검증 통과(거짓403 아님)', secPass);

  console.log('\n[3] submit — 여권정보 실제 저장(신규)');
  const created = await prisma.gmTraveler.create({ data: { reservationId: reservation.id, korName: '홍길동', engSurname: 'HONG', engGivenName: 'GILDONG', passportNo: 'M12345678', birthDate: '1990-01-15', expiryDate: '2030-01-15', roomNumber: 1, updatedBy: user.id } });
  const got = await prisma.gmTraveler.findFirst({ where: { reservationId: reservation.id, passportNo: 'M12345678' } });
  ok('Traveler 실제 DB 저장됨', !!got && got.korName === '홍길동' && got.engSurname === 'HONG');
  ok('영문 성/이름 분리 보존', got?.engSurname === 'HONG' && got?.engGivenName === 'GILDONG');
  ok('날짜 yyyy-MM-dd String 저장', got?.birthDate === '1990-01-15' && got?.expiryDate === '2030-01-15');

  console.log('\n[4] 재제출 — 같은 여권번호는 기존행 매칭(중복생성 안 함)');
  const match = await prisma.gmTraveler.findFirst({ where: { reservationId: reservation.id, passportNo: 'M12345678' }, select: { id: true } });
  ok('2순위 매칭으로 기존행 발견(덮어쓰기 경로)', match?.id === created.id);

  console.log('\n[5] 부분 UNIQUE — 동시 중복 생성 DB 차단');
  let dupBlocked = false;
  try { await prisma.gmTraveler.create({ data: { reservationId: reservation.id, korName: '위조중복', passportNo: 'M12345678', roomNumber: 2 } }); }
  catch (e) { dupBlocked = isDup(e); }
  ok('같은 (예약,여권번호) 중복 INSERT가 차단됨', dupBlocked);

  console.log('\n[6] isSubmitted — 관리자 화면 노출 플래그');
  await prisma.gmPassportSubmission.update({ where: { id: submission.id }, data: { isSubmitted: true, submittedAt: new Date() } });
  const sub2 = await prisma.gmPassportSubmission.findUnique({ where: { id: submission.id }, select: { isSubmitted: true, submittedAt: true } });
  ok('제출 후 isSubmitted=true (submission-guests 노출)', sub2?.isSubmitted === true && !!sub2.submittedAt);

  console.log('\n[7] Guest 동기화 + 부분 UNIQUE');
  await prisma.gmPassportSubmissionGuest.create({ data: { submissionId: submission.id, groupNumber: 1, name: '홍길동', passportNumber: 'M12345678', source: 'public_submit', submittedBy: user.id, submittedAt: new Date() } });
  const g = await prisma.gmPassportSubmissionGuest.findFirst({ where: { submissionId: submission.id, passportNumber: 'M12345678' } });
  ok('Guest 행 저장됨(source=public_submit, 감사필드)', !!g && g.source === 'public_submit' && g.submittedBy === user.id);
  let gDup = false;
  try { await prisma.gmPassportSubmissionGuest.create({ data: { submissionId: submission.id, groupNumber: 2, name: '중복', passportNumber: 'M12345678' } }); }
  catch (e) { gDup = isDup(e); }
  ok('Guest 같은 (submission,여권번호) 중복 차단', gDup);

  console.log('\n[8] customer/upload 토큰인증 — Traveler.passportImage 저장 경로');
  await prisma.gmTraveler.update({ where: { id: created.id }, data: { passportImage: 'https://drive.example/test.webp' } });
  const ti = await prisma.gmTraveler.findUnique({ where: { id: created.id }, select: { passportImage: true } });
  ok('passportImage 저장됨(업로드 백업 연결)', ti?.passportImage === 'https://drive.example/test.webp');

  console.log(`\n[결과] PASS ${pass} / FAIL ${fail}`);
} catch (e) {
  console.error('테스트 중 예외:', e?.message ?? e);
  fail++;
} finally {
  // ── cleanup (FK 안전 순서) ──
  try {
    if (reservation) {
      await prisma.gmReservationAudit.deleteMany({ where: { reservationId: reservation.id } }).catch(() => {});
      await prisma.gmTraveler.deleteMany({ where: { reservationId: reservation.id } }).catch(() => {});
    }
    if (submission) {
      await prisma.gmPassportSubmissionGuest.deleteMany({ where: { submissionId: submission.id } }).catch(() => {});
      await prisma.gmPassportSubmission.delete({ where: { id: submission.id } }).catch(() => {});
    }
    if (reservation) await prisma.gmReservation.delete({ where: { id: reservation.id } }).catch(() => {});
    if (trip) await prisma.gmTrip.delete({ where: { id: trip.id } }).catch(() => {}); // trip.userId → user 이므로 user보다 먼저
    if (user) await prisma.gmUser.delete({ where: { id: user.id } }).catch(() => {});
    console.log('[cleanup] 임시 데이터 정리 완료');
  } catch (ce) { console.error('[cleanup] 일부 실패:', ce?.message ?? ce); }
  // 잔여 확인
  let left = -1;
  try { left = await prisma.gmTrip.count({ where: { productCode: TAG } }); } catch {}
  console.log('[cleanup] 잔여 fixture trip:', left);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}
