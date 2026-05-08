'use client';

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Mail, Check, X } from 'lucide-react';
import { showSuccess, showError } from '@/components/ui/Toast';

// 크루즈닷 예시 상품 데이터
const SAMPLE_PRODUCTS = [
  {
    id: '1',
    name: '지중해 7박 8일 크루즈',
    price: 3500000,
    duration: '7박 8일',
    departure: '2024-06-15',
    includesFlight: true,
    includesGuide: true,
    included: [
      '크루즈 선박 숙박 (베란다 캐빈)',
      '항공료 (경유 포함)',
      '전일정 전문 가이드',
      '일일 3식 (양식/한식 버퍼)',
      '유럽 4개 도시 기항',
      'Wi-Fi (객실당 1개)',
      '선박 내 엔터테인먼트',
    ],
    excluded: [
      '개인 소비품',
      '선택 투어',
      '여행자 보험',
    ],
    ports: [
      { name: '바르셀로나', country: '스페인' },
      { name: '마르세유', country: '프랑스' },
      { name: '제노바', country: '이탈리아' },
      { name: '발렌시아', country: '스페인' },
    ],
    guideService: '전문 한국어 가이드 상시 동행',
    additionalServices: '공항 픽업/드롭오프, 입국 서비스 지원',
  },
  {
    id: '2',
    name: '알래스카 크루즈 9박 10일',
    price: 5200000,
    duration: '9박 10일',
    departure: '2024-07-20',
    includesFlight: true,
    includesGuide: true,
    included: [
      '크루즈 선박 숙박 (오션뷰 캐빈)',
      '항공료 (시애틀 경유)',
      '전문 자연 가이드',
      '일일 3식 + 스낵바',
      '알래스카 5개 항구 기항',
      '빙하 투어 포함',
      '선박 내 스파 이용권',
    ],
    excluded: [
      '개인 소비품',
      '헬리콥터 투어',
      '낚시 투어',
    ],
    ports: [
      { name: '앵커리지', country: '미국' },
      { name: '주노', country: '미국' },
      { name: '스키어웨이', country: '캐나다' },
      { name: '켓치칸', country: '미국' },
      { name: '빅토리아', country: '캐나다' },
    ],
    guideService: '자연 생태 전문 가이드 동행',
    additionalServices: '항공 수하물 서비스, 빙하 투어 가이드',
  },
  {
    id: '3',
    name: '동남아시아 크루즈 5박 6일',
    price: 2800000,
    duration: '5박 6일',
    departure: '2024-08-10',
    includesFlight: true,
    includesGuide: true,
    included: [
      '크루즈 선박 숙박 (인사이드 캐빈)',
      '항공료 (직항)',
      '현지 한국어 가이드',
      '일일 3식 (한식/중식 버퍼)',
      '동남아 3개국 기항',
      '해양 스포츠 체험',
      '선박 내 쇼핑몰 할인권',
    ],
    excluded: [
      '비자 수수료',
      '개인 소비품',
      '선택 투어',
    ],
    ports: [
      { name: '싱가포르', country: '싱가포르' },
      { name: '페낭', country: '말레이시아' },
      { name: '피피섬', country: '태국' },
    ],
    guideService: '현지 한국어 가이드 동행',
    additionalServices: '비자 서비스, 공항 픽업',
  },
];

interface CompetitorProduct {
  companyName: string;
  productName: string;
  price: number;
  duration: string;
  departure: string;
  includesFlight: boolean;
  includesGuide: boolean;
  included: string[];
  excluded: string[];
  ports: Array<{ name: string; country: string }>;
  guideService: string;
  additionalServices: string;
}

export default function ComparativeQuote() {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  
  const quoteRef = useRef<HTMLDivElement>(null);

  // 선택된 상품 정보
  const selectedProduct = SAMPLE_PRODUCTS.find(p => p.id === selectedProductId);

  // 경쟁사 상품 데이터
  const [competitor, setCompetitor] = useState<CompetitorProduct>({
    companyName: '',
    productName: '',
    price: 0,
    duration: '',
    departure: '',
    includesFlight: false,
    includesGuide: false,
    included: [''],
    excluded: [''],
    ports: [{ name: '', country: '' }],
    guideService: '',
    additionalServices: '',
  });

  // 상품 선택 시 자동 채움
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = SAMPLE_PRODUCTS.find(p => p.id === productId);
    if (product) {
      // 크루즈닷 상품은 자동으로 채워지므로 별도 설정 불필요
    }
  };

  // 경쟁사 포함 항목 추가/삭제
  const addIncludedItem = () => {
    setCompetitor(prev => ({
      ...prev,
      included: [...prev.included, ''],
    }));
  };

  const removeIncludedItem = (index: number) => {
    setCompetitor(prev => ({
      ...prev,
      included: prev.included.filter((_, i) => i !== index),
    }));
  };

  const updateIncludedItem = (index: number, value: string) => {
    setCompetitor(prev => ({
      ...prev,
      included: prev.included.map((item, i) => i === index ? value : item),
    }));
  };

  // 경쟁사 불포함 항목 추가/삭제
  const addExcludedItem = () => {
    setCompetitor(prev => ({
      ...prev,
      excluded: [...prev.excluded, ''],
    }));
  };

  const removeExcludedItem = (index: number) => {
    setCompetitor(prev => ({
      ...prev,
      excluded: prev.excluded.filter((_, i) => i !== index),
    }));
  };

  const updateExcludedItem = (index: number, value: string) => {
    setCompetitor(prev => ({
      ...prev,
      excluded: prev.excluded.map((item, i) => i === index ? value : item),
    }));
  };

  // 경쟁사 기항지 추가/삭제
  const addPort = () => {
    setCompetitor(prev => ({
      ...prev,
      ports: [...prev.ports, { name: '', country: '' }],
    }));
  };

  const removePort = (index: number) => {
    setCompetitor(prev => ({
      ...prev,
      ports: prev.ports.filter((_, i) => i !== index),
    }));
  };

  const updatePort = (index: number, field: 'name' | 'country', value: string) => {
    setCompetitor(prev => ({
      ...prev,
      ports: prev.ports.map((port, i) => i === index ? { ...port, [field]: value } : port),
    }));
  };

  // 이미지 저장 (PNG)
  const handleDownloadImage = async () => {
    if (!quoteRef.current) {
      showError('견적서를 찾을 수 없습니다.');
      return;
    }

    if (!selectedProduct) {
      showError('크루즈닷 상품을 선택해주세요.');
      return;
    }

    try {
      setIsDownloading(true);
      
      const canvas = await html2canvas(quoteRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const fileName = `비교견적서_${selectedProduct.name}_${new Date().toISOString().split('T')[0]}.png`;
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('견적서 이미지가 다운로드되었습니다.');
    } catch (error: any) {
      console.error('[Download Image] Error:', error);
      showError('이미지 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 이메일 발송
  const handleSendEmail = async () => {
    if (!selectedProduct) {
      showError('크루즈닷 상품을 선택해주세요.');
      return;
    }

    if (!customerEmail.trim()) {
      showError('고객 이메일 주소를 입력해주세요.');
      return;
    }

    try {
      setIsSendingEmail(true);
      
      // TODO: 이메일 발송 API 구현 필요
      // 현재는 이미지 다운로드 후 안내 메시지만 표시
      await handleDownloadImage();
      
      showSuccess(`견적서 이미지가 다운로드되었습니다. ${customerEmail}로 발송 기능은 구현 예정입니다.`);
      
    } catch (error: any) {
      console.error('[Send Email] Error:', error);
      showError('이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상품 선택 및 입력 섹션 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">상품 선택 및 입력</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* 크루즈닷 상품 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              크루즈닷 상품 선택
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">상품을 선택하세요</option>
              {SAMPLE_PRODUCTS.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.price.toLocaleString()}원)
                </option>
              ))}
            </select>
          </div>

          {/* 경쟁사 회사명 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              경쟁사 회사명
            </label>
            <input
              type="text"
              value={competitor.companyName}
              onChange={(e) => setCompetitor(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="예: ○○여행사"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-100"
            />
          </div>
        </div>
      </div>

      {/* 비교견적서 미리보기 */}
      {selectedProduct && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div ref={quoteRef} className="bg-white">
            {/* VS 헤더 */}
            <div className="flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative bg-white px-8">
                <div className="text-6xl font-extrabold text-indigo-600">VS</div>
              </div>
            </div>

            {/* 좌우 비교 레이아웃 */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* 왼쪽: 크루즈닷 */}
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-lg border-2 border-indigo-500 p-6">
                <div className="mb-4">
                  <div className="inline-block bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold mb-2">
                    크루즈닷
                  </div>
                </div>

                {/* 블록1: 기본정보 */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{selectedProduct.name}</h3>
                  <div className="text-3xl font-extrabold text-indigo-700 mb-3">
                    {selectedProduct.price.toLocaleString()}원
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedProduct.includesFlight && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                        ✓ 항공료 포함
                      </span>
                    )}
                    {selectedProduct.includesGuide && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                        ✓ 가이드 포함
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>일정: {selectedProduct.duration}</div>
                    <div>출발일: {selectedProduct.departure}</div>
                  </div>
                </div>

                {/* 블록2: 포함/불포함 */}
                <div className="mb-6 space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Check className="w-4 h-4 text-green-600 mr-1" />
                      포함사항
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                      {selectedProduct.included.map((item, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <X className="w-4 h-4 text-red-600 mr-1" />
                      불포함사항
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                      {selectedProduct.excluded.map((item, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-red-600 mr-2">✗</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 블록3: 기항지/가이드/서비스 */}
                <div className="space-y-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm">기항지</h4>
                    <div className="space-y-1 text-sm text-gray-700">
                      {selectedProduct.ports.map((port, idx) => (
                        <div key={idx}>
                          {port.name}, {port.country}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm">가이드 서비스</h4>
                    <p className="text-sm text-gray-700">{selectedProduct.guideService}</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm">추가 서비스</h4>
                    <p className="text-sm text-gray-700">{selectedProduct.additionalServices}</p>
                  </div>
                </div>
              </div>

              {/* 오른쪽: 경쟁사 */}
              <div className="bg-gray-100 rounded-lg border border-gray-300 p-6">
                <div className="mb-4">
                  <div className="inline-block bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-bold mb-2">
                    {competitor.companyName || '경쟁사'}
                  </div>
                </div>

                {/* 블록1: 기본정보 */}
                <div className="mb-6">
                  <input
                    type="text"
                    value={competitor.productName}
                    onChange={(e) => setCompetitor(prev => ({ ...prev, productName: e.target.value }))}
                    placeholder="상품명 입력"
                    className="text-lg font-bold text-gray-900 mb-2 w-full bg-transparent border-b border-gray-400 pb-1 focus:outline-none focus:border-gray-600"
                  />
                  <input
                    type="number"
                    value={competitor.price || ''}
                    onChange={(e) => setCompetitor(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                    placeholder="가격 입력"
                    className="text-3xl font-extrabold text-gray-900 mb-3 w-full bg-transparent border-b border-gray-400 pb-1 focus:outline-none focus:border-gray-600"
                  />
                  <div className="flex flex-wrap gap-2 mb-3">
                    <label className="flex items-center text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={competitor.includesFlight}
                        onChange={(e) => setCompetitor(prev => ({ ...prev, includesFlight: e.target.checked }))}
                        className="mr-1"
                      />
                      항공료 포함
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={competitor.includesGuide}
                        onChange={(e) => setCompetitor(prev => ({ ...prev, includesGuide: e.target.checked }))}
                        className="mr-1"
                      />
                      가이드 포함
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <input
                      type="text"
                      value={competitor.duration}
                      onChange={(e) => setCompetitor(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="일정 (예: 7박 8일)"
                      className="bg-transparent border-b border-gray-400 pb-1 focus:outline-none focus:border-gray-600"
                    />
                    <input
                      type="text"
                      value={competitor.departure}
                      onChange={(e) => setCompetitor(prev => ({ ...prev, departure: e.target.value }))}
                      placeholder="출발일"
                      className="bg-transparent border-b border-gray-400 pb-1 focus:outline-none focus:border-gray-600"
                    />
                  </div>
                </div>

                {/* 블록2: 포함/불포함 */}
                <div className="mb-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 flex items-center">
                        <Check className="w-4 h-4 text-green-600 mr-1" />
                        포함사항
                      </h4>
                      <button
                        onClick={addIncludedItem}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        + 추가
                      </button>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {competitor.included.map((item, idx) => (
                        <li key={idx} className="flex items-start">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => updateIncludedItem(idx, e.target.value)}
                            placeholder="포함사항 입력"
                            className="flex-1 bg-transparent border-b border-gray-400 pb-1 text-gray-700 focus:outline-none focus:border-gray-600"
                          />
                          {competitor.included.length > 1 && (
                            <button
                              onClick={() => removeIncludedItem(idx)}
                              className="ml-2 text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 flex items-center">
                        <X className="w-4 h-4 text-red-600 mr-1" />
                        불포함사항
                      </h4>
                      <button
                        onClick={addExcludedItem}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        + 추가
                      </button>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {competitor.excluded.map((item, idx) => (
                        <li key={idx} className="flex items-start">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => updateExcludedItem(idx, e.target.value)}
                            placeholder="불포함사항 입력"
                            className="flex-1 bg-transparent border-b border-gray-400 pb-1 text-gray-700 focus:outline-none focus:border-gray-600"
                          />
                          {competitor.excluded.length > 1 && (
                            <button
                              onClick={() => removeExcludedItem(idx)}
                              className="ml-2 text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 블록3: 기항지/가이드/서비스 */}
                <div className="space-y-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm">기항지</h4>
                      <button
                        onClick={addPort}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        + 추가
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      {competitor.ports.map((port, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={port.name}
                            onChange={(e) => updatePort(idx, 'name', e.target.value)}
                            placeholder="도시명"
                            className="flex-1 bg-transparent border-b border-gray-400 pb-1 text-gray-700 focus:outline-none focus:border-gray-600"
                          />
                          <input
                            type="text"
                            value={port.country}
                            onChange={(e) => updatePort(idx, 'country', e.target.value)}
                            placeholder="국가"
                            className="flex-1 bg-transparent border-b border-gray-400 pb-1 text-gray-700 focus:outline-none focus:border-gray-600"
                          />
                          {competitor.ports.length > 1 && (
                            <button
                              onClick={() => removePort(idx)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm">가이드 서비스</h4>
                    <textarea
                      value={competitor.guideService}
                      onChange={(e) => setCompetitor(prev => ({ ...prev, guideService: e.target.value }))}
                      placeholder="가이드 서비스 입력"
                      className="w-full bg-transparent border-b border-gray-400 pb-1 text-sm text-gray-700 focus:outline-none focus:border-gray-600 resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm">추가 서비스</h4>
                    <textarea
                      value={competitor.additionalServices}
                      onChange={(e) => setCompetitor(prev => ({ ...prev, additionalServices: e.target.value }))}
                      placeholder="추가 서비스 입력"
                      className="w-full bg-transparent border-b border-gray-400 pb-1 text-sm text-gray-700 focus:outline-none focus:border-gray-600 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                고객 이메일 주소
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDownloadImage}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                {isDownloading ? '저장 중...' : '이미지 저장 (PNG)'}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSendingEmail || !customerEmail.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {isSendingEmail ? '발송 중...' : '이메일 발송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

