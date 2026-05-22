'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showSuccess, showError } from '@/components/ui/Toast';
import { Send, MessageSquare, Link as LinkIcon, X, RefreshCw } from 'lucide-react';
interface PricingRow {
  cabinType: string;
  fareCategory: string;
  fareLabel: string;
  adultPrice: number;
  childPrice?: number;
  infantPrice?: number;
  minOccupancy: number;
  maxOccupancy: number;
}
interface Trip {
  id: number;
  shipName: string;
  departureDate: string;
  endDate: string;
  destination: string;
  product?: {
    cruiseLine: string;
    shipName: string;
    productCode: string;
    MallProductContent?: {
      layout?: {
        pricing?: PricingRow[];
        departureDate?: string;
      };
      isActive?: boolean;
    } | null;
  };
}
interface RoomGroup {
  id: string;
  roomNumber: number;
  cabinType: string;
  travelers: Traveler[];
  maxCapacity: number; // 2인 1실 원칙
}
interface Traveler {
  id: string;
  engSurname: string;
  engGivenName: string;
  korName: string;
  residentNum: string;
  gender: string;
  birthDate: string;
  passportNo: string;
  nationality: string;
  issueDate: string;
  expiryDate: string;
  phone: string;
  isScanning: boolean;
  isSingleCharge: boolean;
  updatedAt?: number; // Re-rendering을 위한 타임스탬프
}
interface CabinPurchase {
  cabinType: string;
  quantity: number;
}
interface Payment {
  id: number;
  orderId: string;
  productCode: string | null;
  productName: string | null;
  amount: number;
  currency: string;
  buyerName: string;
  buyerEmail: string | null;
  buyerTel: string;
  paidAt: string | null;
  metadata: any;
  sale?: {
    id: number;
    productCode: string | null;
    cabinType: string | null;
    fareCategory: string | null;
    headcount: number | null;
  } | null;
}
interface ReservationFormProps {
  trips: Trip[];
}
export default function ReservationForm({ trips }: ReservationFormProps) {
  const router = useRouter();
  const [selectedTripId, setSelectedTripId] = useState<number | ''>('');
  const [mainUserName, setMainUserName] = useState('');
  const [mainUserPhone, setMainUserPhone] = useState('');
  const [mainUserEmail, setMainUserEmail] = useState('');
  // 객실 구매 정보
  const [cabinPurchases, setCabinPurchases] = useState<CabinPurchase[]>([]);
  // 방 그룹 (구매 수량 기반으로 자동 생성)
  const [roomGroups, setRoomGroups] = useState<RoomGroup[]>([]);
  // 미배정 여행자 목록
  const [unassignedTravelers, setUnassignedTravelers] = useState<Traveler[]>([]);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const draggedTravelerRef = useRef<Traveler | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  // 결제 내역 관련 state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | ''>('');
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [isPaymentDataLoaded, setIsPaymentDataLoaded] = useState(false); // 결제 정보 로드 여부 (Read-only 플래그)
  // 예약 성공 관련 state
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdReservationId, setCreatedReservationId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [passportWarningMessage, setPassportWarningMessage] = useState<string>(''); // 여권 수 부족 경고 메시지
  const [customerPassportImageUrl, setCustomerPassportImageUrl] = useState<string | null>(null); // 고객이 업로드한 여권 이미지 URL
  const [loadingCustomerPassport, setLoadingCustomerPassport] = useState(false); // 고객 여권 이미지 로딩 중
  // 여권 링크 보내기 모달 관련 state
  const [showPassportSendModal, setShowPassportSendModal] = useState(false);
  const [passportPhone, setPassportPhone] = useState('');
  const [passportMessage, setPassportMessage] = useState('');
  const [sendingPassport, setSendingPassport] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'iphone' | 'samsung' | null>(null);
  // 고객별 일괄 발송 관련 state
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [passportStatuses, setPassportStatuses] = useState<Array<{
    customerName: string;
    phone: string;
    reservationId: number | null;
    passportUrl: string;
    status: 'pending' | 'completed';
    travelers: Array<{ name: string; passportNo: string | null }>;
  }>>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  // 선택된 Trip 정보
  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  // 선택된 Trip의 요금표 데이터에서 객실 타입 목록 추출
  // ⚠️ 중요: selectedTrip이 없어도 cabinPurchases에서 cabinType 추출 가능
  const availableCabinTypes = (() => {
    // 1. selectedTrip에서 요금표 데이터가 있으면 사용
    if (selectedTrip?.product?.MallProductContent?.layout?.pricing) {
      const pricing = selectedTrip.product.MallProductContent.layout.pricing;
      const uniqueCabinTypes = Array.from(
        new Set(pricing.map((p) => p.cabinType))
      );
      return uniqueCabinTypes;
    }
    // 2. selectedTrip이 없으면 cabinPurchases에서 cabinType 추출
    if (cabinPurchases.length > 0) {
      return cabinPurchases.map(p => p.cabinType);
    }
    return []; // 둘 다 없으면 빈 배열
  })();
  // 요금표 데이터에서 특정 객실 타입의 가격 정보 가져오기
  // ⚠️ 중요: selectedTrip이 없어도 trips에서 productCode로 찾기
  const getPricingInfo = (cabinType: string): PricingRow | null => {
    // 1. selectedTrip에서 찾기
    if (selectedTrip?.product?.MallProductContent?.layout?.pricing) {
      const pricing = selectedTrip.product.MallProductContent.layout.pricing;
      const found = pricing.find((p) => p.cabinType === cabinType);
      if (found) return found;
    }
    // 2. selectedTrip이 없으면 trips에서 productCode로 찾기 (결제 내역의 productCode 사용)
    if (selectedPaymentId) {
      const payment = payments.find((p) => p.id === selectedPaymentId);
      if (payment?.productCode) {
        const tripWithProduct = trips.find((t) => t.product?.productCode === payment.productCode);
        if (tripWithProduct?.product?.MallProductContent?.layout?.pricing) {
          const pricing = tripWithProduct.product.MallProductContent.layout.pricing;
          const found = pricing.find((p) => p.cabinType === cabinType);
          if (found) return found;
        }
      }
    }
    return null;
  };
  // 결제 내역 불러오기
  const loadPayments = async () => {
    try {
      setLoadingPayments(true);
      setError('');
      const response = await fetch('/api/pnr/partner/payments', {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`결제 내역을 불러올 수 없습니다. (${response.status})`);
      }
      const data = await response.json();
      // 디버깅 정보가 있으면 출력
      if (data.debug) {
      }
      if (data.ok) {
        const paymentsList = data.payments || [];
        setPayments(paymentsList);
        if (paymentsList.length === 0) {
          setError('불러온 결제 내역이 없습니다. boss1 파트너의 결제 완료된 주문이 있는지 확인해주세요.');
        } else {
          // 결제 내역이 있으면 에러 메시지 제거
          setError('');
        }
      } else {
        throw new Error(data.message || data.error || '결제 내역을 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setError(err.message || '결제 내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingPayments(false);
    }
  };
  // 페이지 로드 시 자동으로 결제 내역 불러오기
  useEffect(() => {
    loadPayments();
  }, []); // 빈 의존성 배열: 컴포넌트 마운트 시 한 번만 실행
  // ⚠️ 중요: selectedTripId가 변경되면 객실 정보를 다시 처리 (상품 선택 후 객실 정보 표시 보장)
  useEffect(() => {
    if (selectedTripId && selectedPaymentId) {
      const payment = payments.find((p) => p.id === selectedPaymentId);
      if (payment && payment.metadata && typeof payment.metadata === 'object') {
        const metadata = payment.metadata as any;
        if (metadata.roomSelections && Array.isArray(metadata.roomSelections) && metadata.roomSelections.length > 0) {
          const selectedTrip = trips.find((t) => t.id === selectedTripId);
          if (selectedTrip) {
            // 객실 타입별 수량 집계
            // ⚠️ fallback: count가 없으면 adult를 기반으로 계산 (2인 1실 원칙)
            const cabinTypeCounts = new Map<string, number>();
            metadata.roomSelections.forEach((room: any) => {
              if (room.cabinType) {
                let count = 0;
                if (room.count) {
                  // count 필드가 있으면 사용
                  count = Number(room.count);
                } else if (room.adult) {
                  // count가 없으면 adult를 기반으로 계산 (2인 1실 원칙)
                  count = Math.ceil(Number(room.adult) / 2);
                }
                if (count > 0) {
                  const currentCount = cabinTypeCounts.get(room.cabinType) || 0;
                  cabinTypeCounts.set(room.cabinType, currentCount + count);
                }
              }
            });
            const purchases: CabinPurchase[] = Array.from(cabinTypeCounts.entries()).map(
              ([cabinType, quantity]) => ({
                cabinType,
                quantity,
              })
            );
            if (purchases.length > 0) {
              setCabinPurchases(purchases);
            }
          }
        }
      }
    }
  }, [selectedTripId, selectedPaymentId, payments, trips]); // selectedTripId 변경 시 실행
  // 결제 내역 선택 시 자동 채우기
  const handlePaymentSelect = (paymentId: number | '') => {
    setSelectedPaymentId(paymentId);
    setIsPaymentDataLoaded(false);
    if (!paymentId) {
      // 선택 해제 시 폼 초기화
      setSelectedTripId('');
      setMainUserName('');
      setMainUserPhone('');
      setMainUserEmail('');
      setCabinPurchases([]);
      setRoomGroups([]);
      setUnassignedTravelers([]);
      setPaymentDate('');
      setPaymentMethod('');
      setPaymentAmount('');
      return;
    }
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return;
    // 1. 상품 코드로 Trip 선택 (강제 설정) - ⚠️ 가장 먼저 실행하여 selectedTripId 보장
    let matchingTrip: Trip | undefined = undefined;
    if (payment.productCode) {
      // ⚠️ 중요: 정확한 매칭 (대소문자, 공백 등 고려)
      // ⚠️ 중요: trips 배열에서 productCode로 매칭 (product.productCode 또는 직접 productCode)
      // ⚠️ trips 배열이 비어있으면 경고
      if (trips.length === 0) {
        setError('여행 상품 목록이 비어있습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.');
        setSelectedTripId('');
        // ⚠️ return하지 않음: 다른 섹션(대표자 정보, 결제 정보 등)은 계속 채움
      }
      // ⚠️ 개선: 더 명확한 매칭 로직 (루트 레벨과 product.productCode 모두 확인)
      matchingTrip = trips.find(
        (t) => {
          // 루트 레벨 productCode 확인
          const rootProductCode = (t as any).productCode;
          // product.productCode 확인
          const nestedProductCode = t.product?.productCode;
          // 둘 중 하나라도 일치하면 매칭
          const tripProductCode = nestedProductCode || rootProductCode;
          const match = tripProductCode === payment.productCode;
          // 디버깅: 모든 trip의 productCode 출력
          if (!match) {
          } else {
          }
          return match;
        }
      );
      if (matchingTrip) {
        const tripName = matchingTrip.product?.cruiseLine && matchingTrip.product?.shipName
          ? `${matchingTrip.product.cruiseLine} ${matchingTrip.product.shipName}`
          : matchingTrip.shipName;
        // ⚠️ 중요: 상품을 먼저 강제 선택 (객실 정보 처리 전에 반드시 실행)
        // ⚠️ 반드시 설정: 저장 시 "여행 상품을 선택하세요" 에러 방지
        // ⚠️ 숫자로 변환하여 설정 (드롭다운 value와 일치하도록)
        const tripId = typeof matchingTrip.id === 'number' ? matchingTrip.id : Number(matchingTrip.id);
        if (isNaN(tripId)) {
          setError('여행 상품 ID가 유효하지 않습니다.');
          setSelectedTripId('');
        } else {
          setSelectedTripId(tripId);
          // 에러 메시지 제거 (성공적으로 매칭된 경우)
          setError('');
        }
      } else {
        .productCode,
          nestedProductCode: t.product?.productCode,
          productCode: t.product?.productCode || (t as any).productCode,
          shipName: t.shipName,
        })));
        // ⚠️ 중요: matchingTrip을 찾지 못하면 selectedTripId를 설정하지 않음 (저장 불가)
        // 에러 메시지 표시
        if (trips.length === 0) {
          setError('여행 상품 목록이 비어있습니다. 관리자에게 문의하세요.');
        } else {
          setError(`상품 코드 "${payment.productCode}"에 해당하는 여행 상품을 찾을 수 없습니다. 먼저 해당 상품으로 여행을 생성해주세요.`);
        }
        // ⚠️ 중요: selectedTripId를 초기화하여 저장 시 에러 발생 방지
        setSelectedTripId('');
      }
    } else {
      // ⚠️ 중요: productCode가 없으면 selectedTripId를 초기화
      setSelectedTripId('');
      setError('결제 내역에 상품 코드가 없습니다.');
    }
    // 2. 대표자 정보 채우기
    setMainUserName(payment.buyerName || '');
    setMainUserPhone(payment.buyerTel || '');
    setMainUserEmail(payment.buyerEmail || '');
    // 3. 객실 정보 채우기 (metadata.roomSelections 또는 AffiliateSale 정보 활용)
    // ⚠️ 중요: matchingTrip을 직접 사용하여 요금표 정보 접근 (selectedTrip은 비동기 업데이트로 인해 아직 업데이트되지 않을 수 있음)
    let roomSelectionsFound = false;
    // 방법 1: metadata.roomSelections에서 가져오기 (우선순위 1)
    if (payment.metadata && typeof payment.metadata === 'object') {
      const metadata = payment.metadata as any;
      if (metadata.roomSelections && Array.isArray(metadata.roomSelections) && metadata.roomSelections.length > 0) {
        // ⚠️ 수정: room.count 필드를 제대로 사용 (각 항목이 count를 가지고 있음)
        // ⚠️ fallback: count가 없으면 adult를 기반으로 계산 (2인 1실 원칙)
        const cabinTypeCounts = new Map<string, number>();
        metadata.roomSelections.forEach((room: any) => {
          if (room.cabinType) {
            let count = 0;
            if (room.count) {
              // count 필드가 있으면 사용
              count = Number(room.count);
            } else if (room.adult) {
              // count가 없으면 adult를 기반으로 계산 (2인 1실 원칙)
              count = Math.ceil(Number(room.adult) / 2);
            }
            if (count > 0) {
              const currentCount = cabinTypeCounts.get(room.cabinType) || 0;
              cabinTypeCounts.set(room.cabinType, currentCount + count);
            }
          }
        });
        // CabinPurchase 배열 생성
        const purchases: CabinPurchase[] = Array.from(cabinTypeCounts.entries()).map(
          ([cabinType, quantity]) => ({
            cabinType,
            quantity,
          })
        );
        if (purchases.length > 0) {
          // ⚠️ 중요: matchingTrip이 없어도 객실 정보는 설정 (대표자 정보는 이미 설정되었으므로)
          // selectedTripId가 설정되면 useEffect가 자동으로 처리하지만, 여기서도 즉시 설정하여 빠른 반영 보장
          setCabinPurchases(purchases);
          if (!matchingTrip) {
          }
          // matchingTrip이 있으면 방 그룹도 생성
          if (matchingTrip) {
            // 방 그룹 생성 (사장님 특별 지시: 구매 수량 + 1개 여유분)
            const newRoomGroups: RoomGroup[] = [];
            let roomNumber = 1;
            // 구매한 객실 수량만큼 방 생성
            purchases.forEach((purchase) => {
              // ⚠️ 수정: matchingTrip을 직접 사용하여 요금표 정보 가져오기
              const pricingInfo = matchingTrip?.product?.MallProductContent?.layout?.pricing?.find(
                (p: PricingRow) => p.cabinType === purchase.cabinType
              );
              const maxCapacity = pricingInfo?.maxOccupancy || 2; // 기본 2인
              for (let i = 0; i < purchase.quantity; i++) {
                newRoomGroups.push({
                  id: `room-${roomNumber}`,
                  roomNumber,
                  cabinType: purchase.cabinType,
                  travelers: [],
                  maxCapacity,
                });
                roomNumber++;
              }
            });
            // 마지막에 '미배정(여유분)' 방을 1개 더 추가 (사장님 특별 지시)
            const lastPurchase = purchases[purchases.length - 1];
            const pricingInfo = matchingTrip?.product?.MallProductContent?.layout?.pricing?.find(
              (p: PricingRow) => p.cabinType === lastPurchase.cabinType
            );
            const maxCapacity = pricingInfo?.maxOccupancy || 2; // 기본 2인
            newRoomGroups.push({
              id: `room-${roomNumber}`,
              roomNumber,
              cabinType: '미배정', // 여유분 방은 '미배정'으로 표시
              travelers: [],
              maxCapacity,
            });
            setRoomGroups(newRoomGroups);
            // 여행자 슬롯 자동 생성 (totalGuests만큼)
            const totalGuests = metadata.totalGuests || 0;
            if (totalGuests > 0) {
              const newTravelers: Traveler[] = [];
              for (let i = 0; i < totalGuests; i++) {
                newTravelers.push({
                  id: `traveler-${Date.now()}-${i}`,
                  engSurname: '',
                  engGivenName: '',
                  korName: '',
                  residentNum: '',
                  gender: '',
                  birthDate: '',
                  passportNo: '',
                  nationality: '',
                  issueDate: '',
                  expiryDate: '',
                  phone: '',
                  isScanning: false,
                  isSingleCharge: false,
                  updatedAt: Date.now(),
                });
              }
              // 여행자를 방에 자동 배정 (2인 1실 원칙)
              const updatedRoomGroups = [...newRoomGroups];
              let travelerIndex = 0;
              updatedRoomGroups.forEach((roomGroup) => {
                while (travelerIndex < newTravelers.length && roomGroup.travelers.length < roomGroup.maxCapacity) {
                  roomGroup.travelers.push(newTravelers[travelerIndex]);
                  travelerIndex++;
                }
              });
              // 남은 여행자는 미배정 목록에 추가
              const remainingTravelers = newTravelers.slice(travelerIndex);
              setRoomGroups(updatedRoomGroups);
              setUnassignedTravelers(remainingTravelers);
            } else {
              setUnassignedTravelers([]);
            }
          } else {
            // ⚠️ 중요: matchingTrip이 없어도 cabinPurchases가 있으면 roomGroups 생성 (기본값 사용)
            if (purchases.length > 0) {
              const newRoomGroups: RoomGroup[] = [];
              let roomNumber = 1;
              purchases.forEach((purchase) => {
                // 기본값 사용 (maxCapacity: 2)
                for (let i = 0; i < purchase.quantity; i++) {
                  newRoomGroups.push({
                    id: `room-${roomNumber}`,
                    roomNumber,
                    cabinType: purchase.cabinType,
                    travelers: [],
                    maxCapacity: 2, // 기본 2인
                  });
                  roomNumber++;
                }
              });
              // 마지막에 '미배정(여유분)' 방을 1개 더 추가
              newRoomGroups.push({
                id: `room-${roomNumber}`,
                roomNumber,
                cabinType: '미배정',
                travelers: [],
                maxCapacity: 2, // 기본 2인
              });
              setRoomGroups(newRoomGroups);
              // 여행자 슬롯 자동 생성 (totalGuests만큼)
              const totalGuests = metadata.totalGuests || 0;
              if (totalGuests > 0) {
                const newTravelers: Traveler[] = [];
                for (let i = 0; i < totalGuests; i++) {
                  newTravelers.push({
                    id: `traveler-${Date.now()}-${i}`,
                    engSurname: '',
                    engGivenName: '',
                    korName: '',
                    residentNum: '',
                    gender: '',
                    birthDate: '',
                    passportNo: '',
                    nationality: '',
                    issueDate: '',
                    expiryDate: '',
                    phone: '',
                    isScanning: false,
                    isSingleCharge: false,
                    updatedAt: Date.now(),
                  });
                }
                // 여행자를 방에 자동 배정 (2인 1실 원칙)
                const updatedRoomGroups = [...newRoomGroups];
                let travelerIndex = 0;
                updatedRoomGroups.forEach((roomGroup) => {
                  while (travelerIndex < newTravelers.length && roomGroup.travelers.length < roomGroup.maxCapacity) {
                    roomGroup.travelers.push(newTravelers[travelerIndex]);
                    travelerIndex++;
                  }
                });
                // 남은 여행자는 미배정 목록에 추가
                const remainingTravelers = newTravelers.slice(travelerIndex);
                setRoomGroups(updatedRoomGroups);
                setUnassignedTravelers(remainingTravelers);
              } else {
                setUnassignedTravelers([]);
              }
            }
          }
          roomSelectionsFound = true;
        }
      }
    }
    // 방법 2: metadata.roomSelections가 없으면 AffiliateSale 정보 활용
    if (!roomSelectionsFound && payment.sale) {
      const sale = payment.sale as any;
      if (sale.cabinType && sale.headcount) {
        // headcount를 기준으로 방 개수 계산 (2인 1실 원칙)
        const roomCount = Math.ceil(Number(sale.headcount) / 2);
        const purchases: CabinPurchase[] = [
          {
            cabinType: sale.cabinType,
            quantity: roomCount,
          }
        ];
        // ⚠️ 중요: cabinPurchases 상태를 즉시 업데이트하여 UI에 반영
        setCabinPurchases(purchases);
        // 방 그룹 생성 (사장님 특별 지시: 구매 수량 + 1개 여유분)
        const newRoomGroups: RoomGroup[] = [];
        let roomNumber = 1;
        // 구매한 객실 수량만큼 방 생성
        purchases.forEach((purchase) => {
          // ⚠️ 수정: matchingTrip을 직접 사용하여 요금표 정보 가져오기
          const pricingInfo = matchingTrip?.product?.MallProductContent?.layout?.pricing?.find(
            (p: PricingRow) => p.cabinType === purchase.cabinType
          );
          const maxCapacity = pricingInfo?.maxOccupancy || 2; // 기본 2인
          for (let i = 0; i < purchase.quantity; i++) {
            newRoomGroups.push({
              id: `room-${roomNumber}`,
              roomNumber,
              cabinType: purchase.cabinType,
              travelers: [],
              maxCapacity,
            });
            roomNumber++;
          }
        });
        // 마지막에 '미배정(여유분)' 방을 1개 더 추가 (사장님 특별 지시)
        const lastPurchase = purchases[purchases.length - 1];
        const pricingInfo = matchingTrip?.product?.MallProductContent?.layout?.pricing?.find(
          (p: PricingRow) => p.cabinType === lastPurchase.cabinType
        );
        const maxCapacity = pricingInfo?.maxOccupancy || 2; // 기본 2인
        newRoomGroups.push({
          id: `room-${roomNumber}`,
          roomNumber,
          cabinType: '미배정', // 여유분 방은 '미배정'으로 표시
          travelers: [],
          maxCapacity,
        });
        setRoomGroups(newRoomGroups);
        // 여행자 슬롯 자동 생성 (headcount만큼)
        const headcount = Number(sale.headcount) || 0;
        if (headcount > 0) {
          const newTravelers: Traveler[] = [];
          for (let i = 0; i < headcount; i++) {
            newTravelers.push({
              id: `traveler-${Date.now()}-${i}`,
              engSurname: '',
              engGivenName: '',
              korName: '',
              residentNum: '',
              gender: '',
              birthDate: '',
              passportNo: '',
              nationality: '',
              issueDate: '',
              expiryDate: '',
              phone: '',
              isScanning: false,
              isSingleCharge: false,
              updatedAt: Date.now(),
            });
          }
          // 여행자를 방에 자동 배정 (2인 1실 원칙)
          const updatedRoomGroups = [...newRoomGroups];
          let travelerIndex = 0;
          updatedRoomGroups.forEach((roomGroup) => {
            while (travelerIndex < newTravelers.length && roomGroup.travelers.length < roomGroup.maxCapacity) {
              roomGroup.travelers.push(newTravelers[travelerIndex]);
              travelerIndex++;
            }
          });
          // 남은 여행자는 미배정 목록에 추가
          const remainingTravelers = newTravelers.slice(travelerIndex);
          setRoomGroups(updatedRoomGroups);
          setUnassignedTravelers(remainingTravelers);
        } else {
          setUnassignedTravelers([]);
        }
        roomSelectionsFound = true;
        // 결제 방법도 AffiliateSale의 fareCategory에서 가져오기
        if (sale.fareCategory && !paymentMethod) {
          setPaymentMethod(sale.fareCategory);
        }
      }
    }
    // 방법 3: metadata에 totalGuests만 있고 roomSelections가 없는 경우
    if (!roomSelectionsFound && payment.metadata && typeof payment.metadata === 'object') {
      const metadata = payment.metadata as any;
      if (metadata.totalGuests && !metadata.roomSelections) {
        // sale에서 cabinType 가져오기 또는 기본값 사용
        const defaultCabinType = payment.sale?.cabinType || '발코니';
        const roomCount = Math.ceil(Number(metadata.totalGuests) / 2);
        const purchases: CabinPurchase[] = [
          {
            cabinType: defaultCabinType,
            quantity: roomCount,
          }
        ];
        // ⚠️ 중요: cabinPurchases 상태를 즉시 업데이트하여 UI에 반영
        setCabinPurchases(purchases);
        // 방 그룹 생성 (사장님 특별 지시: 구매 수량 + 1개 여유분)
        const newRoomGroups: RoomGroup[] = [];
        let roomNumber = 1;
        // 구매한 객실 수량만큼 방 생성
        purchases.forEach((purchase) => {
          // ⚠️ 수정: matchingTrip을 직접 사용하여 요금표 정보 가져오기
          const pricingInfo = matchingTrip?.product?.MallProductContent?.layout?.pricing?.find(
            (p: PricingRow) => p.cabinType === purchase.cabinType
          );
          const maxCapacity = pricingInfo?.maxOccupancy || 2; // 기본 2인
          for (let i = 0; i < purchase.quantity; i++) {
            newRoomGroups.push({
              id: `room-${roomNumber}`,
              roomNumber,
              cabinType: purchase.cabinType,
              travelers: [],
              maxCapacity,
            });
            roomNumber++;
          }
        });
        // 마지막에 '미배정(여유분)' 방을 1개 더 추가 (사장님 특별 지시)
        const lastPurchase = purchases[purchases.length - 1];
        const pricingInfo = matchingTrip?.product?.MallProductContent?.layout?.pricing?.find(
          (p: PricingRow) => p.cabinType === lastPurchase.cabinType
        );
        const maxCapacity = pricingInfo?.maxOccupancy || 2; // 기본 2인
        newRoomGroups.push({
          id: `room-${roomNumber}`,
          roomNumber,
          cabinType: '미배정', // 여유분 방은 '미배정'으로 표시
          travelers: [],
          maxCapacity,
        });
        setRoomGroups(newRoomGroups);
        // 여행자 슬롯 자동 생성 (totalGuests만큼)
        const totalGuests = Number(metadata.totalGuests) || 0;
        if (totalGuests > 0) {
          const newTravelers: Traveler[] = [];
          for (let i = 0; i < totalGuests; i++) {
            newTravelers.push({
              id: `traveler-${Date.now()}-${i}`,
              engSurname: '',
              engGivenName: '',
              korName: '',
              residentNum: '',
              gender: '',
              birthDate: '',
              passportNo: '',
              nationality: '',
              issueDate: '',
              expiryDate: '',
              phone: '',
              isScanning: false,
              isSingleCharge: false,
              updatedAt: Date.now(),
            });
          }
          // 여행자를 방에 자동 배정 (2인 1실 원칙)
          const updatedRoomGroups = [...newRoomGroups];
          let travelerIndex = 0;
          updatedRoomGroups.forEach((roomGroup) => {
            while (travelerIndex < newTravelers.length && roomGroup.travelers.length < roomGroup.maxCapacity) {
              roomGroup.travelers.push(newTravelers[travelerIndex]);
              travelerIndex++;
            }
          });
          // 남은 여행자는 미배정 목록에 추가
          const remainingTravelers = newTravelers.slice(travelerIndex);
          setRoomGroups(updatedRoomGroups);
          setUnassignedTravelers(remainingTravelers);
        } else {
          setUnassignedTravelers([]);
        }
        roomSelectionsFound = true;
      }
    }
    // 방법 3: 둘 다 없으면 에러 로그만 출력
    if (!roomSelectionsFound) {
    }
    // 4. 결제 정보 채우기 (Read-only)
    if (payment.paidAt) {
      const paidDate = new Date(payment.paidAt);
      setPaymentDate(paidDate.toISOString().split('T')[0]);
    } else {
      // paidAt이 없으면 오늘 날짜로 설정
      const today = new Date().toISOString().split('T')[0];
      setPaymentDate(today);
    }
    setPaymentAmount(payment.amount.toString());
    setPaymentMethod(payment.sale?.fareCategory || 'PG'); // 기본값
    setIsPaymentDataLoaded(true); // Read-only 플래그 설정
  };
  // 객실 타입별 구매 수량 업데이트
  const updateCabinPurchase = (cabinType: string, quantity: number) => {
    const newPurchases = [...cabinPurchases];
    const existing = newPurchases.find((p) => p.cabinType === cabinType);
    if (existing) {
      if (quantity === 0) {
        // 수량이 0이면 제거
        const filtered = newPurchases.filter((p) => p.cabinType !== cabinType);
        setCabinPurchases(filtered);
        generateRoomGroups(filtered);
      } else {
        existing.quantity = quantity;
        setCabinPurchases(newPurchases);
        generateRoomGroups(newPurchases);
      }
    } else if (quantity > 0) {
      newPurchases.push({ cabinType, quantity });
      setCabinPurchases(newPurchases);
      generateRoomGroups(newPurchases);
    }
  };
  // 구매 수량 기반으로 방 그룹 자동 생성 (2인 1실 원칙)
  const generateRoomGroups = (purchases: CabinPurchase[]) => {
    const newRoomGroups: RoomGroup[] = [];
    let roomNumber = 1;
    purchases.forEach((purchase) => {
      for (let i = 0; i < purchase.quantity; i++) {
        newRoomGroups.push({
          id: `room-${roomNumber}`,
          roomNumber,
          cabinType: purchase.cabinType,
          travelers: [],
          maxCapacity: 2, // 2인 1실 원칙
        });
        roomNumber++;
      }
    });
    setRoomGroups(newRoomGroups);
    // 기존 여행자들의 방 배정 초기화
    setUnassignedTravelers([...unassignedTravelers, ...roomGroups.flatMap((rg) => rg.travelers)]);
    roomGroups.forEach((rg) => {
      rg.travelers = [];
    });
  };
  // 미배정 여행자 추가
  const addUnassignedTraveler = () => {
    const newTraveler: Traveler = {
      id: Date.now().toString(),
      engSurname: '',
      engGivenName: '',
      korName: '',
      residentNum: '',
      gender: '',
      birthDate: '',
      passportNo: '',
      nationality: '',
      issueDate: '',
      expiryDate: '',
      phone: '',
      isScanning: false,
      isSingleCharge: false,
      updatedAt: Date.now(),
    };
    setUnassignedTravelers([...unassignedTravelers, newTraveler]);
  };
  // 미배정 여행자 제거
  const removeUnassignedTraveler = (id: string) => {
    setUnassignedTravelers(unassignedTravelers.filter((t) => t.id !== id));
  };
  // 미배정 여행자 정보 업데이트
  // ⚠️ 중요: 함수형 업데이트 사용하여 최신 상태 보장
  // ⚠️ updatedAt 업데이트 제거: 입력 중 불필요한 리렌더링 방지
  const updateUnassignedTraveler = (id: string, field: keyof Traveler, value: any) => {
    setUnassignedTravelers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };
  // 여권 스캔
  const handlePassportScan = async (travelerId: string) => {
    const fileInput = fileInputRefs.current[travelerId];
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      alert('이미지를 선택해주세요.');
      return;
    }
    const file = fileInput.files[0];
    // 여행자를 unassignedTravelers와 roomGroups 모두에서 찾기
    let traveler = unassignedTravelers.find((t) => t.id === travelerId);
    let isInRoom = false;
    let roomGroupId = '';
    if (!traveler) {
      // 방에 배정된 여행자인지 확인
      for (const roomGroup of roomGroups) {
        const foundTraveler = roomGroup.travelers.find((t) => t.id === travelerId);
        if (foundTraveler) {
          traveler = foundTraveler;
          isInRoom = true;
          roomGroupId = roomGroup.id;
          break;
        }
      }
    }
    if (traveler) {
      if (isInRoom) {
        // 방에 배정된 여행자의 경우 roomGroups 업데이트
        setRoomGroups((prevRoomGroups) =>
          prevRoomGroups.map((rg) =>
            rg.id === roomGroupId
              ? {
                  ...rg,
                  travelers: rg.travelers.map((t) =>
                    t.id === travelerId ? { ...t, isScanning: true } : t
                  ),
                }
              : rg
          )
        );
      } else {
        // 미배정 여행자의 경우
        updateUnassignedTraveler(travelerId, 'isScanning', true);
      }
    }
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/passport/scan', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '여권 스캔에 실패했습니다.');
      }
      // API 응답 데이터를 받아서 상태 업데이트
      const passportData = data.data;
      if (!passportData) {
        throw new Error('여권 데이터를 받을 수 없습니다.');
      }
      if (traveler) {
        // 날짜 변환 함수: 영어 날짜 형식을 YYYY-MM-DD로 변환
        const convertDateToYYYYMMDD = (dateStr: string | null | undefined): string => {
          if (!dateStr || typeof dateStr !== 'string') {
            return '';
          }
          const trimmed = dateStr.trim();
          // 이미 YYYY-MM-DD 형식인 경우
          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
          }
          // Date 객체로 파싱 시도
          try {
            const date = new Date(trimmed);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const result = `${year}-${month}-${day}`;
              return result;
            }
          } catch (e) {
          }
          // 다양한 영어 날짜 형식 시도
          // 예: "May 4, 2023", "04 May 2023", "2023-05-04", "05/04/2023" 등
          const datePatterns = [
            // "May 4, 2023" 형식
            /(\w+)\s+(\d{1,2}),\s+(\d{4})/,
            // "04 May 2023" 형식
            /(\d{1,2})\s+(\w+)\s+(\d{4})/,
            // "2023-05-04" 형식 (이미 체크했지만 다시)
            /(\d{4})-(\d{2})-(\d{2})/,
            // "05/04/2023" 형식 (MM/DD/YYYY)
            /(\d{2})\/(\d{2})\/(\d{4})/,
            // "2023/05/04" 형식 (YYYY/MM/DD)
            /(\d{4})\/(\d{2})\/(\d{2})/,
          ];
          const monthNames: { [key: string]: string } = {
            january: '01', jan: '01',
            february: '02', feb: '02',
            march: '03', mar: '03',
            april: '04', apr: '04',
            may: '05',
            june: '06', jun: '06',
            july: '07', jul: '07',
            august: '08', aug: '08',
            september: '09', sep: '09', sept: '09',
            october: '10', oct: '10',
            november: '11', nov: '11',
            december: '12', dec: '12',
          };
          for (const pattern of datePatterns) {
            const match = trimmed.match(pattern);
            if (match) {
              let year = '';
              let month = '';
              let day = '';
              if (pattern.source.includes('\\w+')) {
                // "May 4, 2023" 또는 "04 May 2023" 형식
                const monthName = match[1].toLowerCase();
                const dayOrMonth = match[2];
                const yearOrDay = match[3];
                if (monthNames[monthName]) {
                  // "May 4, 2023" 형식
                  month = monthNames[monthName];
                  day = String(parseInt(dayOrMonth, 10)).padStart(2, '0');
                  year = yearOrDay;
                } else {
                  // "04 May 2023" 형식
                  day = String(parseInt(monthName, 10)).padStart(2, '0');
                  month = monthNames[dayOrMonth.toLowerCase()] || '';
                  year = yearOrDay;
                }
              } else if (pattern.source.includes('\\d{4}-\\d{2}-\\d{2}')) {
                // "2023-05-04" 형식
                year = match[1];
                month = match[2];
                day = match[3];
              } else if (pattern.source.includes('\\d{2}/\\d{2}/\\d{4}')) {
                // "05/04/2023" 형식 (MM/DD/YYYY)
                month = match[1];
                day = match[2];
                year = match[3];
              } else if (pattern.source.includes('\\d{4}/\\d{2}/\\d{2}')) {
                // "2023/05/04" 형식 (YYYY/MM/DD)
                year = match[1];
                month = match[2];
                day = match[3];
              }
              if (year && month && day) {
                const result = `${year}-${month}-${day}`;
                return result;
              }
            }
          }
          return trimmed; // 변환 실패 시 원본 반환
        };
        // 각 필드를 하나하나 확인하면서 매핑
        // 1. 한글 성명
        const korName = passportData.korName || '';
        // 2. 영문 성 (Surname) - 영어 그대로
        const engSurname = passportData.engSurname || '';
        // 3. 영문 이름 (Given Name) - 영어 그대로
        const engGivenName = passportData.engGivenName || '';
        // 4. 여권번호
        const passportNo = passportData.passportNo || '';
        // 5. 생년월일
        const birthDate = convertDateToYYYYMMDD(passportData.birthDate);
        // 6. 성별
        const gender = passportData.gender || '';
        // 7. 국적
        const nationality = passportData.nationality || '';
        // 8. 발급일 - 영어 날짜를 숫자 형식으로 변환
        const issueDate = convertDateToYYYYMMDD(passportData.issueDate);
        // 9. 만료일 - 영어 날짜를 숫자 형식으로 변환
        const expiryDate = convertDateToYYYYMMDD(
          passportData.expiryDate || passportData.passportExpiryDate
        );
        // ⚠️ 강제 덮어쓰기: 예약자 이름과 여권 이름이 달라도 경고 없이 스캔된 정보로 필드 값을 갱신
        // 필드 매핑 규칙에 따라 업데이트 (isScanning: false 포함하여 즉시 UI 반영)
        const updatedTraveler: Partial<Traveler> = {
          korName, // ⚠️ 강제 덮어쓰기: 기존 값 무시하고 스캔된 값으로 갱신
          engSurname, // ⚠️ 강제 덮어쓰기
          engGivenName, // ⚠️ 강제 덮어쓰기
          passportNo, // ⚠️ 강제 덮어쓰기
          birthDate, // ⚠️ 강제 덮어쓰기
          gender, // ⚠️ 강제 덮어쓰기
          nationality, // ⚠️ 강제 덮어쓰기
          issueDate, // ⚠️ 강제 덮어쓰기
          expiryDate, // ⚠️ 강제 덮어쓰기
          isScanning: false, // 스캔 완료 상태로 즉시 변경
        };
        // 주민번호 처리: OCR 결과에 residentNum이 있으면 우선 사용, 없으면 자동 생성
        if (passportData.residentNum) {
          // OCR에서 자동 생성된 주민번호 앞 7자리 사용
          updatedTraveler.residentNum = passportData.residentNum;
        } else if (birthDate && gender) {
          // OCR 결과에 없으면 기존 로직대로 자동 생성
          try {
            // birthDate는 YYYY-MM-DD 형식
            const birthDateMatch = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (birthDateMatch) {
              const year = parseInt(birthDateMatch[1], 10);
              const month = birthDateMatch[2];
              const day = birthDateMatch[3];
              // 생년월일 6자리 (YYMMDD)
              const yearLastTwo = year % 100;
              const birthDateStr = `${String(yearLastTwo).padStart(2, '0')}${month}${day}`;
              // 성별 코드 결정
              const genderLower = (gender || '').toLowerCase();
              let genderCode = '';
              if (genderLower === 'm' || genderLower === 'male' || genderLower.includes('남')) {
                genderCode = year < 2000 ? '1' : '3'; // 남성: 1900년대=1, 2000년대=3
              } else if (genderLower === 'f' || genderLower === 'female' || genderLower.includes('여')) {
                genderCode = year < 2000 ? '2' : '4'; // 여성: 1900년대=2, 2000년대=4
              }
              if (genderCode) {
                // 주민번호 앞 7자리 생성 (생년월일 6자리 + 하이픈 + 성별코드 1자리)
                // 예: "890813-2"
                const residentNumPrefix = `${birthDateStr}-${genderCode}`;
                updatedTraveler.residentNum = residentNumPrefix;
              } else {
                updatedTraveler.residentNum = '';
              }
            } else {
              updatedTraveler.residentNum = '';
            }
          } catch (dateError) {
            updatedTraveler.residentNum = '';
          }
        } else {
          updatedTraveler.residentNum = '';
        }
        // 연락처는 비워야 함 (수동 입력 필요)
        updatedTraveler.phone = '';
        // ⚠️ 중요: 여행자가 어디에 있는지 정확히 찾아서 업데이트 (불변성 유지)
        // 1단계: roomGroups에서 찾기
        let foundInRoom = false;
        setRoomGroups((prevRoomGroups) => {
          const updated = prevRoomGroups.map((rg) => {
            const travelerIndex = rg.travelers.findIndex((t) => t.id === travelerId);
            if (travelerIndex !== -1) {
              foundInRoom = true;
              // 새로운 배열과 객체 생성 (불변성 유지)
              return {
                ...rg,
                travelers: rg.travelers.map((t) => {
                  if (t.id === travelerId) {
                    const newTraveler = { 
                      ...t, 
                      ...updatedTraveler, 
                      updatedAt: Date.now() 
                    };
                    return newTraveler;
                  }
                  return t;
                }),
              };
            }
            return rg;
          });
          return updated;
        });
        // 2단계: roomGroups에서 못 찾았으면 unassignedTravelers에서 찾기
        if (!foundInRoom) {
          setUnassignedTravelers((prevTravelers) => {
            const updated = prevTravelers.map((t) => {
              if (t.id === travelerId) {
                const newTraveler = { 
                  ...t, 
                  ...updatedTraveler, 
                  updatedAt: Date.now() 
                };
                return newTraveler;
              }
              return t;
            });
            return updated;
          });
        } else {
        }
        // 성공 토스트 메시지 표시
        showSuccess('여권 정보가 입력되었습니다.');
      } else {
      }
    } catch (err: any) {
      // 에러 발생 시에만 isScanning 해제 (성공 시에는 이미 업데이트됨)
      // 에러 발생 시 isScanning 해제 (roomGroups와 unassignedTravelers 모두 확인)
      setRoomGroups((prevRoomGroups) =>
        prevRoomGroups.map((rg) => ({
          ...rg,
          travelers: rg.travelers.map((t) =>
            t.id === travelerId ? { ...t, isScanning: false } : t
          ),
        }))
      );
      setUnassignedTravelers((prevTravelers) =>
        prevTravelers.map((t) =>
          t.id === travelerId ? { ...t, isScanning: false } : t
        )
      );
      // 에러 메시지 표시
      const errorMessage = err.message || '여권 스캔 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      // 파일 입력 초기화
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };
  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, traveler: Traveler) => {
    draggedTravelerRef.current = traveler;
    setIsDragging(true);
    // dataTransfer 설정 (일부 브라우저에서 필요)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', traveler.id);
    }
  };
  // 드래그 종료
  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverRoomId(null);
    draggedTravelerRef.current = null;
  };
  // 드롭 영역에 들어올 때
  const handleDragOver = (e: React.DragEvent, roomGroupId?: string) => {
    e.preventDefault();
    if (roomGroupId) {
      setDragOverRoomId(roomGroupId);
    }
  };
  // 드롭 영역에서 나갈 때
  const handleDragLeave = () => {
    setDragOverRoomId(null);
  };
  // 방에 여행자 배정 (드롭)
  const handleDropToRoom = (roomGroupId: string) => {
    const traveler = draggedTravelerRef.current;
    if (!traveler) return;
    // 함수형 업데이트로 최신 상태 보장
    setRoomGroups((prevRoomGroups) => {
      const roomGroup = prevRoomGroups.find((rg) => rg.id === roomGroupId);
      if (!roomGroup) return prevRoomGroups;
      // 방이 가득 찼는지 확인
      if (roomGroup.travelers.length >= roomGroup.maxCapacity) {
        alert('이 방은 이미 가득 찼습니다.');
        return prevRoomGroups;
      }
      // 여행자가 이미 다른 방에 있는지 확인하고 제거
      const updatedRoomGroups = prevRoomGroups.map((rg) => {
        // 기존 방에서 여행자 제거
        if (rg.travelers.some((t) => t.id === traveler.id)) {
          return {
            ...rg,
            travelers: rg.travelers.filter((t) => t.id !== traveler.id),
          };
        }
        return rg;
      });
      // 새 방에 여행자 추가
      return updatedRoomGroups.map((rg) => {
        if (rg.id === roomGroupId) {
          // 이미 같은 방에 있는지 확인
          if (rg.travelers.some((t) => t.id === traveler.id)) {
            return rg;
          }
          return {
            ...rg,
            travelers: [...rg.travelers, traveler],
          };
        }
        return rg;
      });
    });
    // 미배정 목록에서도 제거 (함수형 업데이트)
    setUnassignedTravelers((prevUnassigned) =>
      prevUnassigned.filter((t) => t.id !== traveler.id)
    );
    setIsDragging(false);
    setDragOverRoomId(null);
    draggedTravelerRef.current = null;
  };
  // 방에서 여행자 제거
  const removeTravelerFromRoom = (roomGroupId: string, travelerId: string) => {
    const roomGroup = roomGroups.find((rg) => rg.id === roomGroupId);
    if (!roomGroup) return;
    const traveler = roomGroup.travelers.find((t) => t.id === travelerId);
    if (!traveler) return;
    // 방에서 제거
    const updatedRoomGroups = roomGroups.map((rg) => {
      if (rg.id === roomGroupId) {
        return {
          ...rg,
          travelers: rg.travelers.filter((t) => t.id !== travelerId),
        };
      }
      return rg;
    });
    setRoomGroups(updatedRoomGroups);
    // 미배정 목록에 추가
    setUnassignedTravelers([...unassignedTravelers, traveler]);
  };
  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // ⚠️ 관리자용 툴이므로 유효성 검사 대폭 완화
    // 최소한의 필수 항목만 확인
    if (!selectedTripId) {
      setError('여행 상품을 선택해주세요.');
      return;
    }
    // ⚠️ 완화: cabinPurchases가 없어도 roomGroups가 있으면 통과
    if (cabinPurchases.length === 0 && roomGroups.length === 0) {
      setError('최소 1개 이상의 객실을 구매해야 합니다.');
      return;
    }
    // ⚠️ 완화: 대표 예약자 연락처는 선택사항으로 변경 (이름만 있어도 통과)
    if (!mainUserName && !mainUserPhone) {
      setError('대표 예약자 이름 또는 연락처를 입력해주세요.');
      return;
    }
    // ⚠️ 완화: 여행자가 없어도 저장 가능 (나중에 추가 가능)
    const allTravelers = [...unassignedTravelers, ...roomGroups.flatMap((rg) => rg.travelers)];
    // ⚠️ 완화: 미배정 여행자가 있어도 저장 가능 (관리자가 나중에 배정 가능)
    // if (unassignedTravelers.length > 0) {
    //   setError('모든 여행자를 방에 배정해주세요.');
    //   return;
    // }
    // ⚠️ 완화: 여행자 필수 필드 검증 제거 (관리자가 나중에 채울 수 있음)
    // 주민번호와 연락처는 선택사항으로 변경
    // for (const traveler of allTravelers) {
    //   if (!traveler.residentNum) {
    //     setError('모든 여행자의 주민번호를 입력해주세요.');
    //     return;
    //   }
    //   if (!traveler.phone) {
    //     setError('모든 여행자의 연락처를 입력해주세요.');
    //     return;
    //   }
    // }
    // ⚠️ 여권 수 부족 체크: 경고만 표시하고 저장은 가능
    const selectedPayment = payments.find((p) => p.id === selectedPaymentId);
    // ⚠️ 예상 인원 계산: roomSelections의 count 합계 사용 (구매 개수 = 인원 수)
    // 예: 발코니 2개 = 2명, 인테리어 1개 = 1명
    let expectedTotalGuests = 0;
    if (selectedPayment?.metadata?.roomSelections && Array.isArray(selectedPayment.metadata.roomSelections)) {
      expectedTotalGuests = selectedPayment.metadata.roomSelections.reduce((sum: number, room: any) => {
        return sum + (room.count || 0);
      }, 0);
    } else if (selectedPayment?.metadata?.totalGuests) {
      // fallback: roomSelections가 없으면 totalGuests 사용
      expectedTotalGuests = selectedPayment.metadata.totalGuests;
    }
    const actualTravelersCount = allTravelers.length;
    const travelersWithPassport = allTravelers.filter((t) => t.passportNo && t.passportNo.trim() !== '').length;
    // ⚠️ 여권 수 부족 경고 (저장은 가능, 여권 1명만 입력해도 저장 가능)
    let warningMsg = '';
    if (expectedTotalGuests > 0 && travelersWithPassport < expectedTotalGuests) {
      const missingCount = expectedTotalGuests - travelersWithPassport;
      warningMsg = `⚠️ 여권 수 부족: 예상 ${expectedTotalGuests}명 중 ${travelersWithPassport}명만 입력되었습니다. (부족: ${missingCount}명) 나중에 추가할 수 있습니다.`;
      setPassportWarningMessage(warningMsg); // state에 저장하여 성공 화면에서 표시
      // 경고는 표시하지만 저장은 계속 진행
    } else {
      setPassportWarningMessage(''); // 여권 수가 충분하면 경고 메시지 제거
    }
    setIsSubmitting(true);
    try {
      // 방 그룹을 기반으로 travelers 배열 생성
      const travelersForSubmit = roomGroups.flatMap((rg) =>
        rg.travelers.map((traveler, index) => ({
          ...traveler,
          roomNumber: rg.roomNumber,
          cabinType: rg.cabinType,
          isSingleCharge: rg.travelers.length === 1, // 1명만 있으면 싱글차지
        }))
      );
      const response = await fetch('/api/pnr/partner/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId: selectedTripId,
          // agentId is extracted from session on the server
          mainUser: {
            name: mainUserName,
            phone: mainUserPhone,
            email: mainUserEmail || undefined,
          },
          travelers: travelersForSubmit.map((t) => ({
            engSurname: t.engSurname,
            engGivenName: t.engGivenName,
            korName: t.korName,
            residentNum: t.residentNum,
            gender: t.gender,
            birthDate: t.birthDate,
            passportNo: t.passportNo,
            nationality: t.nationality,
            issueDate: t.issueDate,
            expiryDate: t.expiryDate,
            roomNumber: t.roomNumber,
            cabinType: t.cabinType,
            isSingleCharge: t.isSingleCharge,
            phone: t.phone,
          })),
          payment: {
            date: paymentDate || undefined,
            method: paymentMethod || undefined,
            amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
          },
          remarks: remarks || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        // ⚠️ API 에러 처리 개선: 상세한 에러 정보 제공
        const errorMessage = data.message || data.error || `예약 생성에 실패했습니다. (${response.status})`;
        const errorDetails = data.details || data.errorDetails;
        // ⚠️ 관리자용 툴이므로 에러 메시지를 상세하게 표시
        if (errorDetails) {
          throw new Error(`${errorMessage}\n\n상세 정보: ${JSON.stringify(errorDetails, null, 2)}`);
        } else {
          throw new Error(errorMessage);
        }
      }
      // 성공: 예약 ID 저장하고 성공 화면 표시
      const reservationId = data.reservationId || data.data?.reservation?.id;
      const successMessage = data.message || '예약 생성이 완료되었습니다.';
      if (reservationId) {
        setCreatedReservationId(reservationId);
        setIsSuccess(true);
        // ⚠️ 여권 수 부족 경고는 성공 화면에서 표시됨 (passportWarningMessage state 사용)
        // 고객이 업로드한 여권 이미지 확인
        checkCustomerPassportImage(reservationId);
        // 모달이 열려있으면 링크 정보 업데이트 (자동 다운로드는 하지 않음)
        if (showPassportSendModal) {
          const passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/${reservationId}`;
          const customerName = mainUserName || '고객';
          const defaultMessage = `안녕하세요 ${customerName}님. 여권 정보를 등록해주시기 바랍니다. 아래 링크를 클릭해주세요.\n\n${passportUrl}`;
          setPassportMessage(defaultMessage);
          setPassportPhone(mainUserPhone);
        }
      } else {
        // 예약 ID가 없으면 기존 방식으로 처리
        const message = passportWarningMessage 
          ? `${successMessage}\n\n${passportWarningMessage}`
          : successMessage;
        alert(message);
        router.push(`/dashboard`);
      }
    } catch (err: any) {
      // ⚠️ 에러 처리 개선: 네트워크 에러와 API 에러 구분
      let errorMessage = '예약 생성 중 오류가 발생했습니다.';
      if (err.message) {
        // Prisma 에러 메시지에서 사용자 친화적인 메시지 추출
        if (err.message.includes('Trip.userId') || err.message.includes('does not exist')) {
          errorMessage = '데이터베이스 오류가 발생했습니다. 관리자에게 문의하세요.';
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.';
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  useEffect(() => {
    if (!linkCopied) return;
    const timer = setTimeout(() => setLinkCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  // 여권 등록 링크 복사
  const handleCopyLink = async () => {
    if (!createdReservationId) return;
    const passportUrl = `${window.location.origin}/passport/${createdReservationId}`;
    try {
      await navigator.clipboard.writeText(passportUrl);
      setLinkCopied(true);
    } catch (err) {
      // 클립보드 API 실패 시 fallback
      const textArea = document.createElement('textarea');
      textArea.value = passportUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
    }
  };
  // 문자 발송 (Mock)
  const handleSendSMS = () => {
    alert('고객님께 여권 등록 요청 문자를 발송했습니다. (가상)');
  };
  // 대시보드로 이동
  const handleGoToDashboard = () => {
    router.push(`/dashboard`);
  };
  // 고객이 업로드한 여권 이미지 확인
  const checkCustomerPassportImage = async (reservationId: number) => {
    try {
      setLoadingCustomerPassport(true);
      const response = await fetch(`/api/passport/customer/upload?reservationId=${reservationId}`);
      const data = await response.json();
      if (data.ok && data.data?.imageUrl) {
        setCustomerPassportImageUrl(data.data.imageUrl);
      } else {
        setCustomerPassportImageUrl(null);
      }
    } catch (error) {
      setCustomerPassportImageUrl(null);
    } finally {
      setLoadingCustomerPassport(false);
    }
  };
  // 고객이 업로드한 여권 이미지를 가져와서 OCR 스캔 실행
  const handleGetCustomerPassport = async (travelerId: string) => {
    if (!customerPassportImageUrl || !createdReservationId) {
      alert('고객이 업로드한 여권 이미지를 찾을 수 없습니다.');
      return;
    }
    try {
      // 이미지 URL에서 파일을 가져오기
      const response = await fetch(customerPassportImageUrl);
      const blob = await response.blob();
      const file = new File([blob], `customer_passport_${createdReservationId}.jpg`, { type: blob.type });
      // 파일을 fileInput에 설정
      const fileInput = fileInputRefs.current[travelerId];
      if (fileInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        // OCR 스캔 실행
        await handlePassportScan(travelerId);
      } else {
        alert('여권 스캔을 위한 파일 입력 요소를 찾을 수 없습니다.');
      }
    } catch (error) {
      alert('고객이 업로드한 여권 이미지를 가져오는데 실패했습니다.');
    }
  };
  // 예약 성공 화면
  if (isSuccess && createdReservationId) {
    const passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/${createdReservationId}`;
    return (
      <div className="space-y-6">
        {/* 성공 메시지 */}
        <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-8 text-center shadow-lg">
          <div className="mb-4 text-6xl">✅</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">예약 생성이 완료되었습니다</h2>
          <p className="text-gray-600">예약이 성공적으로 생성되고 엑셀에 등록되었습니다.</p>
          {/* ⚠️ 여권 수 부족 경고 표시 */}
          {passportWarningMessage && (
            <div className="mt-4 rounded-lg bg-yellow-50 border-2 border-yellow-300 p-4 text-left">
              <p className="text-sm font-semibold text-yellow-800">⚠️ 여권 수 부족 안내</p>
              <p className="mt-1 text-xs text-yellow-700">{passportWarningMessage}</p>
              <p className="mt-2 text-xs text-yellow-600">💡 나중에 여권이 도착하면 추가로 입력할 수 있습니다.</p>
            </div>
          )}
        </div>
        {/* 완료 안내 */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-6">
          <p className="text-sm text-blue-800">
            예약이 성공적으로 생성되었습니다. APIS 엑셀에 자동으로 등록되었습니다.
          </p>
        </div>
        {/* 대시보드로 돌아가기 버튼 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="rounded-lg border border-gray-300 bg-white px-8 py-3 text-gray-700 hover:bg-gray-50"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }
  // 고객별 여권 등록 상태 확인
  const loadPassportStatuses = async () => {
    if (!selectedPaymentId) {
      showError('결제 내역을 먼저 선택해주세요.');
      return;
    }
    try {
      setLoadingStatuses(true);
      const response = await fetch(`/api/pnr/partner/reservations/by-payment/${selectedPaymentId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || '여권 상태를 불러올 수 없습니다.');
      }
      const statuses = data.reservations.map((reservation: any) => {
        const completedTravelers = reservation.travelers.filter((t: any) => t.passportNo && t.passportNo.trim() !== '');
        const pendingTravelers = reservation.travelers.filter((t: any) => !t.passportNo || t.passportNo.trim() === '');
        return {
          customerName: reservation.user?.name || '고객',
          phone: reservation.user?.phone || '',
          reservationId: reservation.id,
          passportUrl: reservation.id 
            ? `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/${reservation.id}`
            : '',
          status: pendingTravelers.length === 0 ? 'completed' : 'pending',
          travelers: reservation.travelers.map((t: any) => ({
            name: `${t.korName || ''} (${t.engSurname || ''} ${t.engGivenName || ''})`.trim(),
            passportNo: t.passportNo,
          })),
        };
      });
      setPassportStatuses(statuses);
      setShowBulkSendModal(true);
    } catch (error: any) {
      showError(error.message || '여권 상태를 불러오는데 실패했습니다.');
    } finally {
      setLoadingStatuses(false);
    }
  };
  // 고객별 일괄 발송
  const handleBulkSendPassports = async () => {
    if (passportStatuses.length === 0) {
      showError('발송할 고객이 없습니다.');
      return;
    }
    try {
      setSendingBulk(true);
      const pendingCustomers = passportStatuses.filter(s => s.status === 'pending' && s.reservationId);
      if (pendingCustomers.length === 0) {
        showError('발송할 고객이 없습니다. 모든 고객의 여권이 완료되었습니다.');
        return;
      }
      let successCount = 0;
      let failCount = 0;
      for (const customer of pendingCustomers) {
        try {
          const passportUrl = customer.passportUrl;
          const message = `안녕하세요 ${customer.customerName}님. 여권 정보를 등록해주시기 바랍니다. 아래 링크를 클릭해주세요.\n\n${passportUrl}`;
          const response = await fetch('/api/partner/customers/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              phone: customer.phone.replace(/[^0-9]/g, ''),
              message: message,
            }),
          });
          const data = await response.json();
          if (response.ok && data.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }
      if (successCount > 0) {
        showSuccess(`${successCount}명에게 여권 등록 링크가 발송되었습니다.${failCount > 0 ? ` (실패: ${failCount}명)` : ''}`);
      } else {
        showError(`발송에 실패했습니다. (실패: ${failCount}명)`);
      }
    } catch (error: any) {
      showError(error.message || '일괄 발송 중 오류가 발생했습니다.');
    } finally {
      setSendingBulk(false);
    }
  };
  // 완료된 여권 다운로드
  const handleDownloadCompletedPassports = () => {
    const completedCustomers = passportStatuses.filter(s => s.status === 'completed');
    if (completedCustomers.length === 0) {
      showError('완료된 여권이 없습니다.');
      return;
    }
    let content = '완료된 여권 정보\n\n';
    content += '='.repeat(50) + '\n\n';
    completedCustomers.forEach((customer, index) => {
      content += `[${index + 1}] ${customer.customerName} (${customer.phone})\n`;
      content += `예약번호: ${customer.reservationId || 'N/A'}\n`;
      content += `링크: ${customer.passportUrl}\n\n`;
      customer.travelers.forEach((traveler, tIndex) => {
        content += `  여행자 ${tIndex + 1}: ${traveler.name}\n`;
        content += `  여권번호: ${traveler.passportNo || 'N/A'}\n`;
      });
      content += '\n' + '-'.repeat(50) + '\n\n';
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `완료된여권정보_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showSuccess(`완료된 여권 정보 ${completedCustomers.length}건이 다운로드되었습니다.`);
  };
  // 여권 링크 보내기 모달 열기 (예약 생성 없이도 가능)
  const handleOpenPassportSendModal = () => {
    const customerName = mainUserName || '고객';
    let passportUrl = '';
    let defaultMessage = '';
    if (createdReservationId) {
      // 예약이 있으면 실제 링크 사용
      passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/${createdReservationId}`;
      defaultMessage = `안녕하세요 ${customerName}님. 여권 정보를 등록해주시기 바랍니다. 아래 링크를 클릭해주세요.\n\n${passportUrl}`;
    } else {
      // 예약이 없으면 임시 링크 (예약 생성 후 업데이트 필요 안내 포함)
      passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/[예약번호]`;
      defaultMessage = `안녕하세요 ${customerName}님. 여권 정보를 등록해주시기 바랍니다.\n\n⚠️ 예약 생성 후 실제 링크가 발급됩니다.\n\n${passportUrl}`;
    }
    setPassportMessage(defaultMessage);
    setPassportPhone(mainUserPhone);
    setShowPassportSendModal(true);
  };
  // 여권 링크 복사
  const handleCopyPassportLink = async () => {
    let passportUrl = '';
    if (createdReservationId) {
      passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/${createdReservationId}`;
    } else {
      passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/[예약번호]`;
    }
    try {
      await navigator.clipboard.writeText(passportUrl);
      showSuccess('링크가 복사되었습니다.');
    } catch (error) {
      showError('링크 복사에 실패했습니다.');
    }
  };
  // 여권 링크 다운로드 (텍스트 파일로)
  const handleDownloadPassportLink = () => {
    const customerName = mainUserName || '고객';
    let passportUrl = '';
    if (createdReservationId) {
      // 예약이 있으면 실제 링크 사용
      passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/${createdReservationId}`;
    } else {
      // 예약이 없으면 임시 링크 (예약 생성 후 업데이트 필요)
      passportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/passport/[예약번호]`;
    }
    const content = `여권 등록 링크\n\n고객명: ${customerName}\n연락처: ${mainUserPhone}\n\n링크: ${passportUrl}\n\n${passportMessage || '안녕하세요 ' + customerName + '님. 여권 정보를 등록해주시기 바랍니다. 아래 링크를 클릭해주세요.\n\n' + passportUrl}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `여권등록링크_${customerName}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showSuccess('저장 완료! 링크가 다운로드되었습니다.');
  };
  // 여권 링크 문자 발송
  const handleSendPassportMessage = async () => {
    if (!passportPhone || !passportMessage.trim()) {
      showError('전화번호와 메시지를 입력해주세요.');
      return;
    }
    if (!createdReservationId) {
      showError('예약이 생성되지 않았습니다. 먼저 예약을 생성해주세요.');
      return;
    }
    try {
      setSendingPassport(true);
      const response = await fetch('/api/partner/customers/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: passportPhone.replace(/[^0-9]/g, ''),
          message: passportMessage,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || '문자 발송에 실패했습니다.');
      }
      showSuccess('여권 등록 링크가 발송되었습니다.');
      setShowPassportSendModal(false);
      setPreviewDevice(null);
    } catch (error: any) {
      showError(error.message || '문자 발송 중 오류가 발생했습니다.');
    } finally {
      setSendingPassport(false);
    }
  };
  return (
    <div className="relative">
      {/* 상단 자동여권보내기링크 버튼 (항상 표시) */}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={handleOpenPassportSendModal}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          <span>자동여권보내기링크</span>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
      {/* 결제 내역 불러오기 */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">📋 결제 내역 불러오기</h2>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              결제 완료된 주문 선택
            </label>
            <select
              value={selectedPaymentId}
              onChange={(e) => handlePaymentSelect(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">주문을 선택하세요</option>
              {payments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {payment.orderId} - {payment.buyerName} ({payment.productName || payment.productCode}) - {payment.amount.toLocaleString()}원
                </option>
              ))}
            </select>
            {payments.length === 0 && !loadingPayments && (
              <p className="mt-2 text-xs text-gray-500">
                결제 내역이 없습니다. 아래 버튼을 클릭하여 최신 결제 내역을 불러오세요.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={loadPayments}
            disabled={loadingPayments}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400 md:ml-2"
          >
            {loadingPayments ? '불러오는 중...' : '결제 내역 불러오기'}
          </button>
        </div>
        {selectedPaymentId && (
          <div className="mt-3 rounded-lg bg-blue-100 p-3 text-sm text-blue-800">
            <p className="font-semibold">✅ 결제 정보가 자동으로 채워졌습니다.</p>
            <p className="mt-1 text-xs">결제 정보는 수정할 수 없습니다.</p>
          </div>
        )}
      </div>
      {/* 여행 상품 선택 */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">1. 여행 상품 선택</h2>
        <select
          value={selectedTripId}
          onChange={(e) => {
            setSelectedTripId(e.target.value ? Number(e.target.value) : '');
            // Trip 선택 시 객실 구매 정보 초기화
            setCabinPurchases([]);
            setRoomGroups([]);
            setUnassignedTravelers([]);
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          required
        >
          <option value="">여행 상품을 선택하세요</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.departureDate} {trip.shipName} ({trip.destination})
            </option>
          ))}
        </select>
      </div>
      {/* 객실 타입별 구매 수량 입력 */}
      {/* ⚠️ 중요: selectedTripId가 없어도 cabinPurchases가 있으면 섹션 표시 (결제 내역에서 불러온 경우) */}
      {(selectedTripId || cabinPurchases.length > 0) && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">2. 객실 구매 정보</h2>
          <p className="mb-4 text-sm text-gray-600">
            구매한 객실 타입과 수량을 입력하세요. 2인 1실 원칙으로 방이 자동 생성됩니다.
          </p>
          {availableCabinTypes.length === 0 ? (
            <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
              <p className="text-sm font-semibold">⚠️ 요금 정보 없음</p>
              <p className="mt-1 text-xs">
                이 상품의 요금표 데이터가 등록되지 않았습니다. 관리자에게 문의하세요.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {availableCabinTypes.map((cabinType) => {
                  const purchase = cabinPurchases.find((p) => p.cabinType === cabinType);
                  const quantity = purchase?.quantity || 0;
                  // 요금표에서 해당 객실 타입의 모든 요금 정보 가져오기
                  const allPricingForCabin = selectedTrip?.product?.MallProductContent?.layout?.pricing?.filter(
                    (p: PricingRow) => p.cabinType === cabinType
                  ) || [];
                  return (
                    <div key={cabinType} className="rounded-lg border border-gray-200 p-4">
                      <div className="mb-3">
                        <label className="text-sm font-semibold text-gray-900">
                          {cabinType}
                        </label>
                        {quantity > 0 && (
                          <span className="ml-2 text-sm font-bold text-blue-600">
                            ({quantity}개 구매)
                          </span>
                        )}
                      </div>
                      {/* 요금표 정보 표시 */}
                      {allPricingForCabin.length > 0 ? (
                        <div className="mb-3 space-y-1">
                          {allPricingForCabin.map((pricing: PricingRow, index: number) => (
                            <div key={index} className="text-xs text-gray-600">
                              <span className="font-medium">{pricing.fareCategory || ''}</span>
                              {pricing.fareLabel && (
                                <span className="ml-1 text-gray-500">({pricing.fareLabel})</span>
                              )}
                              {pricing.adultPrice && (
                                <span className="ml-2">
                                  성인: {pricing.adultPrice.toLocaleString()}원
                                </span>
                              )}
                              {pricing.childPrice && (
                                <span className="ml-2">
                                  아동: {pricing.childPrice.toLocaleString()}원
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-4">
                        <label className="text-xs text-gray-600">구매 수량:</label>
                        <input
                          type="number"
                          min="0"
                          value={quantity}
                          onChange={(e) =>
                            updateCabinPurchase(cabinType, parseInt(e.target.value) || 0)
                          }
                          className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <span className="text-sm text-gray-500">개</span>
                      </div>
      {/* 고객별 일괄 발송 모달 */}
      {showBulkSendModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBulkSendModal(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">고객별 여권 상태 및 일괄 발송</h3>
              <button
                type="button"
                onClick={() => setShowBulkSendModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* 내용 */}
            <div className="px-6 py-6">
              {loadingStatuses ? (
                <div className="flex items-center justify-center p-12">
                  <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="text-gray-600">여권 상태를 불러오는 중...</p>
                  </div>
                </div>
              ) : passportStatuses.length === 0 ? (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-6 text-center">
                  <p className="text-yellow-800">예약 정보가 없습니다. 먼저 예약을 생성해주세요.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 통계 */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{passportStatuses.length}</p>
                      <p className="text-sm text-blue-800">전체 고객</p>
                    </div>
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {passportStatuses.filter(s => s.status === 'completed').length}
                      </p>
                      <p className="text-sm text-green-800">여권 완료</p>
                    </div>
                    <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {passportStatuses.filter(s => s.status === 'pending').length}
                      </p>
                      <p className="text-sm text-orange-800">대기 중</p>
                    </div>
                  </div>
                  {/* 고객 목록 */}
                  <div className="space-y-3">
                    {passportStatuses.map((status, index) => (
                      <div
                        key={index}
                        className={`rounded-lg border-2 p-4 ${
                          status.status === 'completed'
                            ? 'bg-green-50 border-green-300'
                            : 'bg-orange-50 border-orange-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-900">{status.customerName}</h4>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  status.status === 'completed'
                                    ? 'bg-green-200 text-green-800'
                                    : 'bg-orange-200 text-orange-800'
                                }`}
                              >
                                {status.status === 'completed' ? '✅ 여권 완료' : '⏳ 대기 중'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{status.phone}</p>
                            {status.reservationId && (
                              <p className="text-xs text-gray-500 mb-2">예약번호: {status.reservationId}</p>
                            )}
                            {/* 여행자 목록 */}
                            <div className="mt-2 space-y-1">
                              {status.travelers.map((traveler, tIndex) => (
                                <div key={tIndex} className="text-xs">
                                  <span className="font-medium">{traveler.name}</span>
                                  {traveler.passportNo ? (
                                    <span className="text-green-600 ml-2">✅ {traveler.passportNo}</span>
                                  ) : (
                                    <span className="text-orange-600 ml-2">⏳ 미등록</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 액션 버튼 */}
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={handleBulkSendPassports}
                      disabled={sendingBulk || passportStatuses.filter(s => s.status === 'pending' && s.reservationId).length === 0}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {sendingBulk ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>발송 중...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>대기 중인 고객에게 일괄 발송</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCompletedPassports}
                      disabled={passportStatuses.filter(s => s.status === 'completed').length === 0}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <span>💾</span>
                      <span>완료된 여권 다운로드</span>
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
})}
              </div>
              {cabinPurchases.length > 0 && (
                <div className="mt-4 rounded-lg bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    총 {roomGroups.length}개의 방이 생성되었습니다.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* 대표 예약자 정보 */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">3. 대표 예약자 정보</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              이름
            </label>
            <input
              type="text"
              value={mainUserName}
              onChange={(e) => setMainUserName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={mainUserPhone}
              onChange={(e) => setMainUserPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              이메일
            </label>
            <input
              type="email"
              value={mainUserEmail}
              onChange={(e) => setMainUserEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>
      {/* 방 배정 및 여행자 명단 */}
      {/* ⚠️ 중요: roomGroups 또는 unassignedTravelers가 있으면 섹션 표시 */}
      {(roomGroups.length > 0 || unassignedTravelers.length > 0 || cabinPurchases.length > 0) && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">4. 방 배정 및 여행자 명단</h2>
            <button
              type="button"
              onClick={addUnassignedTraveler}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + 여행자 추가
            </button>
          </div>
          {/* ⚠️ 여권 수 부족 경고 (실시간 표시) */}
          {(() => {
            const selectedPayment = payments.find((p) => p.id === selectedPaymentId);
            // ⚠️ 예상 인원 계산: roomSelections의 count 합계 사용 (구매 개수 = 인원 수)
            // 예: 발코니 2개 = 2명, 인테리어 1개 = 1명
            let expectedTotalGuests = 0;
            if (selectedPayment?.metadata?.roomSelections && Array.isArray(selectedPayment.metadata.roomSelections)) {
              expectedTotalGuests = selectedPayment.metadata.roomSelections.reduce((sum: number, room: any) => {
                return sum + (room.count || 0);
              }, 0);
            } else if (selectedPayment?.metadata?.totalGuests) {
              // fallback: roomSelections가 없으면 totalGuests 사용
              expectedTotalGuests = selectedPayment.metadata.totalGuests;
            }
            const allTravelers = [...unassignedTravelers, ...roomGroups.flatMap((rg) => rg.travelers)];
            const travelersWithPassport = allTravelers.filter((t) => t.passportNo && t.passportNo.trim() !== '').length;
            // ⚠️ 여권 1명만 입력해도 저장 가능하도록 경고만 표시 (저장은 항상 가능)
            if (expectedTotalGuests > 0 && travelersWithPassport < expectedTotalGuests) {
              const missingCount = expectedTotalGuests - travelersWithPassport;
              return (
                <div className="mb-4 rounded-lg bg-yellow-50 border-2 border-yellow-300 p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-800">여권 수 부족</p>
                      <p className="mt-1 text-xs text-yellow-700">
                        예상 인원: <strong>{expectedTotalGuests}명</strong>, 입력된 여권: <strong>{travelersWithPassport}명</strong>, 부족: <strong>{missingCount}명</strong>
                      </p>
                      <p className="mt-2 text-xs text-yellow-600">
                        💡 여권이 도착하면 추가로 입력할 수 있습니다. 일단 저장하고 나중에 추가하세요.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          {/* 미배정 여행자 목록 */}
          {unassignedTravelers.length > 0 && (
            <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">미배정 여행자</h3>
              <div className="space-y-3">
                {unassignedTravelers.map((traveler) => (
                    <TravelerCard
                      key={traveler.id}
                      traveler={traveler}
                      onUpdate={(field, value) => updateUnassignedTraveler(traveler.id, field, value)}
                      onRemove={() => removeUnassignedTraveler(traveler.id)}
                      onPassportScan={() => handlePassportScan(traveler.id)}
                      onDragStart={(e) => handleDragStart(e, traveler)}
                      onDragEnd={handleDragEnd}
                      fileInputRef={(el) => {
                        fileInputRefs.current[traveler.id] = el;
                      }}
                      departureDate={selectedTrip?.departureDate || ''}
                      customerPassportImageUrl={customerPassportImageUrl}
                      onGetCustomerPassport={customerPassportImageUrl ? () => handleGetCustomerPassport(traveler.id) : undefined}
                    />
                ))}
              </div>
            </div>
          )}
          {/* 방 그룹 목록 */}
          <div className="space-y-4">
            {roomGroups.map((roomGroup) => (
              <div
                key={roomGroup.id}
                className={`rounded-lg border-2 p-4 transition-all ${
                  dragOverRoomId === roomGroup.id
                    ? 'border-blue-500 bg-blue-100 shadow-lg scale-105'
                    : roomGroup.travelers.length >= roomGroup.maxCapacity
                    ? 'border-gray-300 bg-gray-100'
                    : 'border-blue-200 bg-blue-50'
                }`}
                onDragOver={(e) => handleDragOver(e, roomGroup.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDropToRoom(roomGroup.id)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    Room {roomGroup.roomNumber} ({roomGroup.cabinType})
                  </h3>
                  <span className="text-sm text-gray-600">
                    {roomGroup.travelers.length} / {roomGroup.maxCapacity}명
                  </span>
                </div>
                <div className="space-y-2">
                  {roomGroup.travelers.map((traveler) => (
                    <TravelerCard
                      key={traveler.id}
                      traveler={traveler}
                      onUpdate={(field, value) => {
                        // ⚠️ 중요: 방에 배정된 여행자 정보 업데이트 (함수형 업데이트로 최신 상태 보장)
                        // ⚠️ updatedAt 업데이트 제거: 입력 중 불필요한 리렌더링 방지
                        setRoomGroups((prevRoomGroups) =>
                          prevRoomGroups.map((rg) =>
                            rg.id === roomGroup.id
                              ? {
                                  ...rg,
                                  travelers: rg.travelers.map((t) =>
                                    t.id === traveler.id ? { ...t, [field]: value } : t
                                  ),
                                }
                              : rg
                          )
                        );
                      }}
                      onRemove={() => removeTravelerFromRoom(roomGroup.id, traveler.id)}
                      onPassportScan={() => handlePassportScan(traveler.id)}
                      onDragStart={(e) => handleDragStart(e, traveler)}
                      onDragEnd={handleDragEnd}
                      fileInputRef={(el) => {
                        fileInputRefs.current[traveler.id] = el;
                      }}
                      departureDate={selectedTrip?.departureDate || ''}
                      customerPassportImageUrl={customerPassportImageUrl}
                      onGetCustomerPassport={customerPassportImageUrl ? () => handleGetCustomerPassport(traveler.id) : undefined}
                    />
                  ))}
                  {roomGroup.travelers.length < roomGroup.maxCapacity && (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-3 text-center text-sm text-gray-400">
                      여행자를 여기로 드래그하세요
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 결제 및 기타 정보 */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">5. 결제 및 기타 정보</h2>
        {isPaymentDataLoaded && (
          <div className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            <p className="font-semibold">⚠️ 결제 정보는 수정할 수 없습니다 (결제 내역에서 자동 불러옴)</p>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              결제일
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              readOnly={isPaymentDataLoaded}
              className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                isPaymentDataLoaded ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              결제방법
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={isPaymentDataLoaded}
              className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                isPaymentDataLoaded ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="">선택</option>
              <option value="PG">PG</option>
              <option value="계좌이체">계좌이체</option>
              <option value="현금">현금</option>
              <option value="카드">카드</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              결제금액
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              readOnly={isPaymentDataLoaded}
              className={`w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                isPaymentDataLoaded ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              비고
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>
      {/* 제출 버튼 */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-semibold text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSubmitting ? '처리 중...' : '예약 생성'}
        </button>
      </div>
      </form>
      {/* 여권 보내기 모달 */}
      {showPassportSendModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPassportSendModal(false);
              setPreviewDevice(null);
            }
          }}
        >
          <div
            className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">자동여권보내기링크</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPassportSendModal(false);
                  setPreviewDevice(null);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* 내용 */}
            <div className="px-6 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 왼쪽: 메시지 입력 */}
                <div className="space-y-4">
                  <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                    <p className="text-sm font-semibold text-blue-900 mb-1">고객 정보</p>
                    <p className="text-sm text-blue-800">{mainUserName || '이름 없음'}</p>
                    <p className="text-sm text-blue-800">{mainUserPhone || '전화번호 없음'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      전화번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={passportPhone}
                      onChange={(e) => setPassportPhone(e.target.value)}
                      placeholder="010-1234-5678"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      메시지 내용 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={passportMessage}
                      onChange={(e) => setPassportMessage(e.target.value)}
                      rows={10}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="여권 등록 링크가 포함된 메시지를 입력하세요."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPassportLink}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <LinkIcon className="h-4 w-4" />
                      <span>링크 복사</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPassportLink}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
                    >
                      <span>💾</span>
                      <span>링크 다운로드</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('iphone')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <span>📱</span>
                      <span>아이폰 미리보기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('samsung')}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <span>📱</span>
                      <span>삼성 미리보기</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendPassportMessage}
                    disabled={sendingPassport || !passportPhone || !passportMessage.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {sendingPassport ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>발송 중...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>문자 보내기</span>
                      </>
                    )}
                  </button>
                </div>
                {/* 오른쪽: 스마트폰 미리보기 */}
                <div className="flex items-center justify-center">
                  {previewDevice ? (
                    <div className={`relative ${previewDevice === 'iphone' ? 'w-[375px]' : 'w-[360px]'}`}>
                      {/* 스마트폰 프레임 */}
                      <div className={`relative ${previewDevice === 'iphone' ? 'bg-black rounded-[3rem] p-2' : 'bg-gray-800 rounded-[2.5rem] p-1.5'}`}>
                        {/* 노치 (아이폰만) */}
                        {previewDevice === 'iphone' && (
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[30px] bg-black rounded-b-[1.5rem] z-10"></div>
                        )}
                        {/* 화면 */}
                        <div className={`bg-white ${previewDevice === 'iphone' ? 'rounded-[2.5rem]' : 'rounded-[2rem]'} overflow-hidden`}>
                          {/* 상태바 */}
                          <div className={`${previewDevice === 'iphone' ? 'h-11 pt-2' : 'h-8 pt-1'} bg-white flex items-center justify-between px-4 text-xs font-semibold`}>
                            <span>9:41</span>
                            <div className="flex items-center gap-1">
                              <span>📶</span>
                              <span>📶</span>
                              <span>🔋</span>
                            </div>
                          </div>
                          {/* 메시지 내용 */}
                          <div className="h-[600px] bg-gray-50 p-4 overflow-y-auto">
                            <div className="space-y-3">
                              {/* 받은 메시지 */}
                              <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                    {passportMessage || '메시지 내용을 입력하세요.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 min-h-[400px]">
                      <div className="text-center text-gray-500">
                        <p className="text-lg mb-2">📱</p>
                        <p className="text-sm">미리보기 버튼을 클릭하면</p>
                        <p className="text-sm">스마트폰 화면을 확인할 수 있습니다</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// 여행자 카드 컴포넌트
interface TravelerCardProps {
  traveler: Traveler;
  onUpdate: (field: keyof Traveler, value: any) => void;
  onRemove: () => void;
  onPassportScan: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  fileInputRef: (el: HTMLInputElement | null) => void;
  departureDate?: string; // ⚠️ 출발일 전달 (만료일 검증용)
  customerPassportImageUrl?: string | null; // 고객이 업로드한 여권 이미지 URL
  onGetCustomerPassport?: () => void; // 고객 여권 받기 함수
}
function TravelerCard({
  traveler,
  onUpdate,
  onRemove,
  onPassportScan,
  onDragStart,
  onDragEnd,
  fileInputRef,
  departureDate,
  customerPassportImageUrl,
  onGetCustomerPassport,
}: TravelerCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Controlled Component: props만 사용, 내부 상태 없음
  // 모든 input은 value={traveler.field || ''} 형태로 강제 바인딩
  // ⚠️ 여권 만료일 검증: 출발일 기준 6개월 미만이면 빨간색 에러 표시
  const isExpiryDateInvalid = (() => {
    if (!traveler.expiryDate || !departureDate) return false;
    try {
      const expiryDate = new Date(traveler.expiryDate);
      const departure = new Date(departureDate);
      // 출발일 기준 6개월 후 날짜 계산
      const sixMonthsAfterDeparture = new Date(departure);
      sixMonthsAfterDeparture.setMonth(sixMonthsAfterDeparture.getMonth() + 6);
      // 만료일이 6개월 미만이면 에러
      return expiryDate < sixMonthsAfterDeparture;
    } catch (e) {
      return false;
    }
  })();
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e)}
      onDragEnd={() => onDragEnd?.()}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm cursor-move hover:shadow-md transition-shadow"
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-semibold text-gray-800">여행자 정보</h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-600 hover:text-red-700"
        >
          삭제
        </button>
      </div>
      {/* 여권 스캔 버튼 */}
      <div className="mb-3 space-y-2">
        <input
          ref={(el) => {
            inputRef.current = el;
            fileInputRef(el);
          }}
          data-traveler-id={traveler.id}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onPassportScan();
            }
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              inputRef.current?.click();
            }}
            disabled={traveler.isScanning}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            {traveler.isScanning ? (
              <>
                <span className="animate-spin">⏳</span>
                AI가 여권을 분석 중입니다...
              </>
            ) : (
              <>
                📸 여권 스캔
              </>
            )}
          </button>
          {/* 고객이 업로드한 여권 이미지가 있으면 "여권 받기" 버튼 표시 */}
          {customerPassportImageUrl && onGetCustomerPassport && (
            <button
              type="button"
              onClick={onGetCustomerPassport}
              disabled={traveler.isScanning}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {traveler.isScanning ? (
                <>
                  <span className="animate-spin">⏳</span>
                  분석 중...
                </>
              ) : (
                <>
                  📥 여권 받기
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            영문 성 (Surname)
          </label>
          <input
            type="text"
            value={traveler.engSurname || ''}
            onChange={(e) => onUpdate('engSurname', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            // ⚠️ readOnly 제거: 스캔 후에도 오타 수정 가능
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            영문 이름 (Given Name)
          </label>
          <input
            type="text"
            value={traveler.engGivenName || ''}
            onChange={(e) => onUpdate('engGivenName', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            // ⚠️ readOnly 제거: 스캔 후에도 오타 수정 가능
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            한글 성명
          </label>
          <input
            type="text"
            value={traveler.korName || ''}
            onChange={(e) => onUpdate('korName', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            // ⚠️ readOnly 제거: 스캔 후에도 오타 수정 가능
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            주민번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={traveler.residentNum || ''}
            onChange={(e) => {
              // ⚠️ 중요: 입력값을 즉시 업데이트 (자유롭게 입력 가능)
              const newValue = e.target.value;
              onUpdate('residentNum', newValue);
            }}
            placeholder={traveler.birthDate ? '앞자리는 자동 입력됨 (뒷자리만 입력)' : 'YYMMDD-GXXXXXX'}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            required
          />
          {traveler.birthDate && (
            <p className="mt-1 text-xs text-gray-500">
              💡 생년월일로부터 앞자리가 자동 입력되었습니다. 뒷자리만 입력하세요.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={traveler.phone || ''}
            onChange={(e) => {
              // ⚠️ 중요: 입력값을 즉시 업데이트 (연속 입력 가능)
              const newValue = e.target.value;
              onUpdate('phone', newValue);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            성별
          </label>
          <input
            type="text"
            value={traveler.gender || ''}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm"
            readOnly
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            생년월일
          </label>
          <input
            type="date"
            value={traveler.birthDate || ''}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm"
            readOnly
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            여권번호
          </label>
          <input
            type="text"
            value={traveler.passportNo || ''}
            onChange={(e) => onUpdate('passportNo', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            // ⚠️ readOnly 제거: 스캔 후에도 오타 수정 가능
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            국적
          </label>
          <input
            type="text"
            value={traveler.nationality || ''}
            onChange={(e) => onUpdate('nationality', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            // ⚠️ readOnly 제거: 스캔 후에도 오타 수정 가능
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            발급일
          </label>
          <input
            type="date"
            value={traveler.issueDate || ''}
            onChange={(e) => onUpdate('issueDate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            // ⚠️ readOnly 제거: 스캔 후에도 오타 수정 가능
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            만료일
          </label>
          <input
            type="date"
            value={traveler.expiryDate || ''}
            onChange={(e) => onUpdate('expiryDate', e.target.value)}
            className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
              isExpiryDateInvalid
                ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
            }`}
            // ⚠️ readOnly 제거: 스캔 후에도 오타 수정 가능
          />
          {/* ⚠️ 여권 만료일 6개월 미만 경고 (빨간색 에러 표시, 하지만 저장은 가능) */}
          {isExpiryDateInvalid && (
            <p className="mt-1 text-xs font-semibold text-red-600">
              ⚠️ 여권 만료일이 출발일 기준 6개월 미만입니다. (저장은 가능하지만 여행 전 여권 갱신이 필요할 수 있습니다)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

