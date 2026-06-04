/**
 * 크루즈닷 구매계약서 PDF 생성
 * GmarketSans 폰트 (한글 깨짐 방지)
 * 서명 이미지 포함
 */
import path from 'path';
import {
  Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer';
import React from 'react';

// ─── 폰트 등록 ───────────────────────────────────────────────────────────────

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
  page:        { fontFamily: 'GmarketSans', fontSize: 9, color: '#1a1a1a', padding: 48, lineHeight: 1.6 },
  header:      { textAlign: 'center', marginBottom: 20 },
  title:       { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle:    { fontSize: 10, fontWeight: 300, color: '#555' },
  divider:     { borderBottom: 1, borderColor: '#ddd', marginVertical: 12 },
  sectionTitle:{ fontSize: 11, fontWeight: 700, color: '#1a3a6b', marginBottom: 8, marginTop: 14 },
  row:         { flexDirection: 'row', marginBottom: 5 },
  label:       { width: 100, fontWeight: 700, color: '#555', fontSize: 9 },
  value:       { flex: 1, fontWeight: 400, color: '#1a1a1a' },
  infoBox:     { backgroundColor: '#f5f7fa', borderRadius: 4, padding: 12, marginBottom: 14 },
  warningBox:  { backgroundColor: '#fff8e1', border: 1, borderColor: '#f0c000', borderRadius: 4, padding: 10, marginBottom: 14 },
  warningText: { fontSize: 8.5, fontWeight: 700, color: '#7a5c00' },
  policyItem:  { fontSize: 8.5, color: '#444', marginBottom: 3, fontWeight: 300 },
  specialBox:  { border: 1, borderColor: '#ddd', borderRadius: 4, padding: 10, marginBottom: 14, backgroundColor: '#fafafa' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a3a6b', padding: '6 8' },
  tableHeaderText: { color: '#fff', fontSize: 8, fontWeight: 700 },
  tableRow:    { flexDirection: 'row', borderBottom: 1, borderColor: '#eee', padding: '5 8' },
  tableCell:   { fontSize: 8, color: '#333' },
  sigBox:      { marginTop: 16, border: 1, borderColor: '#333', borderRadius: 4, padding: 14, backgroundColor: '#fffdf5' },
  sigTitle:    { fontSize: 10, fontWeight: 700, marginBottom: 8, color: '#1a3a6b' },
  sigImg:      { maxWidth: 200, maxHeight: 80, marginTop: 8, border: 1, borderColor: '#eee' },
  sigName:     { fontSize: 12, fontWeight: 700, color: '#1a3a6b', marginBottom: 4 },
  sigCaption:  { fontSize: 8, color: '#777', fontWeight: 300 },
  footer:      { position: 'absolute', bottom: 28, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#aaa' },
});

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Companion {
  name:      string;
  birthDate: string;
  relation:  string;
  phone:     string;
}

export interface PurchaseContractPdfParams {
  docId:              string;
  buyerName:          string;
  buyerTel:           string;
  productName:        string;
  amount:             number;
  departureDate:      string | null;
  nights:             number | null;
  paymentMethod:      string;
  paidAt:             string | null;
  cancellationPolicy: string[];
  specialTerms:       string | null;
  companions:         Companion[];
  signatureImage:     string;   // base64 data URL
  signedAt:           string;   // 한국어 날짜 문자열
  signedByName:       string;
  companyName:        string;
}

// ─── PDF 컴포넌트 ─────────────────────────────────────────────────────────────

function PurchaseContractPdf(p: PurchaseContractPdfParams) {
  return (
    <Document title={`구매계약서_${p.buyerName}`} author="크루즈닷">
      <Page size="A4" style={S.page}>
        {/* 헤더 */}
        <View style={S.header}>
          <Text style={S.title}>크루즈 여행 구매계약서</Text>
          <Text style={S.subtitle}>{p.companyName} | 문서번호: {p.docId.slice(-8)}</Text>
        </View>
        <View style={S.divider} />

        {/* 계약 당사자 */}
        <Text style={S.sectionTitle}>1. 계약 당사자</Text>
        <View style={S.infoBox}>
          <View style={S.row}><Text style={S.label}>회사</Text><Text style={S.value}>{p.companyName}</Text></View>
          <View style={S.row}><Text style={S.label}>고객명</Text><Text style={S.value}>{p.buyerName}</Text></View>
          <View style={S.row}><Text style={S.label}>연락처</Text><Text style={S.value}>{p.buyerTel}</Text></View>
        </View>

        {/* 상품 정보 */}
        <Text style={S.sectionTitle}>2. 상품 및 결제 정보</Text>
        <View style={S.infoBox}>
          <View style={S.row}><Text style={S.label}>상품명</Text><Text style={S.value}>{p.productName}</Text></View>
          {p.departureDate && <View style={S.row}><Text style={S.label}>출발일</Text><Text style={S.value}>{p.departureDate}{p.nights ? ` (${p.nights}박)` : ''}</Text></View>}
          <View style={S.row}><Text style={S.label}>결제금액</Text><Text style={S.value}>{Number(p.amount).toLocaleString('ko-KR')}원</Text></View>
          <View style={S.row}><Text style={S.label}>결제수단</Text><Text style={S.value}>{p.paymentMethod}</Text></View>
          {p.paidAt && <View style={S.row}><Text style={S.label}>결제일시</Text><Text style={S.value}>{p.paidAt}</Text></View>}
        </View>

        {/* 취소/환불 규정 */}
        <Text style={S.sectionTitle}>3. 취소 및 환불 규정</Text>
        <View style={S.warningBox}>
          <Text style={S.warningText}>⚠ 아래 취소/환불 규정을 반드시 확인하세요</Text>
        </View>
        <View style={S.infoBox}>
          {p.cancellationPolicy.map((item, i) => (
            <Text key={i} style={S.policyItem}>• {item}</Text>
          ))}
        </View>

        {/* 특약사항 */}
        {p.specialTerms && (
          <>
            <Text style={S.sectionTitle}>4. 특약사항</Text>
            <View style={S.specialBox}>
              <Text style={[S.policyItem, { lineHeight: 1.8 }]}>{p.specialTerms}</Text>
            </View>
          </>
        )}

        {/* 동행자 */}
        {p.companions.length > 0 && (
          <>
            <Text style={S.sectionTitle}>{p.specialTerms ? '5' : '4'}. 동행자 정보 ({p.companions.length}명)</Text>
            <View style={S.tableHeader}>
              {['#', '이름', '생년월일', '관계', '연락처'].map((h, i) => (
                <Text key={i} style={[S.tableHeaderText, { flex: i === 0 ? 0.3 : i === 1 ? 1.5 : 1.2 }]}>{h}</Text>
              ))}
            </View>
            {p.companions.map((c, i) => (
              <View key={i} style={[S.tableRow, i % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }]}>
                <Text style={[S.tableCell, { flex: 0.3 }]}>{i + 1}</Text>
                <Text style={[S.tableCell, { flex: 1.5 }]}>{c.name}</Text>
                <Text style={[S.tableCell, { flex: 1.2 }]}>{c.birthDate}</Text>
                <Text style={[S.tableCell, { flex: 1.2 }]}>{c.relation}</Text>
                <Text style={[S.tableCell, { flex: 1.2 }]}>{c.phone}</Text>
              </View>
            ))}
          </>
        )}

        {/* 전자서명 */}
        <View style={S.sigBox}>
          <Text style={S.sigTitle}>전자서명 확인</Text>
          <View style={S.row}>
            <Text style={S.label}>서명자</Text>
            <Text style={S.sigName}>{p.signedByName}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>서명 일시</Text>
            <Text style={S.value}>{p.signedAt}</Text>
          </View>
          {p.signatureImage && (
            <Image src={p.signatureImage} style={S.sigImg} />
          )}
          <Text style={[S.sigCaption, { marginTop: 8 }]}>
            본 계약서는 「전자서명법」에 따른 전자서명으로 법적 효력을 가집니다.
          </Text>
        </View>

        {/* 푸터 */}
        <Text style={S.footer}>
          {p.companyName} | 서명 완료: {p.signedAt} | 문서번호: {p.docId.slice(-8)}
        </Text>
      </Page>
    </Document>
  );
}

// ─── 내보내기 ─────────────────────────────────────────────────────────────────

export async function generatePurchaseContractPdf(params: PurchaseContractPdfParams): Promise<Buffer> {
  const buf = await renderToBuffer(<PurchaseContractPdf {...params} />);
  return Buffer.from(buf);
}
