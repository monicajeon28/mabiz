'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiTrendingUp, FiUsers, FiMessageSquare, FiBarChart2, FiArrowRight } from 'react-icons/fi';
import Link from 'next/link';

export default function PartnerMarketingPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params?.partnerId as string;

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">마케팅 자동화</h1>
          <p className="text-gray-600">마케팅 기능을 활용하여 고객 관리와 영업을 자동화하세요.</p>
        </div>
      </div>

      {/* 마케팅 기능 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 랜딩페이지 관리 */}
        <Link
          href={`/partner/${partnerId}/landing-pages`}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-500"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiTrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">랜딩페이지 관리</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            랜딩페이지를 생성하고 관리하여 고객 유입을 늘리세요. (최대 15개)
          </p>
          <div className="flex items-center text-blue-600 font-semibold">
            관리하기 <FiArrowRight className="ml-2" />
          </div>
        </Link>

        {/* 고객 그룹 관리 */}
        <Link
          href={`/partner/${partnerId}/customer-groups`}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-green-500"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FiUsers className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">고객 그룹 관리</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            고객을 그룹별로 분류하여 체계적으로 관리하세요.
          </p>
          <div className="flex items-center text-green-600 font-semibold">
            관리하기 <FiArrowRight className="ml-2" />
          </div>
        </Link>

        {/* 예약 메시지 */}
        <Link
          href={`/partner/${partnerId}/scheduled-messages`}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-purple-500"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FiMessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">예약 메시지</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            고객에게 자동으로 발송될 예약 메시지를 설정하세요.
          </p>
          <div className="flex items-center text-purple-600 font-semibold">
            관리하기 <FiArrowRight className="ml-2" />
          </div>
        </Link>

        {/* 문자 보내기 */}
        <Link
          href={`/partner/${partnerId}/customers?action=sms`}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-emerald-500"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FiMessageSquare className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">문자 보내기</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            고객에게 직접 문자를 보내고 소통하세요.
          </p>
          <div className="flex items-center text-emerald-600 font-semibold">
            보내기 <FiArrowRight className="ml-2" />
          </div>
        </Link>

        {/* 데이터 분석 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200 opacity-75">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <FiBarChart2 className="w-6 h-6 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-400">데이터 분석</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            마케팅 데이터 분석 기능 (준비 중)
          </p>
        </div>
      </div>
    </div>
  );
}

