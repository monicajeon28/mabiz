/**
 * 어필리에이트 판매원 계약서 PDF 생성
 * GmarketSans 폰트 사용 (한글 깨짐 방지)
 */
import path from 'path';
import {
  Document, Page, Text, View, StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer';
import React from 'react';

// ─── 폰트 등록 ──────────────────────────────────────────────────────────────

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

Font.register({
  family: 'GmarketSans',
  fonts: [
    { src: path.join(FONT_DIR, 'GmarketSansTTFLight.ttf'),  fontWeight: 300 },
    { src: path.join(FONT_DIR, 'GmarketSansTTFMedium.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'GmarketSansTTFBold.ttf'),   fontWeight: 700 },
  ],
});

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:       { fontFamily: 'GmarketSans', fontSize: 9, color: '#1a1a1a', padding: 48, lineHeight: 1.6 },
  header:     { textAlign: 'center', marginBottom: 24 },
  title:      { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  subtitle:   { fontSize: 10, fontWeight: 400, color: '#555' },
  divider:    { borderBottom: 1, borderColor: '#ddd', marginVertical: 14 },
  section:    { marginBottom: 12 },
  secTitle:   { fontSize: 10, fontWeight: 700, marginBottom: 4, color: '#111' },
  body:       { fontWeight: 400, color: '#333', lineHeight: 1.7 },
  infoBox:    { backgroundColor: '#f5f7fa', borderRadius: 4, padding: 12, marginBottom: 18 },
  infoRow:    { flexDirection: 'row', marginBottom: 4 },
  infoLabel:  { width: 80, fontWeight: 700, fontSize: 9 },
  infoValue:  { flex: 1, fontSize: 9 },
  sigBox:     { border: 1, borderColor: '#333', borderRadius: 4, padding: 14, marginTop: 20, backgroundColor: '#fffdf5' },
  sigTitle:   { fontSize: 10, fontWeight: 700, marginBottom: 8, color: '#333' },
  sigName:    { fontSize: 20, fontWeight: 700, color: '#1a3a6e', marginBottom: 4 },
  sigCaption: { fontSize: 8, color: '#777' },
  footer:     { position: 'absolute', bottom: 32, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#aaa' },
  warningBox: { backgroundColor: '#fff8e1', border: 1, borderColor: '#f0c000', borderRadius: 4, padding: 10, marginBottom: 14 },
  warningText:{ fontSize: 8.5, fontWeight: 700, color: '#7a5c00' },
});

// ─── 계약서 조항 ─────────────────────────────────────────────────────────────

const CONTRACT_SECTIONS = [
  {
    title: '제1조 (계약의 성격 및 당사자)',
    content: '본 계약은 크루즈닷(이하 "회사")과 어필리에이트 판매원(이하 "판매원") 간의 독립 용역 계약으로, 판매원은 독립 프리랜서(개인사업자)로 활동합니다. 고용관계가 아니며, 4대 보험은 적용되지 않습니다.',
  },
  {
    title: '제2조 (수당 지급 조건)',
    content: '수당은 고객의 여행 출발 완료 확인 후 지급됩니다.\n프리랜서 계약으로 수당 지급 시 3.3% 원천징수가 적용됩니다.\n마지막 정산 수당의 30%는 마지막 지급일로부터 60일 후, 환불·민원 확정 이후 지급됩니다.\n판매원 본인·배우자·직계가족 명의 구매에 대한 수당은 지급하지 않습니다.',
  },
  {
    title: '제3조 (환불·Clawback 정책)',
    content: '수당 지급 후 6개월 내 해당 고객 환불 발생 시 수당 전액을 환수합니다. 미지급 수당이 없어 상계가 불가한 경우, 청구일로부터 14일 이내 반환해야 합니다.',
  },
  {
    title: '제4조 (비밀유지 의무)',
    content: '판매원은 업무를 통해 알게 된 고객 DB, 수수료율, 내부 운영 정보 등 회사의 영업비밀을 계약 종료 후 3년간 제3자에게 누설하거나 경쟁 목적으로 사용할 수 없습니다.',
  },
  {
    title: '제5조 (경업금지)',
    content: '판매원은 계약 기간 중 및 종료 후 1년간, 회사와 동종 업종(크루즈·해외여행 판매)에서 경쟁 활동을 할 수 없습니다.',
  },
  {
    title: '제6조 (콘텐츠 무단 사용 금지)',
    content: '회사가 제공한 랜딩페이지, 홍보 자료, 교육 콘텐츠를 무단 복제하거나 타 플랫폼에 사용하는 행위를 금합니다.',
  },
  {
    title: '제7조 (직거래·플랫폼 우회 금지)',
    content: '고객을 회사 시스템 외부로 유도하거나 직거래하는 행위, 플랫폼을 우회하는 행위를 엄격히 금지합니다.',
  },
  {
    title: '제8조 (SNS·공개 발언 제한)',
    content: '회사를 비방하거나 허위 사실을 유포하는 행위를 금합니다. (SNS, 온라인 커뮤니티, 언론 포함. 일시 게시 후 삭제도 위반으로 간주) 불만이 있는 경우 내부 채널을 통해 해결합니다.',
  },
  {
    title: '제9조 (위약벌 — 최대 3,000만원)',
    content: '비밀유지 위반 — 경미: 200만원 / DB·수수료율 유출: 1,000만원 / 경쟁사 제공 목적: 2,000만원\n경업금지 위반: 1,000만원\n콘텐츠 무단복제: 3,000만원\n직거래·플랫폼 우회: 위반 거래 금액의 20% + 500만원\n시스템 침해: 3,000만원 + 형사고발\n조직 이탈 유도: 1,000만원 + 이탈 1인당 300만원 가중\n실손해액이 위약벌을 초과하는 경우 초과분을 추가 청구할 수 있습니다.',
  },
  {
    title: '제10조 (개인정보 보호)',
    content: '업무 수행 중 취득한 고객 개인정보(이름, 연락처 등)를 허가된 업무 외 목적으로 사용·저장·공유·판매하는 행위를 금하며, 위반 시 개인정보보호법에 따른 민·형사상 책임을 집니다.',
  },
  {
    title: '제11조 (디지털 서명의 법적 효력)',
    content: '본 계약서에 성명을 직접 입력하는 행위는 「전자서명법」에 따른 디지털 서명으로 법적 효력을 가집니다. 판매원은 본 계약서의 모든 조항을 읽고 이해한 후 서명합니다.',
  },
];

// ─── PDF 컴포넌트 ────────────────────────────────────────────────────────────

interface ContractPdfProps {
  memberName:   string;
  memberPhone:  string;
  memberEmail:  string;
  role:         string;
  signature:    string;
  signedAt:     string; // 한국어 날짜 문자열
  orgName:      string;
}

function ContractPdf({ memberName, memberPhone, memberEmail, role, signature, signedAt, orgName }: ContractPdfProps) {
  const roleLabel = role === 'OWNER' ? '대리점장' : role === 'FREE_SALES' ? '자유판매원' : '소속판매원';

  return (
    <Document title="어필리에이트 판매원 계약서" author="크루즈닷">
      <Page size="A4" style={S.page}>
        {/* 헤더 */}
        <View style={S.header}>
          <Text style={S.title}>어필리에이트 판매원 계약서</Text>
          <Text style={S.subtitle}>크루즈닷 × {orgName}</Text>
        </View>

        <View style={S.divider} />

        {/* 계약 당사자 정보 */}
        <View style={S.infoBox}>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>회사</Text>
            <Text style={S.infoValue}>크루즈닷 ({orgName})</Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>판매원 성명</Text>
            <Text style={S.infoValue}>{memberName}</Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>전화번호</Text>
            <Text style={S.infoValue}>{memberPhone}</Text>
          </View>
          {memberEmail && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>이메일</Text>
              <Text style={S.infoValue}>{memberEmail}</Text>
            </View>
          )}
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>역할</Text>
            <Text style={S.infoValue}>{roleLabel} ({role})</Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>계약 체결일</Text>
            <Text style={S.infoValue}>{signedAt}</Text>
          </View>
        </View>

        {/* 위약벌 경고 */}
        <View style={S.warningBox}>
          <Text style={S.warningText}>
            ⚠ 위약벌 최대 3,000만원 적용 | 3.3% 원천징수 | 여행 출발 완료 후 수당 지급 | 경업금지 1년
          </Text>
        </View>

        {/* 계약 조항 */}
        {CONTRACT_SECTIONS.map((sec, i) => (
          <View key={i} style={S.section}>
            <Text style={S.secTitle}>{sec.title}</Text>
            <Text style={S.body}>{sec.content}</Text>
          </View>
        ))}

        <View style={S.divider} />

        {/* 디지털 서명 */}
        <View style={S.sigBox}>
          <Text style={S.sigTitle}>디지털 서명 (전자서명법 적용)</Text>
          <Text style={S.sigName}>{signature}</Text>
          <Text style={S.sigCaption}>위 서명은 판매원 본인이 성명을 직접 입력한 전자서명으로, 「전자서명법」에 따른 법적 효력을 가집니다.</Text>
          <Text style={[S.sigCaption, { marginTop: 4 }]}>서명 일시: {signedAt}</Text>
        </View>

        {/* 푸터 */}
        <Text style={S.footer}>
          본 문서는 전자서명에 의해 자동 생성된 계약서입니다. 크루즈닷 × {orgName}
        </Text>
      </Page>
    </Document>
  );
}

// ─── 내보내기 ────────────────────────────────────────────────────────────────

export async function generateContractPdf(params: ContractPdfProps): Promise<Buffer> {
  const pdfBuffer = await renderToBuffer(<ContractPdf {...params} />);
  return Buffer.from(pdfBuffer);
}
