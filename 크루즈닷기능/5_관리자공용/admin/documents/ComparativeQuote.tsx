'use client';

import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download, Mail, Check, X, Plus, Trash2, Eye } from 'lucide-react';
import { showSuccess, showError } from '@/components/ui/Toast';
import Image from 'next/image';

// 크루즈 상품 템플릿 데이터
const CRUISE_TEMPLATES = [
  // 일본
  { id: 'japan-1', region: '일본', name: '일본 규슈 크루즈 4박 5일', nights: 4, days: 5, basePrice: 1800000 },
  { id: 'japan-2', region: '일본', name: '일본 오키나와 크루즈 5박 6일', nights: 5, days: 6, basePrice: 2200000 },
  { id: 'japan-3', region: '일본', name: '일본 도쿄 크루즈 6박 7일', nights: 6, days: 7, basePrice: 2800000 },
  // 동남아
  { id: 'seasia-1', region: '동남아', name: '동남아시아 5박 6일 크루즈', nights: 5, days: 6, basePrice: 2500000 },
  { id: 'seasia-2', region: '동남아', name: '베트남/태국 크루즈 6박 7일', nights: 6, days: 7, basePrice: 2900000 },
  { id: 'seasia-3', region: '동남아', name: '필리핀 팔라완 크루즈 7박 8일', nights: 7, days: 8, basePrice: 3200000 },
  // 싱가폴
  { id: 'singapore-1', region: '싱가포르', name: '싱가포르 발출 크루즈 5박 6일', nights: 5, days: 6, basePrice: 2400000 },
  { id: 'singapore-2', region: '싱가포르', name: '싱가포르/말레이시아 크루즈 6박 7일', nights: 6, days: 7, basePrice: 2700000 },
  // 중국
  { id: 'china-1', region: '중국', name: '중국 상하이 크루즈 4박 5일', nights: 4, days: 5, basePrice: 1900000 },
  { id: 'china-2', region: '중국', name: '중국 황금강 크루즈 7박 8일', nights: 7, days: 8, basePrice: 3300000 },
  // 대만
  { id: 'taiwan-1', region: '대만', name: '대만 크루즈 5박 6일', nights: 5, days: 6, basePrice: 2300000 },
  // 홍콩
  { id: 'hongkong-1', region: '홍콩', name: '홍콩 발출 크루즈 5박 6일', nights: 5, days: 6, basePrice: 2600000 },
  { id: 'hongkong-2', region: '홍콩', name: '홍콩/중국 크루즈 6박 7일', nights: 6, days: 7, basePrice: 3000000 },
  // 미국
  { id: 'usa-1', region: '미국', name: '알래스카 크루즈 9박 10일', nights: 9, days: 10, basePrice: 5200000 },
  { id: 'usa-2', region: '미국', name: '하와이 크루즈 7박 8일', nights: 7, days: 8, basePrice: 4800000 },
  // 카리브해
  { id: 'caribbean-1', region: '카리브해', name: '카리브해 동부 크루즈 7박 8일', nights: 7, days: 8, basePrice: 4500000 },
  { id: 'caribbean-2', region: '카리브해', name: '카리브해 서부 크루즈 6박 7일', nights: 6, days: 7, basePrice: 4200000 },
  // 지중해
  { id: 'mediterranean-1', region: '서부지중해', name: '서부 지중해 크루즈 7박 8일', nights: 7, days: 8, basePrice: 3800000 },
  { id: 'mediterranean-2', region: '동부지중해', name: '동부 지중해 크루즈 8박 9일', nights: 8, days: 9, basePrice: 4100000 },
  // 유럽
  { id: 'europe-west-1', region: '서유럽', name: '서유럽 크루즈 9박 10일', nights: 9, days: 10, basePrice: 4900000 },
  { id: 'europe-east-1', region: '동유럽', name: '동유럽 크루즈 8박 9일', nights: 8, days: 9, basePrice: 4400000 },
];

// 일정 옵션
const DURATION_OPTIONS = [
  { nights: 3, days: 4, label: '3박 4일' },
  { nights: 4, days: 5, label: '4박 5일' },
  { nights: 5, days: 6, label: '5박 6일' },
  { nights: 6, days: 7, label: '6박 7일' },
  { nights: 7, days: 8, label: '7박 8일' },
  { nights: 8, days: 9, label: '8박 9일' },
  { nights: 9, days: 10, label: '9박 10일' },
  { nights: 10, days: 11, label: '10박 11일' },
  { nights: 11, days: 12, label: '11박 12일' },
  { nights: 12, days: 13, label: '12박 13일' },
  { nights: 13, days: 14, label: '13박 14일' },
  { nights: 14, days: 15, label: '14박 15일' },
];

// 포함사항 키워드 (여행사에서 많이 쓰는 것들)
const INCLUDED_KEYWORDS = [
  '크루즈 선박 숙박',
  '항공료 (직항)',
  '항공료 (경유 포함)',
  '전일정 전문 가이드',
  '일일 3식 (양식/한식 버퍼)',
  '일일 3식 (양식 버퍼)',
  'Wi-Fi (객실당 1개)',
  '선박 내 엔터테인먼트',
  '선박 내 스파 이용권',
  '선박 내 수영장 이용',
  '공항 픽업/드롭오프',
  '입국 서비스 지원',
  '선택 투어 할인권',
  '선박 내 쇼핑몰 할인권',
  '선내 팁 (Gratuity)',
  '선내 서비스 수수료',
  '공항세 및 유류할증료',
  '여행자 보험',
  '비자 수수료',
  '현지 세금 및 관광세',
];

// 불포함사항 키워드
const EXCLUDED_KEYWORDS = [
  '개인 소비품',
  '선택 투어',
  '선박 내 음료',
  '선박 내 레스토랑 추가 요금',
  'SPA 마사지',
  '세탁 서비스',
  '인터넷 추가 이용료',
  '개인 비자',
  '여행자 보험',
  '공항세',
  '유류할증료',
  '항공 수하물 초과 요금',
  '개인 식비',
  '쇼핑 비용',
  '팁 (선택사항)',
  '항공 좌석 지정료',
  '특별 식단 요청',
  '객실 업그레이드',
  '항공 마일리지',
  '개인 여행자 보험',
];

// 국가별 도시 데이터
const COUNTRIES_CITIES: Record<string, string[]> = {
  '일본': ['도쿄', '요코하마', '오사카', '후쿠오카', '나가사키', '오키나와', '가고시마', '히로시마'],
  '중국': ['상하이', '베이징', '광저우', '홍콩', '마카오', '시안', '청두'],
  '대만': ['타이페이', '가오슝', '타이중', '타이난'],
  '홍콩': ['홍콩', '마카오'],
  '싱가포르': ['싱가포르'],
  '말레이시아': ['쿠알라룸푸르', '페낭', '랑카위', '코타키나발루'],
  '태국': ['방콕', '푸켓', '피피섬', '파타야', '치앙마이'],
  '베트남': ['호치민', '하노이', '다낭', '하롱베이', '후에'],
  '필리핀': ['마닐라', '세부', '팔라완', '보라카이'],
  '미국': ['시애틀', '앵커리지', '주노', '켓치칸', '빅토리아', '산프란시스코', '로스앤젤레스', '마이애미'],
  '캐나다': ['빅토리아', '밴쿠버', '스키어웨이', '할리팩스'],
  '스페인': ['바르셀로나', '발렌시아', '마요르카', '말라가'],
  '프랑스': ['마르세유', '칸', '니스', '코르시카'],
  '이탈리아': ['제노바', '리보르노', '칼리아리', '나폴리', '로마', '베니스'],
  '그리스': ['아테네', '산토리니', '미코노스', '로도스'],
  '터키': ['이스탄불', '쿠샤다시', '에페소스'],
  '크로아티아': ['두브로브니크', '스플리트', '자다르'],
  '영국': ['사우샘프턴', '더블린', '에딘버러', '리버풀'],
  '노르웨이': ['베르겐', '올로', '스타방에르'],
  '독일': ['함부르크', '키엘'],
  '덴마크': ['코펜하겐'],
  '스웨덴': ['스톡홀름'],
  '폴란드': ['그단스크'],
  '러시아': ['상트페테르부르크', '모스크바'],
  '에스토니아': ['탈린'],
  '핀란드': ['헬싱키'],
  '바하마': ['나소', '프리포트'],
  '자메이카': ['오초리오스', '몬테고베이'],
  '케이맨 제도': ['조지타운'],
  '멕시코': ['코수멜', '코스타 마야', '푸에르토 바야르타'],
  '벨리즈': ['벨리즈 시티'],
  '콜롬비아': ['카르타헤나'],
  '파나마': ['파나마 시티', '콜론'],
  '코스타리카': ['푸에르토 리몬'],
  '도미니카 공화국': ['라 로마나', '푸에르토 플라타'],
};

// 기항지 선택 컴포넌트
function PortSelector({ onSelect, getCitiesByCountry }: {
  onSelect: (port: { name: string; country: string }) => void;
  getCitiesByCountry: (country: string) => string[];
}) {
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setSelectedCity(''); // 국가 변경 시 도시 초기화
  };

  const handleCityChange = (city: string) => {
    if (city && selectedCountry) {
      onSelect({ name: city, country: selectedCountry });
      setSelectedCountry('');
      setSelectedCity('');
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <select
        value={selectedCountry}
        onChange={(e) => handleCountryChange(e.target.value)}
        className="rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
      >
        <option value="">국가 선택</option>
        {Object.keys(COUNTRIES_CITIES).map((country) => (
          <option key={country} value={country}>
            {country}
          </option>
        ))}
      </select>
      <select
        value={selectedCity}
        onChange={(e) => handleCityChange(e.target.value)}
        disabled={!selectedCountry}
        className="rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100 disabled:bg-gray-100"
      >
        <option value="">도시 선택</option>
        {selectedCountry && getCitiesByCountry(selectedCountry).map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </div>
  );
}

interface CruiseProduct {
  productName: string;
  price: number;
  priceDisplay: string;
  nights: number;
  days: number;
  departure: string;
  includesFlight: boolean;
  includesAirplane: boolean;
  includesGuide: boolean;
  hasEscort: boolean;
  hasCruisedotStaff: boolean;
  included: string[];
  excluded: string[];
  ports: Array<{ name: string; country: string }>;
  guideService: string;
  additionalServices: string;
}

interface CruiseProductFromAPI {
  id: number;
  productCode: string;
  packageName: string;
  basePrice: number | null;
  nights: number;
  days: number;
  itineraryPattern: any;
  mallProductContent?: {
    layout?: any;
  } | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface CompetitorProduct {
  productName: string;
  price: number;
  priceDisplay: string;
  nights: number;
  days: number;
  departure: string;
  includesFlight: boolean;
  includesAirplane: boolean;
  includesGuide: boolean;
  hasEscort: boolean;
  manualIncludedFeatures: string;
  notes: string;
  included: string[];
  excluded: string[];
  ports: Array<{ name: string; country: string }>;
  guideService: string;
  additionalServices: string;
}

export default function ComparativeQuote() {
  const [cruiseProducts, setCruiseProducts] = useState<CruiseProductFromAPI[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [cruiseProduct, setCruiseProduct] = useState<CruiseProduct>({
    productName: '',
    price: 0,
    priceDisplay: '',
    nights: 7,
    days: 8,
    departure: '',
    includesFlight: true,
    includesAirplane: true,
    includesGuide: true,
    hasEscort: true,
    hasCruisedotStaff: true,
    included: [''],
    excluded: [''],
    ports: [{ name: '', country: '' }],
    guideService: '',
    additionalServices: '',
  });

  const [competitor, setCompetitor] = useState<CompetitorProduct>({
    productName: '',
    price: 0,
    priceDisplay: '',
    nights: 7,
    days: 8,
    departure: '',
    includesFlight: false,
    includesAirplane: false,
    includesGuide: false,
    hasEscort: false,
    manualIncludedFeatures: '',
    notes: '',
    included: [''],
    excluded: [''],
    ports: [{ name: '', country: '' }],
    guideService: '',
    additionalServices: '',
  });

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');


  const quoteRef = useRef<HTMLDivElement>(null);

  // 크루즈 상품 목록 로드
  useEffect(() => {
    loadCruiseProducts();
  }, []);

  const loadCruiseProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const response = await fetch('/api/cms/products');
      const data = await response.json();

      if (data.ok && Array.isArray(data.products)) {
        setCruiseProducts(data.products);
      } else {
        showError('크루즈 상품 목록을 불러오는데 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[ComparativeQuote] Load products error:', error);
      showError('크루즈 상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // 가격 포맷팅 (1,000 단위 구분)
  const formatPrice = (value: string): { num: number; display: string } => {
    const cleaned = value.replace(/,/g, '');
    const num = parseInt(cleaned) || 0;
    return {
      num,
      display: num.toLocaleString('ko-KR'),
    };
  };

  // 국가 코드를 한국어 이름으로 변환
  const getCountryName = (countryCode: string): string => {
    const countryMap: Record<string, string> = {
      'JP': '일본', 'KR': '한국', 'TH': '태국', 'VN': '베트남',
      'MY': '말레이시아', 'SG': '싱가포르', 'ES': '스페인', 'FR': '프랑스',
      'IT': '이탈리아', 'GR': '그리스', 'TR': '터키', 'US': '미국',
      'CN': '중국', 'TW': '대만', 'HK': '홍콩', 'PH': '필리핀',
      'ID': '인도네시아', 'CA': '캐나다', 'GB': '영국', 'NO': '노르웨이',
      'DE': '독일', 'DK': '덴마크', 'SE': '스웨덴', 'PL': '폴란드',
      'RU': '러시아', 'EE': '에스토니아', 'FI': '핀란드',
    };
    return countryMap[countryCode] || countryCode;
  };

  // 크루즈 상품 선택 시 자동 채움
  const handleProductSelect = async (productCode: string) => {
    setSelectedProductCode(productCode);

    if (!productCode) {
      // 초기화
      setCruiseProduct({
        productName: '',
        price: 0,
        priceDisplay: '',
        nights: 7,
        days: 8,
        departure: '',
        includesFlight: true,
        includesAirplane: true,
        includesGuide: true,
        hasEscort: true,
        hasCruisedotStaff: true,
        included: [''],
        excluded: [''],
        ports: [{ name: '', country: '' }],
        guideService: '',
        additionalServices: '',
      });
      return;
    }

    try {
      const product = cruiseProducts.find(p => p.productCode === productCode);
      if (!product) {
        showError('상품을 찾을 수 없습니다.');
        return;
      }

      // 포함사항/불포함사항 파싱
      let included: string[] = [];
      let excluded: string[] = [];

      if (product.mallProductContent?.layout) {
        const layout = typeof product.mallProductContent.layout === 'string'
          ? JSON.parse(product.mallProductContent.layout)
          : product.mallProductContent.layout;

        if (layout.included && Array.isArray(layout.included)) {
          included = layout.included.filter((item: string) => item && item.trim());
        }
        if (layout.excluded && Array.isArray(layout.excluded)) {
          excluded = layout.excluded.filter((item: string) => item && item.trim());
        }
      }

      // 기항지 추출
      const ports: Array<{ name: string; country: string }> = [];
      if (product.itineraryPattern && Array.isArray(product.itineraryPattern)) {
        product.itineraryPattern.forEach((day: any) => {
          if (day.type === 'PortVisit' && day.location && day.country) {
            const countryName = getCountryName(day.country);
            ports.push({
              name: day.location,
              country: countryName,
            });
          }
        });
      }

      // 출발일 설정 (startDate가 있으면 사용)
      let departure = '';
      if (product.startDate) {
        departure = new Date(product.startDate).toISOString().split('T')[0];
      }

      setCruiseProduct({
        productName: product.packageName || '',
        price: product.basePrice || 0,
        priceDisplay: (product.basePrice || 0).toLocaleString('ko-KR'),
        nights: product.nights || 7,
        days: product.days || 8,
        departure,
        includesFlight: true, // 기본값
        includesAirplane: true, // 기본값
        includesGuide: true, // 기본값
        hasEscort: true, // 기본값
        hasCruisedotStaff: true, // 기본값
        included: included.length > 0 ? included : [''],
        excluded: excluded.length > 0 ? excluded : [''],
        ports: ports.length > 0 ? ports : [{ name: '', country: '' }],
        guideService: '', // 수동 입력
        additionalServices: '', // 수동 입력
      });

      showSuccess('상품 정보가 자동으로 설정되었습니다.');
    } catch (error: any) {
      console.error('[ComparativeQuote] Load product error:', error);
      showError('상품 정보를 불러오는데 실패했습니다.');
    }
  };

  // 날짜 포맷팅 (YYYY-MM-DD -> YYYY년 MM월 DD일)
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  // 국가별 도시 가져오기
  const getCitiesByCountry = (country: string): string[] => {
    return COUNTRIES_CITIES[country] || [];
  };

  // 이미지 생성 (다운로드 및 미리보기용)
  const generateImage = async (): Promise<string | null> => {
    if (!quoteRef.current) {
      showError('견적서를 찾을 수 없습니다.');
      return null;
    }

    if (!cruiseProduct.productName || !cruiseProduct.price) {
      showError('크루즈닷 상품 정보를 입력해주세요.');
      return null;
    }

    try {
      // A4 사이즈: 210mm x 297mm
      // 300 DPI로 고품질 출력: 2480px x 3508px
      // 실제 렌더링은 794px x 1123px (96 DPI)로 하고 scale로 확대
      const a4Width = 794; // 96 DPI 기준
      const a4Height = 1123; // 96 DPI 기준

      const canvas = await html2canvas(quoteRef.current, {
        backgroundColor: '#ffffff',
        scale: 3, // 고해상도 (794 * 3 = 2382px, 1123 * 3 = 3369px)
        logging: false,
        useCORS: true,
        allowTaint: false,
      });

      return canvas.toDataURL('image/png');
    } catch (error: any) {
      console.error('[Generate Image] Error:', error);
      showError('이미지 생성 중 오류가 발생했습니다.');
      return null;
    }
  };

  // 이미지 저장
  const handleDownloadImage = async () => {
    setIsDownloading(true);
    const dataUrl = await generateImage();

    if (dataUrl) {
      const link = document.createElement('a');
      const fileName = `비교견적서_${cruiseProduct.productName}_${new Date().toISOString().split('T')[0]}.png`;
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess('견적서 이미지가 다운로드되었습니다.');
    }

    setIsDownloading(false);
  };

  // 미리보기 모달 열기
  const handleOpenPreview = async () => {
    setIsDownloading(true);
    const dataUrl = await generateImage();

    if (dataUrl) {
      setPreviewImageUrl(dataUrl);
      setIsPreviewModalOpen(true);
    }

    setIsDownloading(false);
  };

  // 이메일 발송
  const handleSendEmail = async () => {
    if (!cruiseProduct.productName || !cruiseProduct.price) {
      showError('크루즈닷 상품 정보를 입력해주세요.');
      return;
    }

    // 입력된 이메일 주소 사용
    if (!customerEmail || !customerEmail.trim()) {
      showError('고객 이메일 주소를 입력해주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail.trim())) {
      showError('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    const email = customerEmail.trim();

    try {
      setIsSendingEmail(true);

      const dataUrl = await generateImage();
      if (!dataUrl) {
        return;
      }

      // dataUrl을 blob으로 변환
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('to', email);
      formData.append('subject', '[크루즈닷] 요청하신 비교견적서입니다');
      formData.append('file', blob, `비교견적서_${cruiseProduct.productName}_${new Date().toISOString().split('T')[0]}.png`);

      const apiResponse = await fetch('/api/email/send', {
        method: 'POST',
        body: formData,
      });

      const result = await apiResponse.json();

      if (result.success) {
        showSuccess('메일이 성공적으로 발송되었습니다! 🚀');
      } else {
        showError('전송 실패. 다시 시도해주세요.');
        console.error('[Send Email] API Error:', result.error);
      }

    } catch (error: any) {
      console.error('[Send Email] Error:', error);
      showError('전송 실패. 다시 시도해주세요.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 크루즈닷 상품 입력 섹션 */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">크루즈닷 상품 정보</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 크루즈 상품 선택 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">
              크루즈 상품 선택 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProductCode}
              onChange={(e) => handleProductSelect(e.target.value)}
              disabled={isLoadingProducts}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
            >
              <option value="">
                {isLoadingProducts ? '상품 목록 로딩 중...' : '크루즈 상품을 선택하세요'}
              </option>
              {cruiseProducts.map((product) => (
                <option key={product.productCode} value={product.productCode}>
                  {product.packageName} ({product.productCode}) - {product.basePrice ? product.basePrice.toLocaleString('ko-KR') + '원' : '가격 미정'}
                </option>
              ))}
            </select>
            {cruiseProducts.length === 0 && !isLoadingProducts && (
              <p className="mt-2 text-sm text-gray-500">
                상품이 없습니다. 크루즈 상품 관리에서 상품을 먼저 등록해주세요.
              </p>
            )}
          </div>

          {/* 상품명 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">
              상품명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cruiseProduct.productName}
              onChange={(e) => setCruiseProduct(prev => ({ ...prev, productName: e.target.value }))}
              placeholder="예: 지중해 7박 8일 크루즈"
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 가격 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">
              가격 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cruiseProduct.priceDisplay}
              onChange={(e) => {
                const formatted = formatPrice(e.target.value);
                setCruiseProduct(prev => ({
                  ...prev,
                  price: formatted.num,
                  priceDisplay: formatted.display,
                }));
              }}
              placeholder="예: 3,500,000"
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg font-semibold focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-sm text-gray-500">숫자만 입력하면 자동으로 포맷팅됩니다</p>
          </div>

          {/* 일정 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">일정 <span className="text-red-500">*</span></label>
            <select
              value={`${cruiseProduct.nights}-${cruiseProduct.days}`}
              onChange={(e) => {
                const [nights, days] = e.target.value.split('-').map(Number);
                setCruiseProduct(prev => ({ ...prev, nights, days }));
              }}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={`${opt.nights}-${opt.days}`} value={`${opt.nights}-${opt.days}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 출발일 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">출발일 <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={cruiseProduct.departure}
              onChange={(e) => setCruiseProduct(prev => ({ ...prev, departure: e.target.value }))}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 항공료/비행기/가이드/인솔자/크루즈닷 스탭 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">포함 여부</label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cruiseProduct.includesFlight}
                  onChange={(e) => setCruiseProduct(prev => ({ ...prev, includesFlight: e.target.checked }))}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-base font-semibold">항공료 포함</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cruiseProduct.includesAirplane}
                  onChange={(e) => setCruiseProduct(prev => ({ ...prev, includesAirplane: e.target.checked }))}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-base font-semibold">비행기 포함</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cruiseProduct.includesGuide}
                  onChange={(e) => setCruiseProduct(prev => ({ ...prev, includesGuide: e.target.checked }))}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-base font-semibold">가이드 포함</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cruiseProduct.hasEscort}
                  onChange={(e) => setCruiseProduct(prev => ({ ...prev, hasEscort: e.target.checked }))}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-base font-semibold">인솔자 포함</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cruiseProduct.hasCruisedotStaff}
                  onChange={(e) => setCruiseProduct(prev => ({ ...prev, hasCruisedotStaff: e.target.checked }))}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-base font-semibold flex items-center gap-2">
                  크루즈닷 스탭 포함
                  <Image src="/images/ai-cruise-logo.png" alt="크루즈닷" width={20} height={8} className="inline" />
                </span>
              </label>
            </div>
          </div>

          {/* 포함사항 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">
              포함사항 <span className="text-sm font-normal text-gray-500">(키워드 선택 또는 직접 입력, 클릭하여 수정 가능)</span>
            </label>
            <div className="space-y-3">
              {cruiseProduct.included.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      list={`cruise-included-keywords-${idx}`}
                      value={item}
                      onChange={(e) => {
                        const newIncluded = [...cruiseProduct.included];
                        newIncluded[idx] = e.target.value;
                        setCruiseProduct(prev => ({ ...prev, included: newIncluded }));
                      }}
                      placeholder="키워드 선택 또는 직접 입력 (클릭하여 수정 가능)"
                      className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 pr-10 cursor-text"
                    />
                    <datalist id={`cruise-included-keywords-${idx}`}>
                      {INCLUDED_KEYWORDS.map((keyword) => (
                        <option key={keyword} value={keyword} />
                      ))}
                    </datalist>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {cruiseProduct.included.length > 1 && (
                    <button
                      onClick={() => {
                        const newIncluded = cruiseProduct.included.filter((_, i) => i !== idx);
                        setCruiseProduct(prev => ({ ...prev, included: newIncluded.length ? newIncluded : [''] }));
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCruiseProduct(prev => ({ ...prev, included: [...prev.included, ''] }))}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                <Plus className="w-5 h-5" />
                포함사항 추가
              </button>
            </div>
          </div>

          {/* 불포함사항 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">
              불포함사항 <span className="text-sm font-normal text-gray-500">(키워드 선택 또는 직접 입력, 클릭하여 수정 가능)</span>
            </label>
            <div className="space-y-3">
              {cruiseProduct.excluded.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      list={`cruise-excluded-keywords-${idx}`}
                      value={item}
                      onChange={(e) => {
                        const newExcluded = [...cruiseProduct.excluded];
                        newExcluded[idx] = e.target.value;
                        setCruiseProduct(prev => ({ ...prev, excluded: newExcluded }));
                      }}
                      placeholder="키워드 선택 또는 직접 입력 (클릭하여 수정 가능)"
                      className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 pr-10 cursor-text"
                    />
                    <datalist id={`cruise-excluded-keywords-${idx}`}>
                      {EXCLUDED_KEYWORDS.map((keyword) => (
                        <option key={keyword} value={keyword} />
                      ))}
                    </datalist>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {cruiseProduct.excluded.length > 1 && (
                    <button
                      onClick={() => {
                        const newExcluded = cruiseProduct.excluded.filter((_, i) => i !== idx);
                        setCruiseProduct(prev => ({ ...prev, excluded: newExcluded.length ? newExcluded : [''] }));
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCruiseProduct(prev => ({ ...prev, excluded: [...prev.excluded, ''] }))}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                <Plus className="w-5 h-5" />
                불포함사항 추가
              </button>
            </div>
          </div>

          {/* 기항지 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">기항지</label>
            <div className="space-y-3">
              {cruiseProduct.ports.map((port, idx) => (
                <div key={idx} className="grid md:grid-cols-2 gap-3 items-center">
                  <select
                    value={port.country}
                    onChange={(e) => {
                      const newPorts = [...cruiseProduct.ports];
                      newPorts[idx] = { ...newPorts[idx], country: e.target.value, name: '' };
                      setCruiseProduct(prev => ({ ...prev, ports: newPorts }));
                    }}
                    className="rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">국가 선택</option>
                    {Object.keys(COUNTRIES_CITIES).map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-3">
                    <select
                      value={port.name}
                      onChange={(e) => {
                        const newPorts = [...cruiseProduct.ports];
                        newPorts[idx] = { ...newPorts[idx], name: e.target.value };
                        setCruiseProduct(prev => ({ ...prev, ports: newPorts }));
                      }}
                      className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      disabled={!port.country}
                    >
                      <option value="">도시 선택 또는 직접 입력</option>
                      {port.country && getCitiesByCountry(port.country).map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    {cruiseProduct.ports.length > 1 && (
                      <button
                        onClick={() => {
                          const newPorts = cruiseProduct.ports.filter((_, i) => i !== idx);
                          setCruiseProduct(prev => ({ ...prev, ports: newPorts.length ? newPorts : [{ name: '', country: '' }] }));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCruiseProduct(prev => ({ ...prev, ports: [...prev.ports, { name: '', country: '' }] }))}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                <Plus className="w-5 h-5" />
                기항지 추가
              </button>
            </div>
          </div>

          {/* 가이드 서비스 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">가이드 서비스</label>
            <input
              type="text"
              value={cruiseProduct.guideService}
              onChange={(e) => setCruiseProduct(prev => ({ ...prev, guideService: e.target.value }))}
              placeholder="예: 전문 한국어 가이드 상시 동행"
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 추가 서비스 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">추가 서비스</label>
            <textarea
              value={cruiseProduct.additionalServices}
              onChange={(e) => setCruiseProduct(prev => ({ ...prev, additionalServices: e.target.value }))}
              placeholder="예: 공항 픽업/드롭오프, 입국 서비스 지원"
              rows={3}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
            />
          </div>
        </div>
      </div>

      {/* 경쟁사 상품 입력 섹션 */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">경쟁사 상품 정보</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 상품명 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">상품명</label>
            <input
              type="text"
              value={competitor.productName}
              onChange={(e) => setCompetitor(prev => ({ ...prev, productName: e.target.value }))}
              placeholder="상품명 입력"
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* 가격 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">가격</label>
            <input
              type="text"
              value={competitor.priceDisplay}
              onChange={(e) => {
                const formatted = formatPrice(e.target.value);
                setCompetitor(prev => ({
                  ...prev,
                  price: formatted.num,
                  priceDisplay: formatted.display,
                }));
              }}
              placeholder="예: 3,500,000"
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg font-semibold focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* 일정 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">일정</label>
            <select
              value={`${competitor.nights}-${competitor.days}`}
              onChange={(e) => {
                const [nights, days] = e.target.value.split('-').map(Number);
                setCompetitor(prev => ({ ...prev, nights, days }));
              }}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={`${opt.nights}-${opt.days}`} value={`${opt.nights}-${opt.days}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 출발일 */}
          <div>
            <label className="block text-base font-bold text-gray-700 mb-3">출발일</label>
            <input
              type="date"
              value={competitor.departure}
              onChange={(e) => setCompetitor(prev => ({ ...prev, departure: e.target.value }))}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* 항공료/비행기/가이드/인솔자 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">포함 여부</label>
            <div className="flex flex-wrap gap-6 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={competitor.includesFlight}
                  onChange={(e) => setCompetitor(prev => ({ ...prev, includesFlight: e.target.checked }))}
                  className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
                />
                <span className="text-base font-semibold">항공료 포함</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={competitor.includesAirplane}
                  onChange={(e) => setCompetitor(prev => ({ ...prev, includesAirplane: e.target.checked }))}
                  className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
                />
                <span className="text-base font-semibold">비행기 포함</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={competitor.includesGuide}
                  onChange={(e) => setCompetitor(prev => ({ ...prev, includesGuide: e.target.checked }))}
                  className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
                />
                <span className="text-base font-semibold">가이드 포함</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={competitor.hasEscort}
                  onChange={(e) => setCompetitor(prev => ({ ...prev, hasEscort: e.target.checked }))}
                  className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
                />
                <span className="text-base font-semibold">인솔자 포함</span>
              </label>
            </div>
            {/* 포함여부 수동 입력 */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">포함여부 수동 등록</label>
              <input
                type="text"
                value={competitor.manualIncludedFeatures || ''}
                onChange={(e) => setCompetitor(prev => ({ ...prev, manualIncludedFeatures: e.target.value }))}
                placeholder="예: 크루즈닷 스탭 포함, 특별 할인 등"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
              />
            </div>
          </div>

          {/* 포함사항 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">
              포함사항 <span className="text-sm font-normal text-gray-500">(키워드 선택 또는 직접 입력, 클릭하여 수정 가능)</span>
            </label>
            <div className="space-y-3">
              {competitor.included.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      list={`included-keywords-${idx}`}
                      value={item}
                      onChange={(e) => {
                        const newIncluded = [...competitor.included];
                        newIncluded[idx] = e.target.value;
                        setCompetitor(prev => ({ ...prev, included: newIncluded }));
                      }}
                      placeholder="키워드 선택 또는 직접 입력 (클릭하여 수정 가능)"
                      className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 pr-10 cursor-text"
                    />
                    <datalist id={`included-keywords-${idx}`}>
                      {INCLUDED_KEYWORDS.map((keyword) => (
                        <option key={keyword} value={keyword} />
                      ))}
                    </datalist>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {competitor.included.length > 1 && (
                    <button
                      onClick={() => {
                        const newIncluded = competitor.included.filter((_, i) => i !== idx);
                        setCompetitor(prev => ({ ...prev, included: newIncluded.length ? newIncluded : [''] }));
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCompetitor(prev => ({ ...prev, included: [...prev.included, ''] }))}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Plus className="w-5 h-5" />
                포함사항 추가
              </button>
            </div>
          </div>

          {/* 불포함사항 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">
              불포함사항 <span className="text-sm font-normal text-gray-500">(키워드 선택 또는 직접 입력, 클릭하여 수정 가능)</span>
            </label>
            <div className="space-y-3">
              {competitor.excluded.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      list={`excluded-keywords-${idx}`}
                      value={item}
                      onChange={(e) => {
                        const newExcluded = [...competitor.excluded];
                        newExcluded[idx] = e.target.value;
                        setCompetitor(prev => ({ ...prev, excluded: newExcluded }));
                      }}
                      placeholder="키워드 선택 또는 직접 입력 (클릭하여 수정 가능)"
                      className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 pr-10 cursor-text"
                    />
                    <datalist id={`excluded-keywords-${idx}`}>
                      {EXCLUDED_KEYWORDS.map((keyword) => (
                        <option key={keyword} value={keyword} />
                      ))}
                    </datalist>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {competitor.excluded.length > 1 && (
                    <button
                      onClick={() => {
                        const newExcluded = competitor.excluded.filter((_, i) => i !== idx);
                        setCompetitor(prev => ({ ...prev, excluded: newExcluded.length ? newExcluded : [''] }));
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCompetitor(prev => ({ ...prev, excluded: [...prev.excluded, ''] }))}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Plus className="w-5 h-5" />
                불포함사항 추가
              </button>
            </div>
          </div>

          {/* 기항지 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">기항지</label>
            <div className="space-y-3">
              {competitor.ports.map((port, idx) => (
                <div key={idx} className="grid md:grid-cols-2 gap-3 items-center">
                  <select
                    value={port.country}
                    onChange={(e) => {
                      const newPorts = [...competitor.ports];
                      newPorts[idx] = { ...newPorts[idx], country: e.target.value, name: '' };
                      setCompetitor(prev => ({ ...prev, ports: newPorts }));
                    }}
                    className="rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
                  >
                    <option value="">국가 선택</option>
                    {Object.keys(COUNTRIES_CITIES).map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        list={`port-cities-${idx}`}
                        value={port.name}
                        onChange={(e) => {
                          const newPorts = [...competitor.ports];
                          newPorts[idx] = { ...newPorts[idx], name: e.target.value };
                          setCompetitor(prev => ({ ...prev, ports: newPorts }));
                        }}
                        placeholder="도시 선택 또는 직접 입력"
                        disabled={!port.country}
                        className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100 pr-10 disabled:bg-gray-100"
                      />
                      {port.country && (
                        <datalist id={`port-cities-${idx}`}>
                          {getCitiesByCountry(port.country).map((city) => (
                            <option key={city} value={city} />
                          ))}
                        </datalist>
                      )}
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {competitor.ports.length > 1 && (
                      <button
                        onClick={() => {
                          const newPorts = competitor.ports.filter((_, i) => i !== idx);
                          setCompetitor(prev => ({ ...prev, ports: newPorts.length ? newPorts : [{ name: '', country: '' }] }));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCompetitor(prev => ({ ...prev, ports: [...prev.ports, { name: '', country: '' }] }))}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Plus className="w-5 h-5" />
                기항지 추가
              </button>
            </div>
          </div>

          {/* 가이드 서비스 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">가이드 서비스</label>
            <input
              type="text"
              value={competitor.guideService}
              onChange={(e) => setCompetitor(prev => ({ ...prev, guideService: e.target.value }))}
              placeholder="예: 가이드 없음 또는 전문 한국어 가이드 상시 동행"
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
            />
          </div>

          {/* 추가 서비스 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">추가 서비스</label>
            <textarea
              value={competitor.additionalServices}
              onChange={(e) => setCompetitor(prev => ({ ...prev, additionalServices: e.target.value }))}
              placeholder="예: 공항 픽업/드롭오프, 입국 서비스 지원"
              rows={3}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100 resize-none"
            />
          </div>

          {/* 비고 */}
          <div className="md:col-span-2">
            <label className="block text-base font-bold text-gray-700 mb-3">비고</label>
            <textarea
              value={competitor.notes}
              onChange={(e) => setCompetitor(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="경쟁사 상품에 대한 추가 설명이나 조건 등을 입력하세요"
              rows={3}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100 resize-none"
            />
          </div>
        </div>
      </div>

      {/* 비교견적서 미리보기 */}
      {cruiseProduct.productName && cruiseProduct.price > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div
            ref={quoteRef}
            className="bg-white"
            style={{
              width: '794px', // A4 width in pixels (96 DPI)
              minHeight: '1123px', // A4 height in pixels (96 DPI)
              padding: '40px',
              boxSizing: 'border-box',
            }}
          >
            {/* 크루즈닷 로고 */}
            <div className="flex justify-center mb-8">
              <Image
                src="/images/ai-cruise-logo.png"
                alt="크루즈닷 로고"
                width={120}
                height={48}
                priority
                className="object-contain"
              />
            </div>

            {/* VS 헤더 */}
            <div className="flex flex-col items-center justify-center mb-10 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-300"></div>
              </div>
              <div className="relative bg-white px-8 flex flex-col items-center">
                <div className="text-5xl font-extrabold text-indigo-600">VS</div>
                <div className="text-lg text-gray-600 mt-3 font-semibold">
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            {/* 좌우 비교 레이아웃 */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* 왼쪽: 크루즈닷 */}
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-xl border-3 border-indigo-500 p-6">
                <div className="mb-5">
                  <div className="inline-block bg-indigo-600 text-white px-5 py-2.5 rounded-full text-base font-bold">
                    크루즈닷
                  </div>
                </div>

                {/* 블록1: 기본정보 */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{cruiseProduct.productName}</h3>
                  <div className="text-3xl font-extrabold text-indigo-700 mb-4">
                    {cruiseProduct.priceDisplay}원
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {cruiseProduct.includesFlight ? (
                      <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 항공료 포함
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✗ 항공료 없음
                      </span>
                    )}
                    {cruiseProduct.includesAirplane ? (
                      <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 비행기 포함
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✗ 비행기 없음
                      </span>
                    )}
                    {cruiseProduct.includesGuide ? (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 가이드 포함
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✗ 가이드 없음
                      </span>
                    )}
                    {cruiseProduct.hasEscort && (
                      <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 인솔자 포함
                      </span>
                    )}
                    {cruiseProduct.hasCruisedotStaff && (
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1">
                        ✓ 크루즈닷 스탭 포함
                        <Image src="/images/ai-cruise-logo.png" alt="크루즈닷" width={14} height={5} className="inline" />
                      </span>
                    )}
                  </div>
                  <div className="text-base text-gray-700 space-y-1.5">
                    <div className="font-semibold">일정: {cruiseProduct.nights}박 {cruiseProduct.days}일</div>
                    {cruiseProduct.departure && (
                      <div className="font-semibold">출발일: {formatDate(cruiseProduct.departure)}</div>
                    )}
                  </div>
                </div>

                {/* 블록2: 포함/불포함 */}
                <div className="mb-6 space-y-5">
                  {cruiseProduct.included.filter(item => item.trim()).length > 0 && (
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2.5 flex items-center">
                        <Check className="w-4 h-4 text-green-600 mr-2" />
                        포함사항
                      </h4>
                      <ul className="space-y-1.5 text-sm text-gray-700">
                        {cruiseProduct.included.filter(item => item.trim()).map((item, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-green-600 mr-2 text-base">✓</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cruiseProduct.excluded.filter(item => item.trim()).length > 0 && (
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2.5 flex items-center">
                        <X className="w-4 h-4 text-red-600 mr-2" />
                        불포함사항
                      </h4>
                      <ul className="space-y-1.5 text-sm text-gray-700">
                        {cruiseProduct.excluded.filter(item => item.trim()).map((item, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-red-600 mr-2 text-base">✗</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 블록3: 기항지/가이드/서비스 */}
                <div className="space-y-4">
                  {cruiseProduct.ports.filter(p => p.name && p.country).length > 0 && (
                    <div className="bg-white/70 rounded-lg p-4">
                      <h4 className="text-base font-bold text-gray-900 mb-3">기항지</h4>
                      <div className="space-y-2 text-base text-gray-700">
                        {cruiseProduct.ports.filter(p => p.name && p.country).map((port, idx) => (
                          <div key={idx}>
                            {port.name}, {port.country}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {cruiseProduct.guideService && (
                    <div className="bg-white/70 rounded-lg p-4">
                      <h4 className="text-base font-bold text-gray-900 mb-2">가이드 서비스</h4>
                      <p className="text-base text-gray-700">{cruiseProduct.guideService}</p>
                    </div>
                  )}
                  {cruiseProduct.additionalServices && (
                    <div className="bg-white/70 rounded-lg p-4">
                      <h4 className="text-base font-bold text-gray-900 mb-2">추가 서비스</h4>
                      <p className="text-base text-gray-700">{cruiseProduct.additionalServices}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽: 경쟁사 */}
              <div className="bg-gray-100 rounded-xl border-2 border-gray-300 p-6">
                <div className="mb-5">
                  <div className="inline-block bg-gray-600 text-white px-5 py-2.5 rounded-full text-base font-bold">
                    경쟁사
                  </div>
                </div>

                {/* 블록1: 기본정보 */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                    {competitor.productName || '상품명 입력'}
                  </h3>
                  {competitor.price > 0 && (
                    <div className="text-3xl font-extrabold text-gray-900 mb-4">
                      {competitor.priceDisplay}원
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {competitor.includesFlight ? (
                      <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 항공료 포함
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✗ 항공료 없음
                      </span>
                    )}
                    {competitor.includesAirplane ? (
                      <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 비행기 포함
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✗ 비행기 없음
                      </span>
                    )}
                    {competitor.includesGuide ? (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 가이드 포함
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✗ 가이드 없음
                      </span>
                    )}
                    {competitor.hasEscort ? (
                      <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✓ 인솔자 포함
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        ✗ 인솔자 없음
                      </span>
                    )}
                    {competitor.manualIncludedFeatures && (
                      <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        {competitor.manualIncludedFeatures}
                      </span>
                    )}
                  </div>
                  {competitor.notes && (
                    <div className="mt-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-xs font-semibold text-yellow-800 mb-1">비고</div>
                      <div className="text-xs text-yellow-700">{competitor.notes}</div>
                    </div>
                  )}
                  {competitor.nights > 0 && (
                    <div className="text-base text-gray-700 space-y-1.5">
                      <div className="font-semibold">일정: {competitor.nights}박 {competitor.days}일</div>
                      {competitor.departure && (
                        <div className="font-semibold">출발일: {formatDate(competitor.departure)}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 블록2: 포함/불포함 */}
                <div className="mb-6 space-y-5">
                  {competitor.included.filter(item => item.trim()).length > 0 && (
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2.5 flex items-center">
                        <Check className="w-4 h-4 text-green-600 mr-2" />
                        포함사항
                      </h4>
                      <ul className="space-y-1.5 text-sm text-gray-700">
                        {competitor.included.filter(item => item.trim()).map((item, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-green-600 mr-2 text-base">✓</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {competitor.excluded.filter(item => item.trim()).length > 0 && (
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2.5 flex items-center">
                        <X className="w-4 h-4 text-red-600 mr-2" />
                        불포함사항
                      </h4>
                      <ul className="space-y-1.5 text-sm text-gray-700">
                        {competitor.excluded.filter(item => item.trim()).map((item, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-red-600 mr-2 text-base">✗</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 블록3: 기항지/가이드/서비스 */}
                <div className="space-y-4">
                  {competitor.ports.filter(p => p.name && p.country).length > 0 && (
                    <div className="bg-white/70 rounded-lg p-4">
                      <h4 className="text-base font-bold text-gray-900 mb-3">기항지</h4>
                      <div className="space-y-2 text-base text-gray-700">
                        {competitor.ports.filter(p => p.name && p.country).map((port, idx) => (
                          <div key={idx}>
                            {port.name}, {port.country}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {competitor.guideService && (
                    <div className="bg-white/70 rounded-lg p-4">
                      <h4 className="text-base font-bold text-gray-900 mb-2">가이드 서비스</h4>
                      <p className="text-base text-gray-700">{competitor.guideService}</p>
                    </div>
                  )}
                  {competitor.additionalServices && (
                    <div className="bg-white/70 rounded-lg p-4">
                      <h4 className="text-base font-bold text-gray-900 mb-2">추가 서비스</h4>
                      <p className="text-base text-gray-700">{competitor.additionalServices}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-md">
                <label className="block text-base font-bold text-gray-700 mb-2">
                  고객 이메일 주소
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleDownloadImage}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-4 text-base font-bold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  {isDownloading ? '저장 중...' : '이미지 저장 (PNG)'}
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-8 py-4 text-base font-bold text-white hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  {isSendingEmail ? '전송 중...' : '이메일 발송'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b-2 border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">비교견적서 미리보기 (A4 사이즈)</h2>
              <button
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setPreviewImageUrl('');
                }}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 flex justify-center items-center min-h-[80vh]">
              {previewImageUrl ? (
                <div className="flex justify-center items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewImageUrl}
                    alt="비교견적서 미리보기"
                    className="max-w-full h-auto rounded-lg shadow-2xl border-4 border-gray-200"
                    style={{ maxHeight: '85vh' }}
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">이미지를 생성하는 중...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}