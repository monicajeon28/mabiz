'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReservationForm from '@/components/partner/ReservationForm';

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
        pricing?: Array<{
          cabinType: string;
          fareCategory: string;
          fareLabel: string;
          adultPrice: number;
          childPrice?: number;
          infantPrice?: number;
          minOccupancy: number;
          maxOccupancy: number;
        }>;
        departureDate?: string;
      };
      isActive?: boolean;
    } | null;
  };
}

export default function NewReservationPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.partnerId as string;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/partner/trips', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('여행 상품 목록을 불러올 수 없습니다.');
      }

      const data = await response.json();
      console.log('[NewReservationPage] trips API 응답:', {
        ok: data.ok,
        tripsCount: data.trips?.length || 0,
        trips: data.trips,
        error: data.error,
      });
      if (data.ok) {
        setTrips(data.trips || []);
        if (!data.trips || data.trips.length === 0) {
          console.warn('[NewReservationPage] ⚠️ trips가 비어있습니다.');
          if (data.error) {
            console.error('[NewReservationPage] trips API 에러:', data.error);
          }
        }
      } else {
        throw new Error(data.message || '여행 상품 목록을 불러올 수 없습니다.');
      }
    } catch (err: any) {
      setError(err.message || '여행 상품 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push(`/partner/${partnerId}/dashboard`)}
            className="mb-4 text-sm text-gray-600 hover:text-gray-900"
          >
            ← 대시보드로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-gray-900">수동여권등록</h1>
          <p className="mt-2 text-sm text-gray-600">
            여권 스캔과 방 배정 기능을 활용하여 빠르게 여권 정보를 등록하세요.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg bg-white p-12 shadow">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="text-gray-600">여행 상품 목록을 불러오는 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-6 text-red-700">
            <p className="font-semibold">오류</p>
            <p className="mt-2">{error}</p>
            <button
              onClick={loadTrips}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <ReservationForm partnerId={partnerId} trips={trips} />
        )}
      </div>
    </div>
  );
}


