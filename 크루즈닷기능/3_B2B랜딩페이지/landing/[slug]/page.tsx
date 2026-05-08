import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/metadata';
import { normalizeLandingHtmlContent } from '@/lib/landing-html';
import { LandingCommentsSection } from '@/components/landing/LandingCommentsSection';
import { LandingPushNotificationPrompt } from '@/components/landing/LandingPushNotificationPrompt';
import { LandingClientWrapper } from '@/components/landing/LandingClientWrapper';
import { getSessionUser } from '@/lib/auth';

type DataFieldKey = 'phone' | 'name' | 'gender' | 'birthDate' | 'email' | 'address' | 'marketingConsent';

interface FieldConfig {
  enabled?: boolean;
  required?: boolean;
}

interface AdditionalField {
  id?: string | number;
  name?: string;
  required?: boolean;
}

interface ProductPurchaseConfig {
  enabled?: boolean;
  paymentProvider?: 'payapp' | 'welcomepay' | string;
  productName?: string;
  sellingPrice?: number | string | null;
  useQuantity?: boolean;
  purchaseQuantity?: number | string | null;
  paymentType?: 'basic' | 'cardInput' | string;
  paymentGroupId?: number | string | null;
  dbGroupId?: number | string | null;
}

interface BusinessInfo {
  fields?: Partial<Record<DataFieldKey, FieldConfig>>;
  additionalFields?: AdditionalField[];
  productPurchase?: ProductPurchaseConfig | null;
  commentSettings?: unknown;
  siteName?: string;
  companyName?: string;
  businessNumber?: string;
  businessPhone?: string;
  privacyOfficer?: string;
  address?: string;
}

const DATA_FIELD_ORDER: DataFieldKey[] = ['name', 'phone', 'gender', 'birthDate', 'email', 'address', 'marketingConsent'];

const FIELD_DEFINITIONS: Record<
  DataFieldKey,
  {
    label: string;
    placeholder?: string;
    inputType: 'text' | 'tel' | 'email' | 'date' | 'select' | 'checkbox';
    options?: Array<{ value: string; label: string }>;
  }
> = {
  phone: { label: '휴대폰 번호', placeholder: '010-1234-5678', inputType: 'tel' },
  name: { label: '이름', placeholder: '이름을 입력하세요', inputType: 'text' },
  gender: {
    label: '성별',
    inputType: 'select',
    options: [
      { value: '', label: '선택하세요' },
      { value: 'male', label: '남성' },
      { value: 'female', label: '여성' },
    ],
  },
  birthDate: { label: '생년월일', inputType: 'date' },
  email: { label: '이메일', placeholder: 'example@email.com', inputType: 'email' },
  address: { label: '주소', placeholder: '주소를 입력하세요', inputType: 'text' },
  marketingConsent: { label: '마케팅 활용 및 광고성 정보 수신 동의', inputType: 'checkbox' },
};

const DEFAULT_FIELD_CONFIG: Record<DataFieldKey, FieldConfig> = {
  phone: { enabled: false, required: false },
  name: { enabled: false, required: false },
  gender: { enabled: false, required: false },
  birthDate: { enabled: false, required: false },
  email: { enabled: false, required: false },
  address: { enabled: false, required: false },
  marketingConsent: { enabled: true, required: true },
};

const FALLBACK_FIELDS: Array<{ key: DataFieldKey; required: boolean }> = [
  { key: 'name', required: false },
  { key: 'phone', required: true },
  { key: 'marketingConsent', required: true },
];

const PAYMENT_PROVIDER_LABEL: Record<string, string> = {
  payapp: '페이앱',
  welcomepay: '웰컴페이먼츠',
};

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  basic: '기본 타입',
  cardInput: '카드번호 입력',
};

const EXTENSION_STYLES = `
  .lp-extension-root {
    background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
    padding: 48px 16px 96px;
  }
  @media (min-width: 768px) {
    .lp-extension-root {
      padding: 72px 0 120px;
    }
  }
  .lp-extension-container {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }
  .lp-card {
    background: #ffffff;
    border-radius: 24px;
    box-shadow: 0 25px 60px rgba(15, 23, 42, 0.08);
    padding: 32px;
  }
  .lp-section-label {
    font-size: 13px;
    font-weight: 600;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }
  .lp-section-title {
    font-size: 28px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 12px;
    line-height: 1.25;
  }
  .lp-section-description {
    color: #475569;
    margin-bottom: 28px;
    line-height: 1.6;
  }
  .lp-form-grid {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .lp-form-field label {
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
    display: block;
    margin-bottom: 8px;
  }
  .lp-form-field input,
  .lp-form-field select {
    width: 100%;
    border-radius: 14px;
    border: 2px solid #e2e8f0;
    padding: 14px 16px;
    font-size: 16px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .lp-form-field input:focus,
  .lp-form-field select:focus {
    border-color: #6366f1;
    outline: none;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
  }
  .lp-form-field--checkbox label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .lp-form-field--checkbox input {
    width: 20px;
    height: 20px;
    margin-top: 2px;
  }
  .lp-required {
    color: #ef4444;
    margin-left: 4px;
    font-size: 14px;
  }
  .lp-primary-button {
    margin-top: 12px;
    width: 100%;
    border: none;
    border-radius: 16px;
    padding: 18px;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: #ffffff;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .lp-primary-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 30px rgba(79, 70, 229, 0.25);
  }
  .lp-helper-text {
    font-size: 14px;
    color: #64748b;
    margin-top: 12px;
  }
  .lp-product-card {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .lp-product-price {
    font-size: 40px;
    font-weight: 900;
    color: #2563eb;
    margin: 4px 0 12px;
  }
  .lp-product-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }
  .lp-product-meta dt {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
    margin-bottom: 4px;
  }
  .lp-product-meta dd {
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
  }
  .lp-secondary-button {
    margin-top: 4px;
    align-self: flex-start;
    border-radius: 14px;
    padding: 14px 22px;
    border: 2px solid #c7d2fe;
    background: #eef2ff;
    color: #4f46e5;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }
  .lp-secondary-button:hover {
    background: #e0e7ff;
    border-color: #a5b4fc;
  }
  .lp-comment-list {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin-top: 16px;
  }
  .lp-comment-card {
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 20px;
    background: #f8fafc;
  }
  .lp-comment-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .lp-comment-author {
    font-weight: 700;
    color: #0f172a;
  }
  .lp-comment-date {
    font-size: 13px;
    color: #64748b;
  }
  .lp-comment-text {
    color: #334155;
    line-height: 1.6;
    white-space: pre-line;
  }
`;

export const dynamic = 'force-dynamic';

interface LandingPageProps {
  params: Promise<{ slug: string }>;
}

// SEO 메타데이터 생성
export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const pagePath = `/landing/${resolvedParams.slug}`;

  try {
    const landingPage = await prisma.landingPage.findUnique({
      where: {
        slug: resolvedParams.slug,
        isActive: true,
        isPublic: true,
      },
      select: {
        exposureTitle: true,
        title: true,
        description: true,
        exposureImage: true,
      },
    });

    if (!landingPage) {
      return generateSeoMetadata(pagePath);
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cruisedot.co.kr';
    const title = landingPage.exposureTitle || landingPage.title || '크루즈 가이드';
    const description = landingPage.description || '크루즈 여행을 위한 특별한 랜딩 페이지';
    const image = landingPage.exposureImage || `${baseUrl}/images/ai-cruise-logo.png`;
    const fullImageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`;

    return generateSeoMetadata(pagePath, {
      title,
      description,
      image: fullImageUrl,
      url: `${baseUrl}${pagePath}`,
    });
  } catch (error) {
    console.error('[LandingPage] Error generating metadata:', error);
    return generateSeoMetadata(pagePath);
  }
}

function parseBusinessInfo(raw: unknown): BusinessInfo | null {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as BusinessInfo;
    } catch (error) {
      console.warn('[LandingPage] Failed to parse businessInfo string:', error);
      return null;
    }
  }

  if (typeof raw === 'object') {
    return raw as BusinessInfo;
  }

  return null;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeProductPurchase(raw?: ProductPurchaseConfig | null): ProductPurchaseConfig | null {
  if (!raw || raw.enabled === false) {
    return null;
  }

  return {
    ...raw,
    sellingPrice: toNumber(raw.sellingPrice),
    purchaseQuantity: toNumber(raw.purchaseQuantity),
    paymentGroupId: raw.paymentGroupId !== undefined && raw.paymentGroupId !== null ? Number(raw.paymentGroupId) : null,
    dbGroupId: raw.dbGroupId !== undefined && raw.dbGroupId !== null ? Number(raw.dbGroupId) : null,
  };
}

function buildEnabledFields(fields?: Partial<Record<DataFieldKey, FieldConfig>>): Array<{ key: DataFieldKey; required: boolean }> {
  const merged: Record<DataFieldKey, FieldConfig> = {
    ...DEFAULT_FIELD_CONFIG,
    ...(fields || {}),
  };

  const enabled = DATA_FIELD_ORDER
    .map((key) => ({
      key,
      required: Boolean(merged[key]?.required),
      isEnabled: Boolean(merged[key]?.enabled),
    }))
    .filter((entry) => entry.isEnabled)
    .map(({ key, required }) => ({ key, required }));

  if (enabled.length > 0) {
    return enabled;
  }

  return FALLBACK_FIELDS;
}

export default async function LandingPage({ params }: LandingPageProps) {
  const resolvedParams = await params;
  const slugOrId = resolvedParams.slug;

  // slug가 숫자인 경우 ID로 조회, 아니면 slug로 조회
  const landingPageId = parseInt(slugOrId);
  let landingPage = null;

  if (!isNaN(landingPageId)) {
    // ID로 조회
    landingPage = await prisma.landingPage.findUnique({
      where: {
        id: landingPageId,
      },
      include: {
        LandingPageComment: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
        },
      },
    });

    // ID로 조회했을 때는 isActive/isPublic 체크
    if (landingPage && (!landingPage.isActive || !landingPage.isPublic)) {
      landingPage = null;
    }
  } else {
    // slug로 조회
    landingPage = await prisma.landingPage.findUnique({
      where: {
        slug: slugOrId,
        isActive: true,
        isPublic: true,
      },
      include: {
        LandingPageComment: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
        },
      },
    });
  }

  if (!landingPage) {
    notFound();
  }

  await prisma.landingPage.update({
    where: { id: landingPage.id },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });

  const businessInfo = parseBusinessInfo(landingPage.businessInfo);
  const enabledFields = buildEnabledFields(businessInfo?.fields);
  const additionalQuestions = (businessInfo?.additionalFields || [])
    .filter((field) => Boolean(field?.name?.trim()))
    .map((field, index) => ({
      ...field,
      id: field.id || `question-${index}`,
      name: field.name!,
      required: field.required || false
    }));
  const productPurchase = normalizeProductPurchase(businessInfo?.productPurchase);
  const showProductSection = Boolean(productPurchase);
  const showFormSection = Boolean(landingPage.infoCollection);
  const comments = landingPage.LandingPageComment || [];
  const shouldRenderExtensions = showProductSection || showFormSection || landingPage.commentEnabled;
  const buttonLabel = landingPage.buttonTitle || '신청하기';

  // 랜딩페이지 소유자 확인
  let isLandingPageOwner = false;
  let isBossUser = false;
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser && sessionUser.id === landingPage.adminId) {
      // 대리점장인지 확인
      const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        include: {
          AffiliateProfile: {
            select: {
              type: true,
            },
          },
        },
      });
      if (user?.AffiliateProfile?.type === 'BRANCH_MANAGER') {
        isLandingPageOwner = true;
      }
    }
    // boss 사용자 확인
    if (sessionUser) {
      const userName = (sessionUser.name || '').toLowerCase();
      const userEmail = ((sessionUser as any).email || '').toLowerCase();
      isBossUser = userName.startsWith('boss') || userEmail.startsWith('boss');
    }
  } catch (error) {
    console.error('[Landing Page] Session check error:', error);
  }

  // 사업자 정보 및 파일 첨부 확인용
  const hasBusinessInfo = businessInfo && (businessInfo.siteName || businessInfo.companyName || businessInfo.businessNumber || businessInfo.businessPhone || businessInfo.privacyOfficer || businessInfo.address);
  const hasAttachment = !!landingPage.attachmentFile;

  const formatPrice = (value?: number) => {
    if (value === undefined) {
      return null;
    }
    try {
      return `${value.toLocaleString('ko-KR')}원`;
    } catch {
      return null;
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: EXTENSION_STYLES }} />
      {landingPage.headerScript && (
        <script
          id={`landing-page-header-script-${landingPage.id}`}
          dangerouslySetInnerHTML={{ __html: landingPage.headerScript }}
        />
      )}
      <div dangerouslySetInnerHTML={{ __html: normalizeLandingHtmlContent(landingPage.htmlContent || '') }} />

      {shouldRenderExtensions && (
        <div className="lp-extension-root">
          <div className="lp-extension-container">
            {/* 자료다운 버튼 - 상품 구매 위에 표시 */}
            {hasAttachment && landingPage.attachmentFile && (
              <section className="lp-card" style={{ marginBottom: '32px' }}>
                <a
                  href={landingPage.attachmentFile.startsWith('http') ? landingPage.attachmentFile : `${process.env.NEXT_PUBLIC_BASE_URL || ''}${landingPage.attachmentFile}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="lp-download-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '16px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>📥 자료 다운로드</span>
                </a>
              </section>
            )}

            {/* 상품 구매 + 등록 폼 섹션 (고객 정보 공유를 위해 래퍼 컴포넌트 사용) */}
            <LandingClientWrapper
              slug={slugOrId}
              landingPageId={landingPage.id}
              showFormSection={showFormSection}
              buttonLabel={buttonLabel}
              fields={enabledFields.map(({ key, required }) => {
                const definition = FIELD_DEFINITIONS[key];
                return {
                  key,
                  label: definition.label,
                  placeholder: definition.placeholder,
                  inputType: definition.inputType,
                  options: definition.options,
                  required,
                };
              })}
              additionalQuestions={additionalQuestions}
              showProductSection={showProductSection}
              productPurchase={productPurchase}
            />

            {landingPage.commentEnabled && (
              <LandingCommentsSection
                slug={slugOrId}
                initialComments={comments.map((comment) => ({
                  id: comment.id,
                  authorName: comment.authorName,
                  content: comment.content,
                  createdAt: comment.createdAt.toISOString(),
                  isAutoGenerated: comment.isAutoGenerated,
                }))}
                commentEnabled={landingPage.commentEnabled}
                isLandingPageOwner={isLandingPageOwner}
                isBossUser={isBossUser}
              />
            )}
          </div>
        </div>
      )}

      {/* 사업자 정보 푸터 - 댓글 맨 밑에 표시 */}
      {hasBusinessInfo && (
        <footer className="lp-extension-root" style={{ paddingTop: '32px', paddingBottom: '32px', background: '#f8fafc' }}>
          <div className="lp-extension-container">
            <div className="lp-card" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              <div className="lp-section-label" style={{ color: '#64748b' }}>사업자 정보</div>

              {/* 사업자 정보 텍스트 표시 */}
              {hasBusinessInfo && businessInfo && (
                <div style={{
                  marginTop: '16px',
                  marginBottom: '0',
                  padding: '20px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#4b5563',
                    lineHeight: '1.8'
                  }}>
                    {businessInfo.siteName && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#1f2937' }}>사이트명:</strong> {businessInfo.siteName}
                      </div>
                    )}
                    {businessInfo.companyName && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#1f2937' }}>회사명:</strong> {businessInfo.companyName}
                      </div>
                    )}
                    {businessInfo.businessNumber && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#1f2937' }}>사업자번호:</strong> {businessInfo.businessNumber}
                      </div>
                    )}
                    {businessInfo.businessPhone && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#1f2937' }}>대표연락처:</strong> {businessInfo.businessPhone}
                      </div>
                    )}
                    {businessInfo.privacyOfficer && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#1f2937' }}>개인정보담당:</strong> {businessInfo.privacyOfficer}
                      </div>
                    )}
                    {businessInfo.address && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#1f2937' }}>주소:</strong> {businessInfo.address}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </footer>
      )}

      {/* 푸시 알림 권한 요청 - 푸시 알림이 활성화된 경우에만 표시 */}
      {landingPage.pushNotificationEnabled && (
        <LandingPushNotificationPrompt
          landingPageId={landingPage.id}
          pushNotificationEnabled={landingPage.pushNotificationEnabled}
          boardingTime={landingPage.boardingTime}
          disembarkationTime={landingPage.disembarkationTime}
          departureWarning={landingPage.departureWarning !== undefined ? landingPage.departureWarning : true}
        />
      )}
    </>
  );
}


