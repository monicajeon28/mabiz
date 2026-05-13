'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiCreditCard, FiUser, FiMail, FiPhone, FiMinus, FiPlus, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Image from 'next/image';
import { normalizeProductCode } from '@/lib/utils/normalize-product-code';
import { csrfFetch } from '@/lib/csrf-client';

interface PricingRow {
  id?: string;
  roomType: string;
  adult: number; // 1,2번째 성인
  adult3rd?: number; // 만 12세 이상
  child2to11?: number; // 만 2-11세
  infantUnder2?: number; // 만 2세 미만
}

interface RoomSelection {
  roomType: string;
  adult: number; // 1,2번째 성인 수
  adult3rd: number; // 만 12세 이상 수
  child2to11: number; // 만 2-11세 수
  infantUnder2: number; // 만 2세 미만 수
}

interface SoldOutRoom {
  roomId: string;
  roomType: string;
  soldOutAt: string;
  soldOutBy: string;
}

interface PaymentPageProps {
  productCode: string;
  productName: string;
  pricingRows: PricingRow[];
  chatSessionId?: string;
  partnerId?: string; // URL의 partner 파라미터 (최우선 사용)
}

interface PublicProductDetail {
  productCode: string;
  cruiseLine: string | null;
  shipName: string | null;
  packageName: string | null;
  nights: number | null;
  days: number | null;
  basePrice: number | null;
  source: string | null;
  itineraryPattern: any;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  tripCount: number;
  MallProductContent?: {
    thumbnail?: string | null;
    images?: string[] | null;
    videos?: string[] | null;
    layout?: any;
  } | null;
}

export default function PaymentPage({ productCode, productName, pricingRows, chatSessionId, partnerId: partnerIdFromProps }: PaymentPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // URL의 partner 파라미터를 최우선으로 사용 (정확한 판매원 추적)
  // props로 전달된 partnerId가 있으면 우선 사용, 없으면 URL 파라미터에서 읽기
  const partnerIdFromUrl = searchParams.get('partner');
  const partnerId = partnerIdFromProps || partnerIdFromUrl || null;
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [roomSelections, setRoomSelections] = useState<RoomSelection[]>([]);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [productDetail, setProductDetail] = useState<PublicProductDetail | null>(null);
  const [isProductDetailLoading, setIsProductDetailLoading] = useState(false);
  const [productDetailError, setProductDetailError] = useState<string | null>(null);

  // SOLD OUT 상태
  const [soldOutRooms, setSoldOutRooms] = useState<SoldOutRoom[]>([]);

  // SOLD OUT 상태 조회
  useEffect(() => {
    const fetchSoldOutStatus = async () => {
      try {
        const normalizedCode = normalizeProductCode(productCode);
        const url = `/api/admin/products/${normalizedCode}/soldout`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`[SOLD OUT] Request failed - URL: ${url}, Status: ${res.status}, Original: "${productCode}", Normalized: "${normalizedCode}"`);
        }
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.soldOutRooms) {
            setSoldOutRooms(data.soldOutRooms);
          }
        }
      } catch (error) {
        console.error('[SOLD OUT] Fetch error:', error, 'ProductCode:', productCode);
      }
    };
    fetchSoldOutStatus();
  }, [productCode]);

  // 특정 객실이 SOLD OUT인지 확인
  const isRoomSoldOut = (roomId: string) => {
    return soldOutRooms.some(r => r.roomId === roomId);
  };

  const [formData, setFormData] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerTel: '',
  });

  // 초기화: 요금표를 기반으로 방 선택 초기화
  useEffect(() => {
    if (pricingRows && pricingRows.length > 0) {
      const initialSelections = pricingRows.map((row) => ({
        roomType: row.roomType,
        adult: 0,
        adult3rd: 0,
        child2to11: 0,
        infantUnder2: 0,
      }));
      setRoomSelections(initialSelections);
    }
  }, [pricingRows]);

  // 로그인한 사용자 정보 가져오기 (크루즈몰 회원인 경우)
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.user) {
            // 크루즈몰 회원(role: 'community')인 경우에만 자동 입력
            if (data.user.role === 'community') {
              setFormData({
                buyerName: '', // 이름은 본인확인으로 입력
                buyerEmail: data.user.email || '',
                buyerTel: data.user.phone || '',
              });
            }
          }
        }
      } catch {
        // 사용자 정보 로드 실패 시 빈 폼으로 진행
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUserInfo();
  }, []);

  // 카운터 증가/감소 함수
  const updateCounter = (index: number, field: keyof RoomSelection, delta: number) => {
    const newSelections = [...roomSelections];
    const currentValue = newSelections[index][field] as number;
    const newValue = Math.max(0, currentValue + delta);
    newSelections[index] = {
      ...newSelections[index],
      [field]: newValue,
    } as RoomSelection;
    setRoomSelections(newSelections);
  };

  // 총 금액 계산
  const calculateTotal = (): number => {
    let total = 0;
    roomSelections.forEach((selection, index) => {
      const pricingRow = pricingRows[index];
      if (pricingRow) {
        total += (selection.adult * (pricingRow.adult || 0));
        total += (selection.adult3rd * (pricingRow.adult3rd || 0));
        total += (selection.child2to11 * (pricingRow.child2to11 || 0));
        total += (selection.infantUnder2 * (pricingRow.infantUnder2 || 0));
      }
    });
    return total;
  };

  // 총 인원 수 계산
  const calculateTotalGuests = (): number => {
    return roomSelections.reduce((sum, selection) => {
      return sum + selection.adult + selection.adult3rd + selection.child2to11 + selection.infantUnder2;
    }, 0);
  };

  // 가격 포맷팅 (천원 단위 또는 만원 단위로 표시)
  const formatPrice = (price: number | undefined) => {
    if (!price) return '-';
    // 만원 단위로 나누어떨어지면 만원 단위로 표시
    if (price % 10000 === 0) {
      const manwon = Math.floor(price / 10000);
      return `${manwon.toLocaleString()}만원`;
    }
    // 천원 단위로 나누어떨어지면 천원 단위로 표시
    if (price % 1000 === 0) {
      const cheonwon = Math.floor(price / 1000);
      return `${cheonwon.toLocaleString()}천원`;
    }
    // 그 외는 원 단위로 표시
    return `${price.toLocaleString()}원`;
  };

  // 결제 가능 여부 확인
  const canProceed = (): boolean => {
    return (
      isVerified &&
      formData.buyerName.trim().length > 0 &&
      formData.buyerTel.trim().length > 0 &&
      calculateTotalGuests() > 0 &&
      calculateTotal() > 0
    );
  };

  const totalAmount = calculateTotal();
  const totalGuests = calculateTotalGuests();

  const productLayoutData = useMemo<Record<string, any> | null>(() => {
    if (!productDetail?.MallProductContent?.layout) {
      return null;
    }

    const layout = productDetail.MallProductContent.layout;
    if (typeof layout === 'string') {
      try {
        return JSON.parse(layout);
      } catch {
        return null;
      }
    }

    return layout;
  }, [productDetail]);

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-gray-600">사용자 정보를 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 유효성 검사
    if (!canProceed()) {
      alert('필수 정보(이름, 연락처)를 입력하고 객실을 선택해주세요.');
      return;
    }

    setIsProcessing(true);

    try {
      // 2. 데이터 정제 (PG사 오류 방지)
      const cleanProductName = (productName || "여행상품").replace(/[<>"'&]/g, "").substring(0, 80);
      const finalPrice = totalAmount > 0 ? totalAmount : 1000; // 0원 방지

      // 3. 파트너 ID 확보 (URL 파라미터 > Props)
      const currentParams = new URLSearchParams(window.location.search);
      const finalPartnerId = partnerId || currentParams.get('partner') || '';

      // 4. /api/payment/request 호출하여 DB에 Payment 레코드 생성
      const response = await csrfFetch('/api/payment/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: productCode || '',
          productName: cleanProductName,
          amount: finalPrice,
          buyerName: formData.buyerName,
          buyerEmail: formData.buyerEmail || '',
          buyerTel: formData.buyerTel.replace(/-/g, ''),
          roomSelections: roomSelections.filter(s => s.adult > 0 || s.adult3rd > 0 || s.child2to11 > 0 || s.infantUnder2 > 0),
          chatSessionId: chatSessionId || null,
          partnerId: finalPartnerId,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || '결제 요청 생성 실패');
      }

      // 5. checkout 페이지로 이동 (DB에 저장된 orderId 사용)
      const query = new URLSearchParams({
        orderId: data.orderId,
        goodname: encodeURIComponent(cleanProductName),
        price: String(finalPrice),
        buyername: encodeURIComponent(formData.buyerName),
        buyertel: formData.buyerTel.replace(/-/g, ''),
        buyeremail: formData.buyerEmail || 'no-email@cruisedot.co.kr',
        partnerId: finalPartnerId,
        productCode: productCode || ''
      });

      router.push(`/payment/checkout?${query.toString()}`);

    } catch (error) {
      alert(error instanceof Error ? error.message : '결제 페이지 이동 실패');
      setIsProcessing(false);
    }
  };

  const openProductDetail = async () => {
    setShowProductDetail(true);
    if (productDetail || isProductDetailLoading) {
      return;
    }

    setIsProductDetailLoading(true);
    setProductDetailError(null);
    try {
      const response = await fetch(`/api/public/products/${productCode}`);
      if (!response.ok) {
        throw new Error('상품 정보를 불러오는 데 실패했습니다.');
      }
      const data = await response.json();
      if (!data.ok || !data.product) {
        throw new Error(data.error || '상품 정보를 찾을 수 없습니다.');
      }
      setProductDetail(data.product as PublicProductDetail);
    } catch (error) {
      setProductDetailError(error instanceof Error ? error.message : '상품 정보를 불러올 수 없습니다.');
    } finally {
      setIsProductDetailLoading(false);
    }
  };

  const closeProductDetail = () => {
    setShowProductDetail(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">결제하기</h1>
          <p className="text-gray-600 text-lg">상품 정보를 확인하고 결제를 진행해주세요.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 요금표 및 방 선택 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 상품 정보 */}
            <button
              type="button"
              onClick={openProductDetail}
              className="w-full text-left bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200 hover:border-blue-400 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">상품 정보</h2>
                <span className="text-sm font-semibold text-blue-600">상세보기</span>
              </div>
              <div className="text-lg font-semibold text-gray-800">{productName}</div>
              <p className="mt-2 text-sm text-gray-500">클릭하면 상품 상세 정보를 팝업으로 확인할 수 있습니다.</p>
            </button>

            {/* 요금표 및 방 선택 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">객실 선택</h2>

              {pricingRows && pricingRows.length > 0 ? (
                <div className="space-y-6">
                  {pricingRows.map((row, index) => {
                    const selection = roomSelections[index];
                    if (!selection) return null;

                    const roomId = row.id || `room-${index}`;
                    const isSoldOut = isRoomSoldOut(roomId);

                    const roomTotal =
                      (selection.adult * (row.adult || 0)) +
                      (selection.adult3rd * (row.adult3rd || 0)) +
                      (selection.child2to11 * (row.child2to11 || 0)) +
                      (selection.infantUnder2 * (row.infantUnder2 || 0));

                    // SOLD OUT 객실인 경우 별도 UI 표시
                    if (isSoldOut) {
                      return (
                        <div key={roomId} className="border-2 border-gray-300 rounded-lg p-6 bg-gray-100 opacity-70">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-500 line-through">{row.roomType}</h3>
                            <span className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg">
                              <FiAlertCircle size={20} />
                              SOLD OUT
                            </span>
                          </div>
                          <p className="mt-4 text-gray-500 text-center">이 객실은 현재 예약이 마감되었습니다.</p>
                        </div>
                      );
                    }

                    return (
                      <div key={roomId} className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-400 transition-colors">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">{row.roomType}</h3>

                        <div className="space-y-4">
                          {/* 1,2번째 성인 */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm text-gray-600 mb-1">1,2번째 성인</div>
                              <div className="text-lg font-semibold text-red-600">
                                {formatPrice(row.adult)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => updateCounter(index, 'adult', -1)}
                                disabled={selection.adult === 0}
                                className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <FiMinus size={20} />
                              </button>
                              <span className="text-2xl font-bold text-gray-900 w-12 text-center">
                                {selection.adult}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCounter(index, 'adult', 1)}
                                className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors"
                              >
                                <FiPlus size={20} />
                              </button>
                            </div>
                          </div>

                          {/* 만 12세 이상 */}
                          {row.adult3rd && (
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                              <div className="flex-1">
                                <div className="text-sm text-gray-600 mb-1">만 12세 이상</div>
                                <div className="text-lg font-semibold text-gray-700">
                                  {formatPrice(row.adult3rd)}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => updateCounter(index, 'adult3rd', -1)}
                                  disabled={selection.adult3rd === 0}
                                  className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <FiMinus size={20} />
                                </button>
                                <span className="text-2xl font-bold text-gray-900 w-12 text-center">
                                  {selection.adult3rd}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCounter(index, 'adult3rd', 1)}
                                  className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors"
                                >
                                  <FiPlus size={20} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 만 2-11세 */}
                          {row.child2to11 && (
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                              <div className="flex-1">
                                <div className="text-sm text-gray-600 mb-1">만 2-11세</div>
                                <div className="text-lg font-semibold text-gray-700">
                                  {formatPrice(row.child2to11)}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => updateCounter(index, 'child2to11', -1)}
                                  disabled={selection.child2to11 === 0}
                                  className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <FiMinus size={20} />
                                </button>
                                <span className="text-2xl font-bold text-gray-900 w-12 text-center">
                                  {selection.child2to11}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCounter(index, 'child2to11', 1)}
                                  className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors"
                                >
                                  <FiPlus size={20} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 만 2세 미만 */}
                          {row.infantUnder2 && (
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                              <div className="flex-1">
                                <div className="text-sm text-gray-600 mb-1">만 2세 미만</div>
                                <div className="text-lg font-semibold text-gray-700">
                                  {formatPrice(row.infantUnder2)}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => updateCounter(index, 'infantUnder2', -1)}
                                  disabled={selection.infantUnder2 === 0}
                                  className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <FiMinus size={20} />
                                </button>
                                <span className="text-2xl font-bold text-gray-900 w-12 text-center">
                                  {selection.infantUnder2}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCounter(index, 'infantUnder2', 1)}
                                  className="p-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors"
                                >
                                  <FiPlus size={20} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 객실별 총액 */}
                          {roomTotal > 0 && (
                            <div className="pt-3 border-t-2 border-blue-300">
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold text-gray-700">객실 총액</span>
                                <span className="text-2xl font-bold text-blue-600">
                                  {roomTotal.toLocaleString()}원
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>요금표 정보가 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 구매자 정보 및 결제 요약 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              {/* 결제 요약 */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">결제 요약</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-700">
                    <span>총 인원</span>
                    <span className="font-semibold">{totalGuests}명</span>
                  </div>
                  <div className="pt-3 border-t-2 border-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">총 결제 금액</span>
                      <span className="text-3xl font-bold text-blue-600">
                        {totalAmount.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 구매자 정보 입력 */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">구매자 정보</h2>

                {/* 본인확인 이름 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiUser className="inline mr-2" />
                    이름 (본인확인) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.buyerName}
                    onChange={(e) => {
                      setFormData({ ...formData, buyerName: e.target.value });
                      setIsVerified(false); // 이름 변경 시 본인확인 초기화
                    }}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="이름을 입력하세요"
                  />
                  {formData.buyerName.trim().length > 0 && !isVerified && (
                    <button
                      type="button"
                      onClick={() => setIsVerified(true)}
                      className="mt-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center justify-center gap-2"
                    >
                      <FiCheckCircle size={18} />
                      본인확인 완료
                    </button>
                  )}
                  {isVerified && (
                    <div className="mt-2 flex items-center gap-2 text-green-600">
                      <FiCheckCircle size={18} />
                      <span className="text-sm font-semibold">본인확인 완료</span>
                    </div>
                  )}
                </div>

                {/* 연락처 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiPhone className="inline mr-2" />
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.buyerTel}
                    onChange={(e) => setFormData({ ...formData, buyerTel: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="010-1234-5678"
                  />
                </div>

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiMail className="inline mr-2" />
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.buyerEmail}
                    onChange={(e) => setFormData({ ...formData, buyerEmail: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="example@email.com"
                  />
                </div>

                {/* 안내 메시지 */}
                {!canProceed() && (
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <FiAlertCircle className="text-yellow-600 mt-1" size={20} />
                      <div className="text-sm text-yellow-800">
                        <p className="font-semibold mb-1">결제 진행을 위해</p>
                        <ul className="list-disc list-inside space-y-1">
                          {!isVerified && <li>본인확인을 완료해주세요</li>}
                          {formData.buyerName.trim().length === 0 && <li>이름을 입력해주세요</li>}
                          {formData.buyerTel.trim().length === 0 && <li>연락처를 입력해주세요</li>}
                          {totalGuests === 0 && <li>객실을 선택해주세요</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* 결제 버튼 */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isProcessing || !canProceed()}
                    className={`w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 ${isProcessing || !canProceed()
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                      }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        결제 진행 중...
                      </>
                    ) : (
                      <>
                        <FiCreditCard size={20} />
                        {totalAmount.toLocaleString()}원 결제하기
                      </>
                    )}
                  </button>
                </div>

                {/* 안전한 결제 안내 */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-2">
                    <FiCreditCard className="text-blue-600 mt-1" size={20} />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">안전한 결제</p>
                      <p>웰컴페이먼츠를 통해 안전하게 결제됩니다. 카드 정보는 암호화되어 전송됩니다.</p>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showProductDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeProductDetail}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <h3 className="text-xl font-bold text-gray-900">상품 상세 정보</h3>
              <button
                type="button"
                onClick={closeProductDetail}
                className="text-gray-500 hover:text-gray-800 transition-colors"
                aria-label="상품 상세 닫기"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6 space-y-6 max-h-[70vh]">
              {isProductDetailLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                  상품 정보를 불러오는 중입니다...
                </div>
              )}

              {productDetailError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                  {productDetailError}
                </div>
              )}

              {productDetail && !isProductDetailLoading && (
                <div className="space-y-6">
                  {productDetail.MallProductContent?.thumbnail && (
                    <div className="relative w-full h-56 overflow-hidden rounded-xl bg-gray-100">
                      <Image
                        src={productDetail.MallProductContent.thumbnail}
                        alt={productName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 768px"
                      />
                    </div>
                  )}

                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">기본 정보</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                      <div>
                        <span className="font-semibold text-gray-900">상품명</span>
                        <p>{productDetail.packageName || productName}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">상품 코드</span>
                        <p>{productDetail.productCode}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">크루즈 라인</span>
                        <p>{productDetail.cruiseLine || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">선박명</span>
                        <p>{productDetail.shipName || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">여행 기간</span>
                        <p>
                          {productDetail.nights && productDetail.days
                            ? `${productDetail.nights}박 ${productDetail.days}일`
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">출발일</span>
                        <p>{productDetail.startDate ? new Date(productDetail.startDate).toLocaleDateString('ko-KR') : '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">도착일</span>
                        <p>{productDetail.endDate ? new Date(productDetail.endDate).toLocaleDateString('ko-KR') : '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">기준가</span>
                        <p>
                          {productDetail.basePrice
                            ? `${productDetail.basePrice.toLocaleString()}원`
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {productDetail.description && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">상품 설명</h4>
                      <p className="text-sm leading-6 text-gray-700 whitespace-pre-wrap">
                        {productDetail.description}
                      </p>
                    </div>
                  )}

                  {productLayoutData?.highlights && Array.isArray(productLayoutData.highlights) && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">하이라이트</h4>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {productLayoutData.highlights.map((highlight: string, idx: number) => (
                          <li key={idx}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={closeProductDetail}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
