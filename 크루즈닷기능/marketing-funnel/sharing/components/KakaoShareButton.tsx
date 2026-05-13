'use client';

import { useEffect } from 'react';
import Image from 'next/image';

declare global {
  interface Window {
    Kakao: any;
  }
}

interface KakaoShareButtonProps {
  title?: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
}

export default function KakaoShareButton({
  title = '크루즈닷AI 3일 무료체험',
  description = '프리미엄 크루즈 여행을 위한 AI 파트너와 함께하세요! 72시간 동안 모든 기능을 무료로 체험할 수 있습니다.',
  imageUrl = '/images/ai-cruise-logo.png',
  buttonText = '카카오톡 친구 공유하기',
}: KakaoShareButtonProps) {
  useEffect(() => {
    // 카카오톡 SDK 로드
    if (!window.Kakao) {
      const script = document.createElement('script');
      script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
      script.async = true;
      script.onload = () => {
        // SDK 로드 후 초기화
        if (window.Kakao && !window.Kakao.isInitialized()) {
          const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
          if (kakaoKey) {
            window.Kakao.init(kakaoKey);
            console.log('[KakaoShare] 카카오톡 SDK 초기화 완료');
          } else {
            console.warn('[KakaoShare] 카카오톡 JavaScript 키가 설정되지 않았습니다.');
          }
        }
      };
      document.head.appendChild(script);
    } else if (!window.Kakao.isInitialized()) {
      const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (kakaoKey) {
        window.Kakao.init(kakaoKey);
        console.log('[KakaoShare] 카카오톡 SDK 초기화 완료');
      }
    }

    return () => {
      // 클린업은 필요 없음 (SDK는 전역으로 유지)
    };
  }, []);

  const handleShare = () => {
    if (!window.Kakao) {
      alert('카카오톡 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!window.Kakao.isInitialized()) {
      const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (kakaoKey) {
        window.Kakao.init(kakaoKey);
      } else {
        alert('카카오톡 JavaScript 키가 설정되지 않았습니다. 관리자에게 문의해주세요.');
        return;
      }
    }

    // 현재 페이지 URL
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

    // 카카오톡 공유하기
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: title,
        description: description,
        imageUrl: imageUrl,
        link: {
          mobileWebUrl: currentUrl,
          webUrl: currentUrl,
        },
      },
      buttons: [
        {
          title: '무료체험 시작하기',
          link: {
            mobileWebUrl: currentUrl,
            webUrl: currentUrl,
          },
        },
      ],
    });
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-3 px-6 py-4 bg-[#FEE500] hover:bg-[#FDD835] border-2 border-[#FDD835] rounded-xl text-gray-900 font-bold text-base md:text-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
      style={{ minHeight: '56px' }}
    >
      <Image
        src="/images/kakao-logo.png"
        alt="카카오톡"
        width={24}
        height={24}
        className="w-6 h-6"
        onError={(e) => {
          // 이미지 로드 실패 시 이모지로 대체
          e.currentTarget.style.display = 'none';
          const parent = e.currentTarget.parentElement;
          if (parent && !parent.querySelector('.kakao-emoji')) {
            const emoji = document.createElement('span');
            emoji.className = 'kakao-emoji';
            emoji.textContent = '💬';
            emoji.style.fontSize = '24px';
            parent.insertBefore(emoji, parent.firstChild);
          }
        }}
      />
      <span>{buttonText}</span>
    </button>
  );
}

