'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
import { FiArrowRight, FiX } from 'react-icons/fi';
import MiniClassViewer from '@/components/funnel-visualizer/MiniClassViewer';
import AffiliateTracker from '@/components/affiliate/AffiliateTracker';

// 캐시 로그인 유틸리티 (localStorage 기반 3일 체험)
const TRIAL_CACHE_KEY = 'cruise_trial_session';

interface TrialSession {
    name: string;
    phone: string;
    mallUserId: string;
    startedAt: string;
    expiresAt: string;
}

function getTrialSession(): TrialSession | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = localStorage.getItem(TRIAL_CACHE_KEY);
        if (!cached) return null;
        const session: TrialSession = JSON.parse(cached);
        // 만료 체크
        if (new Date(session.expiresAt) < new Date()) {
            localStorage.removeItem(TRIAL_CACHE_KEY);
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

function setTrialSession(session: TrialSession): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TRIAL_CACHE_KEY, JSON.stringify(session));
}

interface B2BLandingClientProps {
    partnerId?: string;
    initialTemplate: string;
    affiliateCode?: string | null;
    mallUserId?: string | null;
}

// 독립적인 폼 컴포넌트 - 입력 시 부모 리렌더링 방지
interface TrialFormProps {
    partnerId?: string;
    location: string;
}

function TrialForm({ partnerId, location }: TrialFormProps) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (loading) return;

        setError(null);

        const trimmedName = name.trim();
        const trimmedPhone = phone.trim().replace(/[^0-9]/g, '');

        if (!trimmedName || trimmedName.length < 2) {
            setError('이름을 정확히 입력해주세요.');
            return;
        }

        if (!trimmedPhone || !/^01([0|1|6|7|8|9])([0-9]{3,4})([0-9]{4})$/.test(trimmedPhone)) {
            setError('올바른 휴대폰 번호를 입력해주세요.');
            return;
        }

        try {
            setLoading(true);

            const response = await fetch('/api/subscription/trial/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: trimmedName,
                    phone: trimmedPhone,
                    partnerId: partnerId,
                    source: 'B2B_LANDING'
                }),
            });

            const data = await response.json();

            if (!response.ok || !data?.ok) {
                setError(data?.error || '무료 체험 시작에 실패했습니다.');
                setLoading(false);
                return;
            }

            if (data.trial) {
                setTrialSession({
                    name: data.trial.name,
                    phone: data.trial.phone,
                    mallUserId: data.trial.trialId,
                    startedAt: data.trial.startedAt,
                    expiresAt: data.trial.expiresAt,
                });
                router.push('/trial/dashboard');
            } else {
                setError('체험 정보를 받지 못했습니다.');
                setLoading(false);
            }
        } catch {
            setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 my-8">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름 입력"
                required
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-4 text-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 placeholder-gray-400"
                disabled={loading}
            />
            <input
                type="tel"
                value={phone}
                onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9-]/g, '');
                    setPhone(value);
                }}
                placeholder="휴대폰번호 입력 (010-1234-5678)"
                required
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-4 text-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 placeholder-gray-400"
                disabled={loading}
            />

            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-black text-xl py-5 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>처리 중...</span>
                    </>
                ) : (
                    <>
                        <span>3일 무료 체험 시작하기</span>
                        <FiArrowRight className="h-5 w-5" />
                    </>
                )}
            </button>
        </form>
    );
}

// 메모이즈된 HTML 콘텐츠 컴포넌트 - 불필요한 리렌더링 방지
const MemoizedHtmlContent = memo(function MemoizedHtmlContent({ html }: { html: string }) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

// 메모이즈된 미니 클래스 컴포넌트
const MemoizedMiniClass = memo(function MemoizedMiniClass() {
    return (
        <div className="py-8 px-4" style={{ backgroundColor: '#111827' }}>
            <MiniClassViewer />
        </div>
    );
});

export default function B2BLandingClient({ partnerId, initialTemplate, affiliateCode, mallUserId }: B2BLandingClientProps) {
    const [checkingCache, setCheckingCache] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // 캐시된 세션 확인 제거 - B2B 랜딩페이지는 항상 표시되어야 함
    useEffect(() => {
        // B2B 랜딩페이지는 항상 표시 (세션 체크 로직 제거)
        setCheckingCache(false);
    }, []);

    // 전역 함수 및 스크립트 로직 등록
    useEffect(() => {
        // 1. 이미지 클릭 핸들러 (템플릿 호환성)
        const handleImageClick = (src: string) => {
            setSelectedImage(src);
        };
        (window as any).openImage = handleImageClick;
        (window as any).showImage = handleImageClick; // 템플릿에서 사용하는 함수명

        // 2. 카운트다운 타이머
        let timerId: NodeJS.Timeout;
        let initInterval: NodeJS.Timeout;

        const startCountdown = () => {
            const countdownElement = document.getElementById('countdown');
            if (!countdownElement) {
                return false;
            }

            const updateCountdown = () => {
                const now = new Date();
                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);
                const diff = endOfDay.getTime() - now.getTime();

                if (diff > 0) {
                    const h = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
                    const m = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
                    const s = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
                    countdownElement.textContent = `${h}:${m}:${s}`;
                } else {
                    countdownElement.textContent = "00:00:00";
                }
            };

            updateCountdown();
            timerId = setInterval(updateCountdown, 1000);
            return true;
        };

        // 요소가 렌더링될 때까지 재시도 (최대 2초)
        let attempts = 0;
        initInterval = setInterval(() => {
            if (startCountdown() || attempts > 20) {
                clearInterval(initInterval);
            }
            attempts++;
        }, 100);

        // 3. 이탈 방지 모달 로직
        (window as any).closeExitIntentModal = () => {
            const modal = document.getElementById('exit-intent-modal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.opacity = '0';
                modal.style.visibility = 'hidden';
            }
        };

        const showExitIntent = () => {
            const modal = document.getElementById('exit-intent-modal');
            const hasShown = sessionStorage.getItem('exitIntentShown');
            if (modal && !hasShown) {
                modal.classList.add('active');
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
                sessionStorage.setItem('exitIntentShown', 'true');
            }
        };

        document.body.addEventListener('mouseleave', showExitIntent);

        // 4. 소셜 프루프 팝업 (랜덤 알림)
        const socialProofPopup = document.getElementById('social-proof-popup');
        let popupInterval: NodeJS.Timeout;

        if (socialProofPopup) {
            const locations = ['서울', '부산', '인천', '대구', '경기', '경남', '제주'];
            const showPopup = () => {
                const loc = locations[Math.floor(Math.random() * locations.length)];
                const time = Math.floor(Math.random() * 15) + 2;
                socialProofPopup.innerHTML = `방금 ${loc}에서 컨설팅 신청 (${time}분 전)`;

                // Tailwind classes for animation
                socialProofPopup.classList.remove('opacity-0', 'translate-y-5');
                socialProofPopup.classList.add('opacity-100', 'translate-y-0');

                setTimeout(() => {
                    socialProofPopup.classList.remove('opacity-100', 'translate-y-0');
                    socialProofPopup.classList.add('opacity-0', 'translate-y-5');
                }, 4000);
            };

            // 5초 후 시작, 8.5초마다 반복
            setTimeout(() => {
                showPopup();
                popupInterval = setInterval(showPopup, 8500);
            }, 5000);
        }

        return () => {
            delete (window as any).openImage;
            delete (window as any).showImage;
            delete (window as any).closeExitIntentModal;
            clearInterval(initInterval);
            if (timerId) clearInterval(timerId);
            if (popupInterval) clearInterval(popupInterval);
            document.body.removeEventListener('mouseleave', showExitIntent);
        };
    }, [initialTemplate]);

    if (checkingCache) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">체험 세션 확인 중...</p>
                </div>
            </div>
        );
    }

    // Template Parsing - body 태그 내용만 추출
    let bodyContent = initialTemplate;
    const bodyMatch = initialTemplate.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
        bodyContent = bodyMatch[1];
    }

    // head 내의 style 태그 추출
    let headStyles = '';
    const styleMatch = initialTemplate.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatch) {
        headStyles = styleMatch.join('\n');
    }

    // 디버그 로그 제거 (무한 리렌더링 방지)

    // FORM_TOP, FORM_MIDDLE, MINI_CLASS 마커로 분리
    const parts = bodyContent.split(/<!-- FORM_(TOP|MIDDLE) -->/);
    // parts[0] = content before TOP
    // parts[1] = "TOP" (captured group)
    // parts[2] = content between TOP and MIDDLE
    // parts[3] = "MIDDLE" (captured group)
    // parts[4] = content after MIDDLE

    return (
        <>
            {/* 어필리에이트 쿠키 추적: B2B 랜딩 방문 시 affiliate_mall_user_id / affiliate_code 쿠키 자동 설정 */}
            {mallUserId && (
                <AffiliateTracker
                    mallUserId={mallUserId}
                    affiliateCode={affiliateCode}
                />
            )}

            {/* 템플릿 스타일 주입 */}
            {headStyles && <div dangerouslySetInnerHTML={{ __html: headStyles }} />}

            {/* Tailwind CDN */}
            <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />

            {/* Render Template Parts with Mini Class Viewer */}
            {parts.map((part, index) => {
                if (part === 'TOP') return <div key={index}><TrialForm partnerId={partnerId} location="top" /></div>;
                if (part === 'MIDDLE') return <div key={index}><TrialForm partnerId={partnerId} location="middle" /></div>;
                // MINI_CLASS 마커가 있는 위치에 미니 클래스 삽입
                if (part.includes('<!-- MINI_CLASS -->')) {
                    const [before, after] = part.split('<!-- MINI_CLASS -->');
                    return (
                        <div key={index}>
                            <MemoizedHtmlContent html={before} />
                            <MemoizedMiniClass />
                            <MemoizedHtmlContent html={after} />
                        </div>
                    );
                }
                return <MemoizedHtmlContent key={index} html={part} />;
            })}

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                        onClick={() => setSelectedImage(null)}
                    >
                        <FiX size={32} />
                    </button>
                    <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center">
                        <div className="relative w-full h-full min-h-[50vh]">
                            <Image
                                src={selectedImage}
                                alt="확대 이미지"
                                fill
                                className="object-contain rounded-lg shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
