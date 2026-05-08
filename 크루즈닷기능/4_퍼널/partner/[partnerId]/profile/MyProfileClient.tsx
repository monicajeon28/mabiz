'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiSave, FiUser, FiMail, FiPhone, FiEdit2, FiUpload, FiCheck, FiFile, FiLink, FiPlus, FiX, FiImage, FiCopy, FiChevronLeft, FiChevronRight, FiPlay, FiExternalLink, FiShoppingBag, FiLock, FiEye, FiEyeOff, FiFileText, FiCheckCircle } from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import DocumentUploadSection from '@/components/affiliate/DocumentUploadSection';
import dayjs from 'dayjs';

type MyProfileClientProps = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    mallUserId: string;
    mallNickname: string | null;
  };
  profile: any;
};

interface CustomLink {
  label: string;
  url: string;
  isActive: boolean;
}

export default function MyProfileClient({ user, profile }: MyProfileClientProps) {
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [savingPartnerMall, setSavingPartnerMall] = useState(false);
  
  // 비밀번호 변경 관련 상태
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // 나의 계약서 모달 관련 상태
  const [showContractModal, setShowContractModal] = useState(false);
  const [contract, setContract] = useState<any | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [contractType, setContractType] = useState<'SALES_AGENT' | 'BRANCH_MANAGER' | 'CRUISE_STAFF' | 'PRIMARKETER'>('SALES_AGENT');
  const [currentProfileId, setCurrentProfileId] = useState<number | undefined>(undefined);
  
  // JSON 필드 파싱 함수들
  const parseCustomLinks = (): CustomLink[] => {
    if (!profile?.customLinks) return [];
    try {
      const parsed = typeof profile.customLinks === 'string' 
        ? JSON.parse(profile.customLinks) 
        : profile.customLinks;
      if (Array.isArray(parsed)) {
        return parsed.map((link: any) => ({
          label: link.label || '',
          url: link.url || '',
          isActive: link.isActive !== undefined ? link.isActive : (link.label && link.url),
        }));
      }
    } catch (e) {
      console.error('[parseCustomLinks] error:', e);
    }
    return [];
  };

  const parseGalleryImages = (): string[] => {
    if (!profile?.galleryImages) return [];
    try {
      const parsed = typeof profile.galleryImages === 'string'
        ? JSON.parse(profile.galleryImages)
        : profile.galleryImages;
      if (Array.isArray(parsed)) {
        return parsed
          .map((img: any) => {
            // 문자열이면 그대로 반환
            if (typeof img === 'string') {
              const trimmed = img.trim();
              // [object Object] 같은 잘못된 값 필터링
              if (trimmed.includes('[object Object]') || trimmed === '[object Object]' || !trimmed.startsWith('http')) {
                return '';
              }
              return trimmed;
            }
            // 객체면 url 필드 추출
            if (img && typeof img === 'object' && 'url' in img) {
              const url = typeof img.url === 'string' ? img.url.trim() : '';
              if (url && !url.includes('[object Object]') && url.startsWith('http')) {
                return url;
              }
            }
            // 그 외는 빈 문자열
            return '';
          })
          .filter((url: string) => url.length > 0 && url.startsWith('http'));
      }
    } catch (e) {
      console.error('[parseGalleryImages] error:', e, profile?.galleryImages);
    }
    return [];
  };

  const parseFeaturedImages = (): string[] => {
    if (!profile?.featuredImages) return [];
    try {
      const parsed = typeof profile.featuredImages === 'string'
        ? JSON.parse(profile.featuredImages)
        : profile.featuredImages;
      if (Array.isArray(parsed)) {
        return parsed
          .map((img: any) => {
            // 문자열이면 그대로 반환
            if (typeof img === 'string') {
              const trimmed = img.trim();
              // [object Object] 같은 잘못된 값 필터링
              if (trimmed.includes('[object Object]') || trimmed === '[object Object]' || !trimmed.startsWith('http')) {
                return '';
              }
              return trimmed;
            }
            // 객체면 url 필드 추출
            if (img && typeof img === 'object' && 'url' in img) {
              const url = typeof img.url === 'string' ? img.url.trim() : '';
              if (url && !url.includes('[object Object]') && url.startsWith('http')) {
                return url;
              }
            }
            // 그 외는 빈 문자열
            return '';
          })
          .filter((url: string) => url.length > 0 && url.startsWith('http'));
      }
    } catch (e) {
      console.error('[parseFeaturedImages] error:', e, profile?.featuredImages);
    }
    return [];
  };

  const [formData, setFormData] = useState({
    displayName: profile?.displayName || user.name || '',
    bio: profile?.bio || '',
    profileImage: (() => {
      const img = profile?.profileImage;
      if (!img) return '';
      if (typeof img === 'string') {
        // [object Object] 필터링
        if (img.includes('[object Object]') || !img.startsWith('http')) {
          return '';
        }
        return img;
      }
      return '';
    })(),
    contactPhone: profile?.contactPhone || user.phone || '',
    contactEmail: profile?.contactEmail || user.email || '',
    profileTitle: profile?.profileTitle || '',
    landingAnnouncement: profile?.landingAnnouncement || '',
    welcomeMessage: profile?.welcomeMessage || '',
    kakaoLink: profile?.kakaoLink || '',
    instagramHandle: profile?.instagramHandle || '',
    youtubeChannel: profile?.youtubeChannel || '',
    blogLink: profile?.blogLink || '',
    threadLink: profile?.threadLink || '',
    customLinks: (() => {
      const parsed = parseCustomLinks();
      return parsed.length > 0 ? parsed : [{ label: '', url: '', isActive: false }];
    })(),
    galleryImages: (() => {
      const parsed = parseGalleryImages();
      const slots = Array(9).fill('');
      parsed.forEach((url, index) => {
        if (index < 9) slots[index] = url;
      });
      return slots;
    })(),
    featuredImages: (() => {
      const parsed = parseFeaturedImages();
      const slots = Array(3).fill('');
      parsed.forEach((url, index) => {
        if (index < 3) slots[index] = url;
      });
      return slots;
    })(),
    youtubeVideoUrl: profile?.youtubeVideoUrl || '',
  });

  const profileImageUrl = formData.profileImage || null;

  const partnerId = user.mallUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { customLinks, galleryImages, featuredImages, ...restFormData } = formData;
      
      // JSON 필드 변환
      const filteredCustomLinks = customLinks.filter(link => link.label.trim() && link.url.trim());
      const filteredGalleryImages = galleryImages.filter((img: string) => img && img.trim());
      const filteredFeaturedImages = featuredImages.filter((img: string) => img && img.trim());
      
      const res = await fetch('/api/partner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...restFormData,
          customLinks: filteredCustomLinks.length > 0 ? filteredCustomLinks : null,
          galleryImages: filteredGalleryImages.length > 0 ? filteredGalleryImages : null,
          featuredImages: filteredFeaturedImages.length > 0 ? filteredFeaturedImages : null,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '프로필 업데이트에 실패했습니다.');
      }

      showSuccess('프로필이 성공적으로 업데이트되었습니다!');
    } catch (error: any) {
      console.error('[MyProfileClient] Update error:', error);
      showError(error.message || '프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 기본정보 저장 함수
  const handleSaveBasicInfo = async () => {
    if (!formData.displayName || formData.displayName.trim() === '') {
      showError('표시 이름을 입력해주세요.');
      return;
    }

    setSavingBasicInfo(true);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: formData.displayName,
          contactPhone: formData.contactPhone,
          contactEmail: formData.contactEmail,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '기본정보 저장에 실패했습니다.');
      }

      showSuccess('기본정보가 저장되었습니다!');
    } catch (error: any) {
      console.error('[MyProfileClient] Save basic info error:', error);
      showError(error.message || '기본정보 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBasicInfo(false);
    }
  };

  // 파트너몰 설정 저장 함수
  const handleSavePartnerMall = async () => {
    setSavingPartnerMall(true);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profileTitle: formData.profileTitle,
          landingAnnouncement: formData.landingAnnouncement,
          welcomeMessage: formData.welcomeMessage,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '파트너몰 설정 저장에 실패했습니다.');
      }

      showSuccess('파트너몰 설정이 저장되었습니다!');
    } catch (error: any) {
      console.error('[MyProfileClient] Save partner mall error:', error);
      showError(error.message || '파트너몰 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingPartnerMall(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.trim().length === 0) {
      showError('새 비밀번호를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 4) {
      showError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setIsChangingPassword(true);

    try {
      // currentPassword가 비어있지 않으면 trim하여 전송, 비어있으면 null 전송
      const trimmedCurrentPassword = currentPassword && currentPassword.trim().length > 0 
        ? currentPassword.trim() 
        : null;

      console.log('[MyProfileClient] Changing password:', {
        hasCurrentPassword: !!trimmedCurrentPassword,
        newPasswordLength: newPassword.trim().length,
      });

      const res = await fetch('/api/partner/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: trimmedCurrentPassword,
          newPassword: newPassword.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '비밀번호 변경에 실패했습니다.');
      }

      showSuccess('비밀번호가 변경되었습니다.');
      setIsEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('[MyProfileClient] Password change error:', error);
      showError(error.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[handleImageUpload] File selected:', { name: file.name, type: file.type, size: file.size });

    setImageUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      console.log('[handleImageUpload] Sending request...');
      const res = await fetch('/api/partner/profile/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
        // Content-Type 헤더를 명시적으로 설정하지 않음 (FormData가 자동으로 설정)
      });
      
      console.log('[handleImageUpload] Response status:', res.status);

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || '이미지 업로드에 실패했습니다.');
      }

      const imageUrl = json.profileImage;
      
      // 문자열인지 확인
      if (typeof imageUrl !== 'string') {
        console.error('[handleImageUpload] Invalid imageUrl type:', typeof imageUrl, imageUrl);
        throw new Error('이미지 URL이 올바르지 않습니다.');
      }
      
      setFormData((prev) => ({
        ...prev,
        profileImage: imageUrl,
      }));
      
      showSuccess('프로필 이미지가 업로드되었습니다!');
    } catch (error: any) {
      console.error('[MyProfileClient] Image upload error:', error);
      showError(error.message || '이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleGalleryImageUpload = async (index: number, file: File) => {
    console.log('[handleGalleryImageUpload] File selected:', { name: file.name, type: file.type, size: file.size, index });
    setImageUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const res = await fetch('/api/partner/profile/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || '이미지 업로드에 실패했습니다.');
      }

      const imageUrl = json.profileImage;
      if (typeof imageUrl !== 'string') {
        console.error('[handleGalleryImageUpload] Invalid imageUrl type:', typeof imageUrl, imageUrl);
        throw new Error('이미지 URL이 올바르지 않습니다.');
      }
      
      setFormData((prev) => {
        const newGalleryImages = [...prev.galleryImages];
        newGalleryImages[index] = imageUrl;
        return { ...prev, galleryImages: newGalleryImages };
      });
      showSuccess('이미지가 업로드되었습니다!');
    } catch (error: any) {
      console.error('[GalleryImageUpload] error:', error);
      showError(error.message || '이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleFeaturedImageUpload = async (index: number, file: File) => {
    console.log('[handleFeaturedImageUpload] File selected:', { name: file.name, type: file.type, size: file.size, index });
    setImageUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const res = await fetch('/api/partner/profile/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || '이미지 업로드에 실패했습니다.');
      }

      const imageUrl = json.profileImage;
      if (typeof imageUrl !== 'string') {
        console.error('[handleFeaturedImageUpload] Invalid imageUrl type:', typeof imageUrl, imageUrl);
        throw new Error('이미지 URL이 올바르지 않습니다.');
      }
      
      setFormData((prev) => {
        const newFeaturedImages = [...prev.featuredImages];
        newFeaturedImages[index] = imageUrl;
        return { ...prev, featuredImages: newFeaturedImages };
      });
      showSuccess('이미지가 업로드되었습니다!');
    } catch (error: any) {
      console.error('[FeaturedImageUpload] error:', error);
      showError(error.message || '이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setImageUploading(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    setFormData((prev) => {
      const newGalleryImages = [...prev.galleryImages];
      newGalleryImages[index] = '';
      return { ...prev, galleryImages: newGalleryImages };
    });
  };

  const removeFeaturedImage = (index: number) => {
    setFormData((prev) => {
      const newFeaturedImages = [...prev.featuredImages];
      newFeaturedImages[index] = '';
      return { ...prev, featuredImages: newFeaturedImages };
    });
  };

  const addCustomLink = () => {
    setFormData((prev) => ({
      ...prev,
      customLinks: [...prev.customLinks, { label: '', url: '', isActive: false }],
    }));
  };

  const removeCustomLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      customLinks: prev.customLinks.filter((_, i) => i !== index),
    }));
  };

  const updateCustomLink = (index: number, field: 'label' | 'url', value: string) => {
    setFormData((prev) => {
      const newLinks = [...prev.customLinks];
      newLinks[index] = {
        ...newLinks[index],
        [field]: value,
        isActive: newLinks[index].label.trim() !== '' && newLinks[index].url.trim() !== '' && value.trim() !== '',
      };
      return { ...prev, customLinks: newLinks };
    });
  };

  // 사용자 프로필 정보 로드 (계약서 타입 확인용)
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const res = await fetch('/api/affiliate/my-profile');
        const json = await res.json();
        
        if (res.ok && json?.ok) {
          const profile = json.profile;
          setUserProfile(profile);
          setCurrentProfileId(profile?.id);
          
          if (profile?.type === 'BRANCH_MANAGER') {
            setContractType('BRANCH_MANAGER');
          } else if (profile?.type === 'SALES_AGENT') {
            setContractType('SALES_AGENT');
          }
        }
      } catch (error: any) {
        console.error('[MyProfileClient] load user profile error', error);
      }
    };
    
    const loadContractForSignature = async () => {
      try {
        const res = await fetch('/api/affiliate/my-contract', { credentials: 'include' });
        const json = await res.json();

        if (res.ok && json?.ok && json.contract) {
          setContract(json.contract);
        }
      } catch (error: any) {
        console.error('[MyProfileClient] load contract for signature error', error);
      }
    };
    
    loadUserProfile();
    loadContractForSignature();
  }, []);

  // 나의 계약서 로드 함수
  const loadContract = async () => {
    try {
      setLoadingContract(true);
      const res = await fetch('/api/affiliate/my-contract', { credentials: 'include' });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '계약 정보를 불러올 수 없습니다.');
      }

      setContract(json.contract);
      setShowContractModal(true);
    } catch (error: any) {
      console.error('[MyProfileClient] load contract error', error);
      showError(error.message || '계약 정보를 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoadingContract(false);
    }
  };

  // 수동 계약서 저장 버튼 클릭 핸들러
  const handleManualContractSave = () => {
    // 계약서 작성 페이지로 이동 (계약서 타입과 프로필 ID 포함)
    const params = new URLSearchParams();
    params.append('type', contractType);
    // invitedBy는 전달하지 않음 (자신의 계약서이므로 담당 멘토를 자동으로 조회하도록)
    // 사용자 정보도 URL에 포함 (자동 채우기용)
    if (userProfile?.name) {
      params.append('name', encodeURIComponent(userProfile.name));
    }
    if (userProfile?.phone) {
      params.append('phone', encodeURIComponent(userProfile.phone));
    }
    window.location.href = `/affiliate/contract?${params.toString()}`;
  };

  // 서명 URL 추출 함수
  const getSignatureUrl = () => {
    if (!contract?.metadata) return null;
    const metadata = contract.metadata as any;
    if (metadata?.signatures?.main?.url) {
      return metadata.signatures.main.url;
    }
    if (metadata?.signature?.url) {
      return metadata.signature.url;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pt-10 md:px-6">
        {/* Header */}
        <header className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-xl shadow-slate-900/20">
          <Link
            href={`/partner/${partnerId}/dashboard`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
          >
            <FiArrowLeft /> 대시보드로 돌아가기
          </Link>
          <h1 className="text-3xl font-black leading-snug md:text-4xl">
            프로필 수정
          </h1>
          <p className="mt-2 text-sm text-slate-300 md:text-base">
            파트너 프로필 정보를 수정할 수 있습니다.
          </p>
        </header>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="space-y-8">
            {/* 기본 정보 */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900">
                <FiUser className="text-slate-600" />
                기본 정보
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    파트너 ID
                  </label>
                  <input
                    type="text"
                    value={user.mallUserId}
                    disabled
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600"
                  />
                  <p className="mt-1 text-xs text-gray-500">파트너 ID는 변경할 수 없습니다.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    표시 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="고객에게 표시될 이름"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    <FiPhone className="inline mr-1" />
                    영업용 전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="010-1234-5678"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    전화상담 신청 완료 시 고객에게 이 번호가 안내됩니다.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    <FiMail className="inline mr-1" />
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="example@email.com"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* 계약서 싸인 이미지 */}
                {getSignatureUrl() && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      <FiFileText className="inline mr-1" />
                      계약서 싸인
                    </label>
                    <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center justify-center">
                        <img
                          src={getSignatureUrl() || ''}
                          alt="계약서 싸인"
                          className="max-h-32 w-auto rounded-lg shadow-md"
                        />
                      </div>
                      <p className="mt-2 text-xs text-center text-gray-600">
                        계약서에 등록된 싸인 이미지입니다
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveBasicInfo}
                  disabled={savingBasicInfo}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {savingBasicInfo ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      저장 중...
                    </>
                  ) : (
                    <>
                      <FiSave />
                      저장하기
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* 파트너몰 설정 */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900">
                <FiEdit2 className="text-purple-600" />
                파트너몰 설정
              </h2>
              <div className="mb-4 rounded-xl bg-purple-50 border border-purple-200 p-4">
                <p className="text-sm text-purple-700">
                  파트너몰은 프로필 이미지 없이 텍스트만 표시됩니다. 나의 SNS 프로필은 별도로 설정하세요.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    프로필 제목
                  </label>
                  <input
                    type="text"
                    value={formData.profileTitle}
                    onChange={(e) => setFormData({ ...formData, profileTitle: e.target.value })}
                    placeholder="파트너몰에 표시될 제목"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    랜딩 안내 문구
                  </label>
                  <textarea
                    value={formData.landingAnnouncement}
                    onChange={(e) => setFormData({ ...formData, landingAnnouncement: e.target.value })}
                    placeholder="파트너몰 상단에 표시될 안내 문구"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    환영 메시지
                  </label>
                  <textarea
                    value={formData.welcomeMessage}
                    onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                    placeholder="고객에게 보여질 환영 메시지"
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSavePartnerMall}
                  disabled={savingPartnerMall}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {savingPartnerMall ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      저장 중...
                    </>
                  ) : (
                    <>
                      <FiSave />
                      저장하기
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* 비밀번호 변경 */}
            <section className="border-t-2 border-teal-200 pt-8 mt-8">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900">
                <FiLock className="text-teal-600" />
                비밀번호 변경
              </h2>
              <div className="mb-4 rounded-xl bg-teal-50 border border-teal-200 p-4">
                <p className="text-sm text-teal-700">
                  계정 보안을 위해 정기적으로 비밀번호를 변경하세요.
                </p>
              </div>
              {!isEditingPassword ? (
                <button
                  type="button"
                  onClick={() => setIsEditingPassword(true)}
                  className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FiLock className="w-4 h-4" />
                  비밀번호 변경하기
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      현재 비밀번호 (선택사항)
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="현재 비밀번호를 입력하세요 (선택사항)"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      현재 비밀번호를 입력하면 더 안전합니다. 비워두어도 변경 가능합니다.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      새 비밀번호 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="새 비밀번호를 입력하세요"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">최소 4자 이상 입력해주세요.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      새 비밀번호 확인 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="새 비밀번호를 다시 입력하세요"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      disabled={isChangingPassword}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {isChangingPassword ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          변경 중...
                        </>
                      ) : (
                        <>
                          <FiLock />
                          비밀번호 변경
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 세금 신고용 서류 업로드 */}
            <section className="border-t-2 border-blue-200 pt-8 mt-8">
              <DocumentUploadSection partnerId={partnerId} />
            </section>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex items-center justify-end gap-4">
            <Link
              href={`/partner/${partnerId}/dashboard`}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  저장 중...
                </>
              ) : (
                <>
                  <FiSave />
                  저장하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 나의 계약서 모달 */}
      {showContractModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 overflow-y-auto"
          onClick={() => setShowContractModal(false)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">나의 계약서</h3>
                <p className="text-xs text-slate-500 mt-1">계약 정보를 확인할 수 있습니다</p>
              </div>
              <button
                onClick={() => setShowContractModal(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-8 max-h-[70vh] overflow-y-auto">
              {contract ? (
                <div className="space-y-6">
                  {/* 기본 정보 */}
                  <section className="rounded-xl bg-gray-50 p-4">
                    <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <FiUser className="text-blue-600" />
                      계약자 정보
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2 text-sm">
                      <div>
                        <p className="font-semibold text-slate-500">성명</p>
                        <p className="text-slate-900">{contract.name}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500">연락처</p>
                        <p className="text-slate-900">{contract.phone}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500">이메일</p>
                        <p className="text-slate-900">{contract.email || '-'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500">주소</p>
                        <p className="text-slate-900">{contract.address || '정보 없음'}</p>
                      </div>
                    </div>
                  </section>

                  {/* 정산 계좌 정보 */}
                  {(contract.bankName || contract.bankAccount) && (
                    <section className="rounded-xl bg-gray-50 p-4">
                      <h4 className="text-lg font-bold text-slate-900 mb-4">정산 계좌 정보</h4>
                      <div className="grid gap-4 md:grid-cols-3 text-sm">
                        {contract.bankName && (
                          <div>
                            <p className="font-semibold text-slate-500">은행명</p>
                            <p className="text-slate-900">{contract.bankName}</p>
                          </div>
                        )}
                        {contract.bankAccount && (
                          <div>
                            <p className="font-semibold text-slate-500">계좌번호</p>
                            <p className="text-slate-900">{contract.bankAccount}</p>
                          </div>
                        )}
                        {contract.bankAccountHolder && (
                          <div>
                            <p className="font-semibold text-slate-500">예금주</p>
                            <p className="text-slate-900">{contract.bankAccountHolder}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* 계약서 서명 */}
                  {getSignatureUrl() && (
                    <section className="rounded-xl bg-gray-50 p-4">
                      <h4 className="text-lg font-bold text-slate-900 mb-4">계약서 서명</h4>
                      <div className="rounded-xl border-2 border-slate-200 bg-white p-6">
                        <div className="flex items-center justify-center">
                          <img
                            src={getSignatureUrl() || ''}
                            alt="나의 서명"
                            className="max-h-40 w-auto"
                          />
                        </div>
                      </div>
                    </section>
                  )}

                  {/* 필수 동의 확인 */}
                  <section className="rounded-xl bg-gray-50 p-4">
                    <h4 className="text-lg font-bold text-slate-900 mb-4">필수 동의 항목</h4>
                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentPrivacy ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        <FiCheckCircle className="text-lg" />
                        <span>개인정보 처리 동의</span>
                      </div>
                      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentNonCompete ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        <FiCheckCircle className="text-lg" />
                        <span>경업금지 조항 동의</span>
                      </div>
                      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentDbUse ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        <FiCheckCircle className="text-lg" />
                        <span>DB 활용 동의</span>
                      </div>
                      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentPenalty ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        <FiCheckCircle className="text-lg" />
                        <span>위약금 조항 동의</span>
                      </div>
                    </div>
                  </section>

                  {/* 계약 상태 */}
                  <section className="rounded-xl bg-gray-50 p-4">
                    <h4 className="text-lg font-bold text-slate-900 mb-4">계약 상태</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 border border-green-200">
                        <span className="font-semibold text-green-800">계약 상태</span>
                        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-bold text-white ${
                          contract.status === 'approved' || contract.status === 'completed'
                            ? 'bg-green-600' 
                            : contract.status === 'terminated'
                            ? 'bg-red-600'
                            : 'bg-yellow-600'
                        }`}>
                          <FiCheckCircle />
                          {contract.status === 'approved' || contract.status === 'completed' ? '승인 완료' : 
                           contract.status === 'terminated' ? '계약 해지' : '승인 대기 중'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                        <span className="font-semibold text-slate-700">계약 접수일</span>
                        <span className="text-slate-600">{dayjs(contract.submittedAt).format('YYYY년 MM월 DD일')}</span>
                      </div>
                      {contract.reviewedAt && (
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="font-semibold text-slate-700">승인일</span>
                          <span className="text-slate-600">{dayjs(contract.reviewedAt).format('YYYY년 MM월 DD일')}</span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* 계약서 PDF */}
                  {(contract as any).pdfUrl && (
                    <section className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                      <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <FiFileText className="text-blue-600" />
                        계약서 PDF
                      </h4>
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          완료된 계약서 PDF를 확인하실 수 있습니다.
                        </p>
                        <div className="flex gap-3">
                          <a
                            href={(contract as any).pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            <FiExternalLink className="w-4 h-4" />
                            PDF 보기
                          </a>
                          <a
                            href={(contract as any).pdfUrl}
                            download
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <FiFileText className="w-4 h-4" />
                            PDF 다운로드
                          </a>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FiFileText className="mx-auto text-6xl text-slate-300 mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">계약 정보 없음</h3>
                  <p className="text-slate-600">
                    승인된 계약이 없습니다.
                    <br />
                    계약서를 작성하신 경우 관리자 승인을 기다려주세요.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 px-6 py-4 rounded-b-3xl">
              <button
                onClick={() => setShowContractModal(false)}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 나의 SNS 프로필 링크 생성 컴포넌트
function LittlyLinkGenerator({ partnerId }: { partnerId: string }) {
  const [generating, setGenerating] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/partner/link/generate', {
        method: 'POST',
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || '링크 생성에 실패했습니다.');
      }

      setLinkUrl(json.url);
      showSuccess('링크가 생성되었습니다!');
    } catch (error: any) {
      console.error('[LittlyLinkGenerator] error:', error);
      showError(error.message || '링크 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = () => {
    if (linkUrl) {
      navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      showSuccess('링크가 복사되었습니다!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {linkUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <input
              type="text"
              value={linkUrl}
              readOnly
              className="flex-1 bg-transparent text-sm text-indigo-900 outline-none"
            />
            <button
              onClick={copyLink}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <FiCopy className="w-4 h-4" />
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-700 underline"
          >
            링크 미리보기 →
          </a>
        </div>
      ) : (
        <button
          onClick={generateLink}
          disabled={generating}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <span className="animate-spin">⏳</span>
              링크 생성 중...
            </>
          ) : (
            <>
              <FiLink className="w-5 h-5" />
              링크 생성하기
            </>
          )}
        </button>
      )}
    </div>
  );
}

// 갤러리 이미지 관리 컴포넌트
function GalleryImageManager({
  images,
  onUpload,
  onRemove,
  uploading,
}: {
  images: string[];
  onUpload: (index: number, file: File) => void;
  onRemove: (index: number) => void;
  uploading: boolean;
}) {
  const slots = Array(9).fill(null).map((_, i) => {
    const img = images[i];
    if (!img) return '';
    // 문자열이면 그대로 반환
    if (typeof img === 'string') {
      const trimmed = img.trim();
      // [object Object] 같은 잘못된 값 필터링
      if (trimmed.includes('[object Object]') || trimmed === '[object Object]' || !trimmed.startsWith('http')) {
        console.warn('[GalleryImageManager] Invalid image URL detected:', img);
        return '';
      }
      return trimmed;
    }
    // 객체면 url 필드 추출
    if (img && typeof img === 'object' && 'url' in img) {
      const url = (img as { url: any }).url;
      if (typeof url === 'string') {
        return url.trim();
      }
    }
    return '';
  });

  return (
    <div className="grid grid-cols-3 gap-3">
      {slots.map((imageUrl, index) => (
        <div key={index} className="relative aspect-square border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
          {imageUrl && typeof imageUrl === 'string' && imageUrl.trim() ? (
            <>
              <img
                src={imageUrl}
                alt={`Gallery ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[GalleryImageManager] 이미지 로드 실패:', imageUrl);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              >
                <FiX className="w-3 h-3" />
              </button>
            </>
          ) : (
            <label className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(index, file);
                  e.target.value = '';
                }}
                disabled={uploading}
                className="hidden"
              />
              <div className="text-center">
                <FiUpload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <span className="text-xs text-gray-500">업로드</span>
              </div>
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

// 대표 이미지(포스터) 관리 컴포넌트
function FeaturedImageManager({
  images,
  onUpload,
  onRemove,
  uploading,
}: {
  images: string[];
  onUpload: (index: number, file: File) => void;
  onRemove: (index: number) => void;
  uploading: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slots = Array(3).fill(null).map((_, i) => {
    const img = images[i];
    if (!img) return '';
    // 문자열이면 그대로 반환
    if (typeof img === 'string') {
      const trimmed = img.trim();
      // [object Object] 같은 잘못된 값 필터링
      if (trimmed.includes('[object Object]') || trimmed === '[object Object]' || !trimmed.startsWith('http')) {
        console.warn('[FeaturedImageManager] Invalid image URL detected:', img);
        return '';
      }
      return trimmed;
    }
    // 객체면 url 필드 추출
    if (img && typeof img === 'object' && 'url' in img) {
      const url = (img as { url: any }).url;
      if (typeof url === 'string') {
        return url.trim();
      }
    }
    return '';
  });

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(activeImages.length, 1));
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + Math.max(activeImages.length, 1)) % Math.max(activeImages.length, 1));
  };

  const activeImages = slots.filter((img): img is string => typeof img === 'string' && img.trim() !== '');

  return (
    <div className="space-y-4">
      {/* 캐러셀 미리보기 */}
      {activeImages.length > 0 && (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
          <img
            src={activeImages[currentIndex]}
            alt={`Featured ${currentIndex + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('[FeaturedImageManager] 이미지 로드 실패:', activeImages[currentIndex]);
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {activeImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {activeImages.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i === currentIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 업로드 슬롯 */}
      <div className="grid grid-cols-3 gap-3">
        {slots.map((imageUrl, index) => (
          <div key={index} className="relative aspect-video border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            {imageUrl && typeof imageUrl === 'string' && imageUrl.trim() ? (
              <>
                <img
                  src={imageUrl}
                  alt={`Featured ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('[FeaturedImageManager] 이미지 로드 실패:', imageUrl);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </>
            ) : (
              <label className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(index, file);
                    e.target.value = '';
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="text-center">
                  <FiUpload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <span className="text-xs text-gray-500">업로드</span>
                </div>
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 스마트폰 미리보기 컴포넌트
function MobilePreview({ profile }: { 
  profile: {
    displayName: string;
    bio: string;
    profileImage: string | null;
    kakaoLink: string | null;
    instagramHandle: string | null;
    youtubeChannel: string | null;
    blogLink: string | null;
    threadLink: string | null;
    customLinks: Array<{ label: string; url: string; isActive: boolean }>;
    galleryImages: string[];
    featuredImages: string[];
    youtubeVideoUrl: string | null;
    mallUserId?: string;
  }
}) {
  const [deviceType, setDeviceType] = useState<'iphone' | 'samsung'>('iphone');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [galleryModal, setGalleryModal] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const getInstagramUrl = (handle: string) => {
    if (handle.startsWith('http')) return handle;
    if (handle.startsWith('@')) return `https://instagram.com/${handle.slice(1)}`;
    return `https://instagram.com/${handle}`;
  };

  const getYoutubeUrl = (channel: string) => {
    if (channel.startsWith('http')) return channel;
    if (channel.startsWith('@')) return `https://youtube.com/${channel}`;
    return `https://youtube.com/@${channel}`;
  };

  const activeLinks: Array<{ label: string; url: string; icon: string }> = [];
  if (profile.kakaoLink) activeLinks.push({ label: '카카오톡', url: profile.kakaoLink, icon: '💬' });
  if (profile.threadLink) activeLinks.push({ label: '스레드', url: profile.threadLink, icon: '🧵' });
  if (profile.instagramHandle) activeLinks.push({ label: '인스타그램', url: getInstagramUrl(profile.instagramHandle), icon: '📷' });
  if (profile.blogLink) activeLinks.push({ label: '블로그', url: profile.blogLink, icon: '✍️' });
  if (profile.youtubeChannel) activeLinks.push({ label: '유튜브', url: getYoutubeUrl(profile.youtubeChannel), icon: '📺' });
  profile.customLinks.forEach(link => {
    if (link.isActive && link.label.trim() && link.url.trim()) {
      activeLinks.push({ label: link.label, url: link.url, icon: '🔗' });
    }
  });

  useEffect(() => {
    if (profile.featuredImages.length > 1) {
      const interval = setInterval(() => {
        setFeaturedIndex((prev) => (prev + 1) % profile.featuredImages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [profile.featuredImages.length]);

  // 판매몰 상품 로드
  useEffect(() => {
    const loadProducts = async () => {
      if (!profile.mallUserId) {
        setProductsLoading(false);
        return;
      }
      
      try {
        setProductsLoading(true);
        const res = await fetch(`/api/public/products?mallUserId=${profile.mallUserId}&limit=6`);
        const data = await res.json();
        if (data.ok && data.products) {
          setProducts(data.products);
        }
      } catch (error) {
        console.error('[MobilePreview] Failed to load products:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, [profile.mallUserId]);

  const getYoutubeVideoId = (url: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const youtubeVideoId = getYoutubeVideoId(profile.youtubeVideoUrl);

  return (
    <div className="space-y-6">
      {/* 디바이스 선택 */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => setDeviceType('iphone')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            deviceType === 'iphone'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📱 iPhone
        </button>
        <button
          onClick={() => setDeviceType('samsung')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            deviceType === 'samsung'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📱 Samsung
        </button>
      </div>

      {/* 스마트폰 프레임 */}
      <div className="flex justify-center">
        <div
          className={`relative ${
            deviceType === 'iphone'
              ? 'w-[375px] h-[812px] bg-black rounded-[3rem] p-2 shadow-2xl'
              : 'w-[360px] h-[800px] bg-gray-800 rounded-[2rem] p-2 shadow-2xl'
          }`}
        >
          {/* 노치/상단바 */}
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 ${
              deviceType === 'iphone'
                ? 'w-[150px] h-[30px] bg-black rounded-b-[1rem]'
                : 'w-full h-[24px] bg-gray-800'
            }`}
          />
          
          {/* 화면 */}
          <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative">
            <div className="w-full h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50">
                <div className="max-w-md mx-auto px-4 py-8">
                  {/* 1. 프로필 사진 */}
                  <div className="bg-white rounded-3xl shadow-xl p-6 mb-6 text-center">
                    {profile.profileImage ? (
                      <img
                        src={profile.profileImage}
                        alt={profile.displayName}
                        className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-purple-200"
                        onError={(e) => {
                          console.error('[MobilePreview] 프로필 이미지 로드 실패:', profile.profileImage);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-3xl font-bold">
                        {profile.displayName.charAt(0) || '?'}
                      </div>
                    )}
                    
                    {/* 2. 표시이름, 프로필 소개 */}
                    <h1 className="text-xl font-bold text-gray-900 mb-2">{profile.displayName || '이름 없음'}</h1>
                    {profile.bio && (
                      <p className="text-gray-600 text-xs">{profile.bio}</p>
                    )}
                  </div>

                  {/* 3. 대표 이미지 (릴스 사이즈 - 세로형 비율) */}
                  {profile.featuredImages.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-xl mb-6 overflow-hidden">
                      <div className="relative" style={{ aspectRatio: '9/16' }}>
                        <img
                          src={profile.featuredImages[featuredIndex]}
                          alt={`Featured ${featuredIndex + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('[MobilePreview] 이미지 로드 실패:', profile.featuredImages[featuredIndex]);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {profile.featuredImages.length > 1 && (
                          <>
                            <button
                              onClick={() => setFeaturedIndex((prev) => (prev - 1 + profile.featuredImages.length) % profile.featuredImages.length)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full"
                            >
                              <FiChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setFeaturedIndex((prev) => (prev + 1) % profile.featuredImages.length)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full"
                            >
                              <FiChevronRight className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                              {profile.featuredImages.map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    i === featuredIndex ? 'bg-white' : 'bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. 크루즈 사진 갤러리 (1:1 정사각형) */}
                  {profile.galleryImages.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-xl p-4 mb-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-3">크루즈 사진</h2>
                      <div className="grid grid-cols-3 gap-1.5">
                        {profile.galleryImages.map((imageUrl, index) => (
                          <button
                            key={index}
                            onClick={() => setGalleryModal({ open: true, index })}
                            className="aspect-square rounded-lg overflow-hidden"
                          >
                            <img
                              src={imageUrl}
                              alt={`Gallery ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('[MobilePreview] 갤러리 이미지 로드 실패:', imageUrl);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. 유튜브 동영상 */}
                  {youtubeVideoId && (
                    <div className="bg-white rounded-3xl shadow-xl p-4 mb-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-3">동영상</h2>
                      <div className="aspect-video rounded-lg overflow-hidden">
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* 6. 나의 판매몰 상품 정보 */}
                  {profile.mallUserId && (
                    <div className="bg-white rounded-3xl shadow-xl p-4 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <FiShoppingBag className="w-4 h-4 text-purple-600" />
                        <h2 className="text-lg font-bold text-gray-900">추천 상품</h2>
                      </div>
                      {productsLoading ? (
                        <div className="text-center py-4 text-gray-500 text-sm">로딩 중...</div>
                      ) : products.length > 0 ? (
                        <div className="space-y-2">
                          {products.slice(0, 3).map((product: any) => (
                            <a
                              key={product.id}
                              href={`/${profile.mallUserId}/shop/products/${product.productCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all"
                            >
                              <div className="flex gap-3">
                                {product.thumbnail && (
                                  <img
                                    src={product.thumbnail}
                                    alt={product.title}
                                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 text-xs mb-1 line-clamp-2">
                                    {product.title}
                                  </h3>
                                  {product.description && (
                                    <p className="text-xs text-gray-600 mb-1.5 line-clamp-1">
                                      {product.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1 text-[10px] text-gray-500">
                                    {product.cruiseLine && (
                                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">🚢 {product.cruiseLine.split('(')[0].trim()}</span>
                                    )}
                                    {product.departurePort && (
                                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">📍 {product.departurePort}</span>
                                    )}
                                    {product.duration && (
                                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">⏱️ {product.duration}박</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </a>
                          ))}
                          
                          {/* 7. 전체 상품 보기 */}
                          <a
                            href={`/${profile.mallUserId}/shop`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center py-2 text-purple-600 font-semibold text-sm hover:text-purple-700"
                          >
                            전체 상품 보기 →
                          </a>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          등록된 상품이 없습니다.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 8. SNS 링크들 */}
                  {activeLinks.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-xl p-4 mb-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-3">연결하기</h2>
                      <div className="space-y-2">
                        {activeLinks.map((link, index) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                          >
                            <span>{link.icon}</span>
                            <span>{link.label}</span>
                            <FiExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 갤러리 모달 */}
      {galleryModal.open && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setGalleryModal({ open: false, index: 0 })}
        >
          <button
            onClick={() => setGalleryModal({ open: false, index: 0 })}
            className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full"
          >
            <FiX className="w-5 h-5" />
          </button>
          {profile.galleryImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryModal({
                    open: true,
                    index: (galleryModal.index - 1 + profile.galleryImages.length) % profile.galleryImages.length,
                  });
                }}
                className="absolute left-4 p-2 bg-white/20 text-white rounded-full"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryModal({
                    open: true,
                    index: (galleryModal.index + 1) % profile.galleryImages.length,
                  });
                }}
                className="absolute right-4 p-2 bg-white/20 text-white rounded-full"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          <img
            src={profile.galleryImages[galleryModal.index]}
            alt={`Gallery ${galleryModal.index + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
