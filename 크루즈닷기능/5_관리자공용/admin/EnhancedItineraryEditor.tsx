// components/admin/EnhancedItineraryEditor.tsx
// 향상된 여행일정 에디터 (Day별 블록, 그룹 저장/불러오기)

'use client';

import { logger } from '@/lib/logger';
import { csrfFetch, getCsrfToken } from '@/lib/csrf-client';
import { showSuccess, showError, showConfirm } from '@/components/ui/Toast';
import { useState, useEffect, useMemo, useCallback, useReducer } from 'react';
import { useApiCache } from '@/lib/hooks/useApiCache';
import { useItineraryReducer } from '@/lib/hooks/useItineraryReducer';
import { FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiSave, FiFolder, FiImage, FiVideo, FiFileText, FiX, FiSearch, FiUpload, FiMapPin } from 'react-icons/fi';
import { ContentBlock } from './ProductDetailEditor';
import countries from '@/data/countries.json';

export interface EnhancedItineraryDay {
  day: number;
  emoji?: string; // 왼쪽 이모티콘
  // 관광지 도착지 (크루즈 가이드 지니 연동)
  arrivalLocation?: string; // 관광지 도착지 텍스트 (한국어 도시명)
  arrivalCountry?: string; // 도착지 국가코드 (예: JP, TW, VN)
  arrivalCountryName?: string; // 도착지 국가명 (예: 일본, 대만, 베트남)
  portArrivalTime?: string; // 입항 시간 (HH:MM 형식) - 크루즈 가이드 지니 내일예정에 표시
  portDepartureTime?: string; // 출항 시간 (HH:MM 형식)
  // 일정 시작
  scheduleStartTime?: string; // 시간
  scheduleStartTitle?: string; // 일정제목 텍스트
  tourImages?: string[]; // 관광이미지 첨부
  tourText?: string; // 관광 텍스트
  // 일정 마무리
  scheduleEndTime?: string; // 시간
  scheduleEndTitle?: string; // 일정마무리 텍스트
  // 숙박
  accommodation?: string; // 숙박 어디에 텍스트
  accommodationImage?: string; // 숙박 사진 첨부 (하위 호환용 단일 이미지)
  accommodationImages?: string[]; // 숙박 사진 여러 장
  // 식사
  breakfast?: '선상식' | '호텔식' | '현지식' | '정찬식' | '기내식' | '자유식' | '한식';
  lunch?: '선상식' | '호텔식' | '현지식' | '정찬식' | '기내식' | '자유식' | '한식';
  dinner?: '선상식' | '호텔식' | '현지식' | '정찬식' | '기내식' | '자유식' | '한식';
  // 기존 필드 (하위 호환성)
  departure?: string; // 출발지
  arrival?: string; // 도착지
  departureTime?: string; // 출발 시간
  arrivalTime?: string; // 도착 시간
  attractions?: string[]; // 관광지 목록
  blocks: ContentBlock[]; // 이미지, 동영상, 텍스트 블록
}

interface EditorLoadingState {
  cruiseFolders?: boolean;
  cruiseImages?: boolean;
  googleDriveFolders?: boolean;
  googleDriveImages?: boolean;
  dayBlocks?: boolean;
  upload?: boolean;
}

interface EditorErrorState {
  cruiseFolders?: string;
  cruiseImages?: string;
  googleDriveFolders?: string;
  googleDriveImages?: string;
  upload?: string;
  dayBlocks?: string;
}

interface EnhancedItineraryEditorProps {
  days: EnhancedItineraryDay[];
  onChange: (days: EnhancedItineraryDay[]) => void;
  nights?: number; // O박
  totalDays?: number; // O일
  flightInfo?: any; // 항공 정보
  onAutoGenerate?: () => void; // 자동 생성 콜백
}

export default function EnhancedItineraryEditor({
  days,
  onChange,
  nights,
  totalDays,
  flightInfo,
  onAutoGenerate
}: EnhancedItineraryEditorProps) {
  // Step 2: useReducer로 26개 useState 통합
  const [state, dispatch] = useItineraryReducer();

  // Alias for compatibility with existing code
  const {
    expandedDay,
    showGroupManager,
    savedGroups,
    newGroupName,
    showCruisePhotoModal,
    cruiseFolders,
    selectedFolder,
    cruiseImages,
    searchTerm,
    selectingForDay,
    selectingForBlockIndex,
    multiSelectMode,
    selectedCruiseImages,
    showGoogleDriveModal,
    googleDriveFolders,
    selectedGoogleDriveFolder,
    googleDriveImages,
    googleDriveSearchTerm,
    selectedGoogleDriveImageUrls,
    showPPTUpload,
    uploadingPPT,
    destinationSearch,
    loadingStates,
    errorStates
  } = state;

  // Map old loading/error state interface to new format
  const loadingState: EditorLoadingState = {
    cruiseFolders: loadingStates['cruiseFolders'],
    cruiseImages: loadingStates['cruiseImages'],
    googleDriveFolders: loadingStates['googleDriveFolders'],
    googleDriveImages: loadingStates['googleDriveImages'],
    dayBlocks: loadingStates['dayBlocks'],
    upload: loadingStates['upload']
  };

  const errorState: EditorErrorState = {
    cruiseFolders: errorStates['cruiseFolders'],
    cruiseImages: errorStates['cruiseImages'],
    googleDriveFolders: errorStates['googleDriveFolders'],
    googleDriveImages: errorStates['googleDriveImages'],
    upload: errorStates['upload'],
    dayBlocks: errorStates['dayBlocks']
  };

  // Picker modes (combine 3 into pickerMode)
  const showEmojiPicker = state.pickerMode === 'emoji' ? state.expandedDay : null;
  const showAccommodationImagePicker = state.pickerMode === 'accommodation' ? state.selectingForDay : null;
  const showTourImagePicker = state.pickerMode === 'tour' ? state.selectingForDay : null;

  // 여행 관련 이모티콘 60개
  const TRAVEL_EMOJIS = [
    '✈️', '🚢', '🏖️', '🌴', '🏝️', '🗺️', '🎒', '🧳', '📷', '🌅',
    '🌄', '🌊', '⛰️', '🏔️', '🌋', '🏜️', '🏕️', '⛺', '🏨', '🏰',
    '🗼', '🗽', '🏛️', '⛩️', '🕌', '🕍', '⛪', '🕋', '🎪', '🎡',
    '🎢', '🎠', '🌉', '🌁', '🌆', '🌇', '🌃', '🌌', '🌠', '⭐',
    '🌟', '💫', '🌈', '☀️', '🌙', '🌍', '🌎', '🌏', '🗾', '🏞️',
    '🌲', '🌳', '🌵', '🌿', '🍀', '🌾', '🌺', '🌻', '🌷', '🌹'
  ];

  // 식사 타입 옵션
  const MEAL_TYPES: Array<'선상식' | '호텔식' | '현지식' | '정찬식' | '기내식' | '자유식' | '한식'> = [
    '선상식', '호텔식', '현지식', '정찬식', '기내식', '자유식', '한식'
  ];

  // 도착지 옵션 (국가 + 지역) - countries.json에서 생성
  const destinationOptions = useMemo(() => {
    const options: { value: string; label: string; country: string; countryCode: string; city: string }[] = [];

    // 특수 옵션 추가
    options.push({ value: 'sea', label: '🚢 해상 (종일 항해)', country: '', countryCode: '', city: '해상' });

    (countries as any[]).forEach(cont => {
      (cont?.countries || []).forEach((c: any) => {
        const countryName = c?.name;
        const countryCode = c?.code || '';
        if (!countryName) return;

        // "일본 (Japan)" 형식에서 한국어 이름만 추출
        const koreanCountry = countryName.split(' (')[0].trim();

        // 지역이 있는 경우
        if (Array.isArray(c?.regions)) {
          c.regions.forEach((r: string) => {
            // "후쿠오카 (Fukuoka)" 형식에서 한국어만 추출
            const koreanCity = r.split(' (')[0].trim();
            options.push({
              value: `${koreanCountry}-${koreanCity}`,
              label: `${koreanCountry} - ${koreanCity}`,
              country: koreanCountry,
              countryCode: countryCode,
              city: koreanCity
            });
          });
        }

        // 국가만 있는 옵션도 추가
        options.push({
          value: koreanCountry,
          label: koreanCountry,
          country: koreanCountry,
          countryCode: countryCode,
          city: koreanCountry
        });
      });
    });

    // 중복 제거
    const map = new Map<string, typeof options[0]>();
    options.forEach(o => map.set(o.value, o));
    return Array.from(map.values());
  }, []);


  // 크루즈 폴더 API 캐싱 (1시간 TTL)
  const cruiseFoldersCache = useApiCache(
    useCallback(async () => {
      const res = await fetch('/api/admin/cruise-photos', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('폴더 로드 실패');
      const data = await res.json();
      if (!data.ok || !data.folders) throw new Error('폴더 로드 실패');
      return data.folders.map((f: { name: string }) => f.name);
    }, []),
    { ttl: 3600000 } // 1시간
  );

  // 크루즈 이미지 API 캐싱 (30분 TTL, folder별 캐시)
  const cruiseImagesCache = useApiCache(
    useCallback(async () => {
      if (!selectedFolder) return [];
      const res = await fetch(`/api/admin/cruise-photos?folder=${encodeURIComponent(selectedFolder)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('이미지 로드 실패');
      const data = await res.json();
      if (!data.ok || !data.images) throw new Error('이미지 로드 실패');
      return data.images.map((img: { url: string }) => img.url);
    }, [selectedFolder]),
    { ttl: 1800000 } // 30분
  );

  // 크루즈정보사진 폴더 목록 로드
  const loadCruiseFolders = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'cruiseFolders', value: true } });
    dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'cruiseFolders', value: undefined } });
    try {
      const folders = await cruiseFoldersCache.refetch();
      dispatch({ type: 'SET_CRUISE_FOLDERS', payload: folders });
      dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'cruiseFolders', value: undefined } });
    } catch (error) {
      logger.error('Failed to load cruise folders:', error);
      dispatch({ type: 'SET_CRUISE_FOLDERS', payload: [] });
      dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'cruiseFolders', value: '폴더 로드 중 오류 발생' } });
    } finally {
      dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'cruiseFolders', value: false } });
    }
  }, [cruiseFoldersCache, dispatch]);

  useEffect(() => {
    if (showCruisePhotoModal) {
      loadCruiseFolders();
    }
  }, [showCruisePhotoModal, loadCruiseFolders]);

  const loadCruiseImages = useCallback(async (folder: string) => {
    dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'cruiseImages', value: true } });
    dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'cruiseImages', value: undefined } });
    try {
      const res = await fetch(`/api/admin/cruise-photos?folder=${encodeURIComponent(folder)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('이미지 로드 실패');
      const data = await res.json();
      if (!data.ok || !data.images) throw new Error('이미지 로드 실패');
      const images = data.images.map((img: { url: string }) => img.url);
      dispatch({ type: 'SET_CRUISE_IMAGES', payload: images });
      dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'cruiseImages', value: undefined } });
    } catch (error) {
      logger.error('Failed to load cruise images:', error);
      dispatch({ type: 'SET_CRUISE_IMAGES', payload: [] });
      dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'cruiseImages', value: '이미지 로드 중 오류 발생' } });
    } finally {
      dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'cruiseImages', value: false } });
    }
  }, [dispatch]);

  const updateDay = useCallback((day: number, updates: Partial<EnhancedItineraryDay>) => {
    const updated = days.map(d => d.day === day ? { ...d, ...updates } : d);
    onChange(updated);
  }, [days, onChange]);

  const updateBlock = (dayNumber: number, blockIndex: number, updates: Partial<ContentBlock>) => {
    const updated = days.map(d => {
      if (d.day === dayNumber) {
        const newBlocks = [...d.blocks];
        newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...updates } as ContentBlock;
        return { ...d, blocks: newBlocks };
      }
      return d;
    });
    onChange(updated);
  };

  const handleSelectCruiseImage = useCallback((imageUrl: string) => {
    if (multiSelectMode) {
      // 복수 선택 모드: 선택된 이미지 토글
      dispatch({ type: 'TOGGLE_CRUISE_IMAGE_SELECTION', payload: imageUrl });
    } else if (showTourImagePicker !== null) {
      // 관광이미지에 추가
      const day = days.find(d => d.day === showTourImagePicker);
      if (day) {
        updateDay(showTourImagePicker, {
          tourImages: [...(day.tourImages || []), imageUrl]
        });
      }
      dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
      dispatch({ type: 'SET_PICKER_MODE', payload: null });
      dispatch({ type: 'SET_SELECTED_FOLDER', payload: '' });
      dispatch({ type: 'SET_CRUISE_IMAGES', payload: [] });
      dispatch({ type: 'SET_SEARCH_TERM', payload: '' });
    } else if (showAccommodationImagePicker !== null) {
      // 숙박 사진 배열에 추가
      const targetDay = days.find(d => d.day === showAccommodationImagePicker);
      updateDay(showAccommodationImagePicker, {
        accommodationImages: [...(targetDay?.accommodationImages || []), imageUrl]
      });
      dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
      dispatch({ type: 'SET_PICKER_MODE', payload: null });
      dispatch({ type: 'SET_SELECTED_FOLDER', payload: '' });
      dispatch({ type: 'SET_CRUISE_IMAGES', payload: [] });
      dispatch({ type: 'SET_SEARCH_TERM', payload: '' });
    } else if (selectingForDay !== null && selectingForBlockIndex !== null) {
      // 기존 블록에 설정
      updateBlock(selectingForDay, selectingForBlockIndex, { url: imageUrl });
      dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
      dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: null, blockIndex: null } });
      dispatch({ type: 'SET_SELECTED_FOLDER', payload: '' });
      dispatch({ type: 'SET_CRUISE_IMAGES', payload: [] });
      dispatch({ type: 'SET_SEARCH_TERM', payload: '' });
    }
  }, [multiSelectMode, showTourImagePicker, showAccommodationImagePicker, selectingForDay, selectingForBlockIndex, days, updateDay, updateBlock, dispatch]);

  // 크루즈사진 복수 선택 완료 (여행일정용)
  const handleConfirmCruiseMultiSelect = useCallback(() => {
    if (selectedCruiseImages.length === 0 || selectingForDay === null) return;

    const day = days.find(d => d.day === selectingForDay);
    if (!day) return;

    // 선택된 이미지들을 블록으로 추가
    const newBlocks: ContentBlock[] = selectedCruiseImages.map((url, index) => ({
      type: 'image' as const,
      id: `block-${Date.now()}-${index}`,
      url,
      alt: ''
    }));

    const updatedBlocks = [...(day.blocks || []), ...newBlocks];
    updateDay(selectingForDay, { blocks: updatedBlocks });

    showSuccess(`${selectedCruiseImages.length}개의 이미지가 추가되었습니다.`);

    // 상태 초기화
    dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
    dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: null, blockIndex: null } });
    dispatch({ type: 'SET_SELECTED_FOLDER', payload: '' });
    dispatch({ type: 'SET_CRUISE_IMAGES', payload: [] });
    dispatch({ type: 'SET_SEARCH_TERM', payload: '' });
    dispatch({ type: 'SET_MULTI_SELECT_MODE', payload: false });
    dispatch({ type: 'CLEAR_CRUISE_IMAGE_SELECTION' });
  }, [selectedCruiseImages, selectingForDay, days, updateDay, dispatch]);

  const filteredFolders = cruiseFolders.filter(folder =>
    folder.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Google Drive 폴더 API 캐싱 (1시간 TTL)
  const googleDriveFoldersCache = useApiCache(
    useCallback(async () => {
      const res = await fetch('/api/admin/mall/google-drive-products?listFolders=true', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('폴더 로드 실패');
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.folders)) throw new Error('폴더 로드 실패');
      return data.folders;
    }, []),
    { ttl: 3600000 } // 1시간
  );

  const loadGoogleDriveFolders = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'googleDriveFolders', value: true } });
    dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveFolders', value: undefined } });
    try {
      const folders = await googleDriveFoldersCache.refetch();
      dispatch({ type: 'SET_GOOGLE_DRIVE_FOLDERS', payload: folders });
      dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveFolders', value: undefined } });
    } catch (error) {
      logger.error('구글 드라이브 폴더 로드 실패:', error);
      dispatch({ type: 'SET_GOOGLE_DRIVE_FOLDERS', payload: [] });
      dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveFolders', value: '폴더 로드 중 오류 발생' } });
    } finally {
      dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'googleDriveFolders', value: false } });
    }
  }, [googleDriveFoldersCache, dispatch]);

  // 구글 드라이브 모달 열릴 때 폴더 목록 로드
  useEffect(() => {
    if (showGoogleDriveModal) {
      loadGoogleDriveFolders();
    }
  }, [showGoogleDriveModal, loadGoogleDriveFolders]);

  const loadGoogleDriveImages = useCallback(async (folderId?: string) => {
    dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'googleDriveImages', value: true } });
    dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveImages', value: undefined } });
    try {
      const url = folderId
        ? `/api/admin/mall/google-drive-products?folderId=${encodeURIComponent(folderId)}`
        : '/api/admin/mall/google-drive-products';
      const res = await fetch(url, {
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        logger.error('[Google Drive] Failed to load images:', errorData);
        dispatch({ type: 'SET_GOOGLE_DRIVE_IMAGES', payload: [] });
        dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveImages', value: '서버 연결 실패' } });
        return;
      }

      const data = await res.json();
      if (data.ok) {
        if (data.images && Array.isArray(data.images)) {
          dispatch({ type: 'SET_GOOGLE_DRIVE_IMAGES', payload: data.images });
          dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveImages', value: undefined } });
        } else {
          dispatch({ type: 'SET_GOOGLE_DRIVE_IMAGES', payload: [] });
          dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveImages', value: '이미지 로드 실패' } });
        }
      } else {
        logger.error('[Google Drive] API returned error:', data.error);
        dispatch({ type: 'SET_GOOGLE_DRIVE_IMAGES', payload: [] });
        dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveImages', value: '이미지 로드 실패' } });
      }
    } catch (error: any) {
      logger.error('구글 드라이브 이미지 로드 에러:', error);
      dispatch({ type: 'SET_GOOGLE_DRIVE_IMAGES', payload: [] });
      dispatch({ type: 'SET_ERROR_STATE', payload: { key: 'googleDriveImages', value: '이미지 로드 중 오류 발생' } });
    } finally {
      dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'googleDriveImages', value: false } });
    }
  }, [dispatch]);

  const handleSelectGoogleDriveImage = useCallback((imageUrl: string) => {
    if (multiSelectMode) {
      // 복수 선택 모드: 선택된 이미지 토글
      dispatch({ type: 'TOGGLE_GOOGLE_DRIVE_IMAGE_SELECTION', payload: imageUrl });
    } else if (selectingForDay !== null && selectingForBlockIndex !== null) {
      // 단일 선택 모드: 기존 동작
      updateBlock(selectingForDay, selectingForBlockIndex, { url: imageUrl });
      dispatch({ type: 'TOGGLE_GOOGLE_DRIVE_MODAL' });
      dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: null, blockIndex: null } });
      dispatch({ type: 'SET_SELECTED_GOOGLE_DRIVE_FOLDER', payload: '' });
      dispatch({ type: 'SET_GOOGLE_DRIVE_IMAGES', payload: [] });
      dispatch({ type: 'SET_GOOGLE_DRIVE_SEARCH_TERM', payload: '' });
    }
  }, [multiSelectMode, selectingForDay, selectingForBlockIndex, updateBlock, dispatch]);

  // 구글드라이브 복수 선택 완료 (여행일정용)
  const handleConfirmGoogleDriveMultiSelect = useCallback(() => {
    if (selectedGoogleDriveImageUrls.length === 0 || selectingForDay === null) return;

    const day = days.find(d => d.day === selectingForDay);
    if (!day) return;

    // 선택된 이미지들을 블록으로 추가
    const newBlocks: ContentBlock[] = selectedGoogleDriveImageUrls.map((url, index) => ({
      type: 'image' as const,
      id: `block-${Date.now()}-${index}`,
      url,
      alt: ''
    }));

    const updatedBlocks = [...(day.blocks || []), ...newBlocks];
    updateDay(selectingForDay, { blocks: updatedBlocks });

    showSuccess(`${selectedGoogleDriveImageUrls.length}개의 이미지가 추가되었습니다.`);

    // 상태 초기화
    dispatch({ type: 'TOGGLE_GOOGLE_DRIVE_MODAL' });
    dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: null, blockIndex: null } });
    dispatch({ type: 'SET_SELECTED_GOOGLE_DRIVE_FOLDER', payload: '' });
    dispatch({ type: 'SET_GOOGLE_DRIVE_IMAGES', payload: [] });
    dispatch({ type: 'SET_GOOGLE_DRIVE_SEARCH_TERM', payload: '' });
    dispatch({ type: 'SET_MULTI_SELECT_MODE', payload: false });
    dispatch({ type: 'CLEAR_GOOGLE_DRIVE_IMAGE_SELECTION' });
  }, [selectedGoogleDriveImageUrls, selectingForDay, days, updateDay, dispatch]);

  const filteredGoogleDriveFolders = googleDriveFolders.filter(folder =>
    folder.name.toLowerCase().includes(googleDriveSearchTerm.toLowerCase())
  );

  // 여행일정 그룹 API 캐싱 (30분 TTL)
  const itineraryGroupsCache = useApiCache(
    useCallback(async () => {
      const res = await fetch('/api/admin/itinerary-groups', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('그룹 로드 실패');
      const data = await res.json();
      if (!data.ok) throw new Error('그룹 로드 실패');
      return data.groups || [];
    }, []),
    { ttl: 1800000 } // 30분
  );

  const loadGroups = useCallback(async () => {
    try {
      const groups = await itineraryGroupsCache.refetch();
      dispatch({ type: 'SET_SAVED_GROUPS', payload: groups });
    } catch (error) {
      logger.error('Failed to load groups:', error);
      dispatch({ type: 'SET_SAVED_GROUPS', payload: [] });
    }
  }, [itineraryGroupsCache, dispatch]);

  // 그룹 목록 로드
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // O박 O일 입력 시 자동으로 블록 생성
  useEffect(() => {
    if (totalDays && totalDays > 0) {
      // 기존 일정이 없거나, 일정 개수가 totalDays와 다를 때만 업데이트
      if (days.length === 0) {
        const newDays: EnhancedItineraryDay[] = [];
        for (let i = 1; i <= totalDays; i++) {
          newDays.push({
            day: i,
            blocks: []
          });
        }
        onChange(newDays);
      } else if (days.length < totalDays) {
        // 일정이 부족하면 추가
        const newDays = [...days];
        for (let i = days.length + 1; i <= totalDays; i++) {
          newDays.push({
            day: i,
            blocks: []
          });
        }
        onChange(newDays);
      } else if (days.length > totalDays) {
        // 일정이 많으면 제거
        const newDays = days.slice(0, totalDays).map((d, idx) => ({ ...d, day: idx + 1 }));
        onChange(newDays);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDays]);

  // 항공 정보 기반 자동 일정 생성
  const generateFromFlightInfo = () => {
    if (!flightInfo) {
      showError('항공 정보가 없습니다. 먼저 항공 정보를 입력해주세요.');
      return;
    }

    const { departure, return: returnFlight, travelPeriod } = flightInfo;
    if (!departure || !returnFlight) {
      showError('출발/도착 항공 정보가 필요합니다.');
      return;
    }

    const newDays: EnhancedItineraryDay[] = [];

    // 출발일부터 시작
    const startDate = departure.date ? new Date(departure.date) : new Date();

    for (let i = 1; i <= (totalDays || 1); i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i - 1);

      const dayInfo: EnhancedItineraryDay = {
        day: i,
        blocks: []
      };

      // 첫날: 출발
      if (i === 1) {
        dayInfo.departure = departure.origin || '';
        dayInfo.arrival = departure.destination || '';
        dayInfo.departureTime = departure.departureTime || '';
        dayInfo.arrivalTime = departure.arrivalTime || '';
      }
      // 마지막날: 귀국
      else if (i === totalDays) {
        dayInfo.departure = returnFlight.origin || '';
        dayInfo.arrival = returnFlight.destination || '';
        dayInfo.departureTime = returnFlight.departureTime || '';
        dayInfo.arrivalTime = returnFlight.arrivalTime || '';
      }
      // 중간날: 크루즈 일정
      else {
        dayInfo.departure = '';
        dayInfo.arrival = '';
      }

      newDays.push(dayInfo);
    }

    onChange(newDays);
    if (onAutoGenerate) {
      onAutoGenerate();
    }
    showSuccess(`${totalDays}일 일정이 항공 정보를 기반으로 생성되었습니다.`);
  };

  // PPT 업로드 및 파싱
  const handlePPTUpload = useCallback(async (file: File) => {
    dispatch({ type: 'SET_UPLOADING_PPT', payload: true });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'ppt');

      const res = await fetch('/api/admin/parse-ppt', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.itinerary) {
          // 파싱된 일정을 적용
          const parsedDays: EnhancedItineraryDay[] = data.itinerary.map((day: any, index: number) => ({
            day: index + 1,
            departure: day.departure || '',
            arrival: day.arrival || '',
            departureTime: day.departureTime || '',
            arrivalTime: day.arrivalTime || '',
            attractions: day.attractions || [],
            blocks: day.blocks || []
          }));

          onChange(parsedDays);
          dispatch({ type: 'TOGGLE_PPT_UPLOAD' });
          showSuccess('PPT 문서에서 일정을 불러왔습니다.');
        } else {
          showError(`PPT 파싱 실패: ${data.error || '알 수 없는 오류'}`);
        }
      } else {
        showError('PPT 업로드에 실패했습니다.');
      }
    } catch (error) {
      logger.error('Failed to upload PPT:', error);
      showError('PPT 업로드 중 오류가 발생했습니다.');
    } finally {
      dispatch({ type: 'SET_UPLOADING_PPT', payload: false });
    }
  }, [onChange, dispatch]);

  const addDay = useCallback(() => {
    const newDay: EnhancedItineraryDay = {
      day: days.length + 1,
      blocks: []
    };
    onChange([...days, newDay]);
    dispatch({ type: 'TOGGLE_DAY', payload: newDay.day });
  }, [days, onChange, dispatch]);

  const removeDay = useCallback((day: number) => {
    showConfirm('이 Day를 삭제하시겠습니까?').then((confirmed) => {
      if (!confirmed) return;
      const filtered = days.filter(d => d.day !== day);
      const reordered = filtered.map((d, idx) => ({ ...d, day: idx + 1 }));
      onChange(reordered);
    });
  }, [days, onChange]);

  const moveDay = (day: number, direction: 'up' | 'down') => {
    const index = days.findIndex(d => d.day === day);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const newDays = [...days];
      [newDays[index], newDays[index - 1]] = [newDays[index - 1], newDays[index]];
      const reordered = newDays.map((d, idx) => ({ ...d, day: idx + 1 }));
      onChange(reordered);
    } else if (direction === 'down' && index < days.length - 1) {
      const newDays = [...days];
      [newDays[index], newDays[index + 1]] = [newDays[index + 1], newDays[index]];
      const reordered = newDays.map((d, idx) => ({ ...d, day: idx + 1 }));
      onChange(reordered);
    }
  };

  const addBlock = (dayNumber: number, type: 'image' | 'video' | 'text') => {
    const newBlock: ContentBlock =
      type === 'image'
        ? { type: 'image', id: `block-${Date.now()}`, url: '', alt: '' }
        : type === 'video'
          ? { type: 'video', id: `block-${Date.now()}`, url: '', title: '' }
          : { type: 'text', id: `block-${Date.now()}`, content: '' };

    const updated = days.map(d =>
      d.day === dayNumber
        ? { ...d, blocks: [...d.blocks, newBlock] }
        : d
    );
    onChange(updated);
  };

  const removeBlock = (dayNumber: number, blockIndex: number) => {
    showConfirm('이 블록을 삭제하시겠습니까?').then((confirmed) => {
      if (!confirmed) return;
      const updated = days.map(d => {
        if (d.day === dayNumber) {
          return { ...d, blocks: d.blocks.filter((_, i) => i !== blockIndex) };
        }
        return d;
      });
      onChange(updated);
    });
  };

  const addAttraction = (dayNumber: number, attraction: string) => {
    if (!attraction.trim()) return;
    const updated = days.map(d => {
      if (d.day === dayNumber) {
        return { ...d, attractions: [...(d.attractions || []), attraction.trim()] };
      }
      return d;
    });
    onChange(updated);
  };

  const removeAttraction = (dayNumber: number, index: number) => {
    const updated = days.map(d => {
      if (d.day === dayNumber) {
        return { ...d, attractions: d.attractions?.filter((_, i) => i !== index) || [] };
      }
      return d;
    });
    onChange(updated);
  };

  const saveAsGroup = useCallback(async () => {
    if (!newGroupName.trim()) {
      showError('그룹 이름을 입력하세요.');
      return;
    }

    try {
      const res = await csrfFetch('/api/admin/itinerary-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: `${days.length}일 일정`,
          itinerary: days
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        showSuccess('그룹이 저장되었습니다.');
        dispatch({ type: 'SET_NEW_GROUP_NAME', payload: '' });
        dispatch({ type: 'TOGGLE_GROUP_MANAGER' });
        itineraryGroupsCache.invalidate();
        loadGroups();
      } else {
        showError(`저장 실패: ${(data as { error?: string }).error || '서버 오류가 발생했습니다.'}`);
      }
    } catch (error) {
      logger.error('Failed to save group:', error);
      showError('그룹 저장에 실패했습니다.');
    }
  }, [newGroupName, days, loadGroups, itineraryGroupsCache, dispatch]);

  const loadGroup = useCallback(async (groupId: number) => {
    try {
      const res = await fetch(`/api/admin/itinerary-groups/${groupId}`, {
        credentials: 'include'
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.group) {
        const parsedItinerary = typeof data.group.itinerary === 'string'
          ? JSON.parse(data.group.itinerary)
          : data.group.itinerary;

        if (Array.isArray(parsedItinerary)) {
          onChange(parsedItinerary);
          showSuccess('그룹이 불러와졌습니다.');
          dispatch({ type: 'TOGGLE_GROUP_MANAGER' });
        }
      } else {
        showError(`그룹 불러오기 실패: ${(data as { error?: string }).error || '서버 오류가 발생했습니다.'}`);
      }
    } catch (error) {
      logger.error('Failed to load group:', error);
      showError('그룹 불러오기에 실패했습니다.');
    }
  }, [onChange, dispatch]);

  const handleFileUpload = async (dayNumber: number, blockIndex: number, file: File, type: 'image' | 'video') => {
    if (type === 'image') {
      const baseFilename = file.name.replace(/\.[^/.]+$/, '');
      await uploadFile(dayNumber, blockIndex, file, type, '일정이미지', baseFilename);
    } else {
      await uploadFile(dayNumber, blockIndex, file, type);
    }
  };

  const uploadFile = async (dayNumber: number, blockIndex: number, file: File, type: 'image' | 'video', category?: string, filename?: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (category) {
        formData.append('category', category);
      }
      if (filename) {
        formData.append('filename', filename);
      }

      const res = await fetch('/api/admin/mall/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          updateBlock(dayNumber, blockIndex, { url: data.url });
        }
      }
    } catch (error) {
      logger.error('Failed to upload file:', error);
      showError('파일 업로드에 실패했습니다.');
    }
  };

  const handleTourImageUpload = async (dayNumber: number, file: File) => {
    const baseFilename = file.name.replace(/\.[^/.]+$/, '');
    await uploadTourImage(dayNumber, file, '관광지이미지', baseFilename);
  };

  const handleAccommodationImageUpload = async (dayNumber: number, file: File) => {
    const baseFilename = file.name.replace(/\.[^/.]+$/, '');
    await uploadAccommodationImage(dayNumber, file, '숙소이미지', baseFilename);
  };

  const uploadTourImage = useCallback(async (dayNumber: number, file: File, category: string, filename: string) => {
    dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'upload', value: true } });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');
      formData.append('category', category);
      formData.append('filename', filename);

      const res = await fetch('/api/admin/mall/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCsrfToken() || '' },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const day = days.find(d => d.day === dayNumber);
          if (day) {
            const updatedDays = days.map(d =>
              d.day === dayNumber
                ? { ...d, tourImages: [...(d.tourImages || []), data.url] }
                : d
            );
            onChange(updatedDays);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to upload tour image:', error);
      showError('파일 업로드에 실패했습니다.');
    } finally {
      dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'upload', value: false } });
    }
  }, [days, onChange, dispatch]);

  const uploadAccommodationImage = useCallback(async (dayNumber: number, file: File, category: string, filename: string) => {
    dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'upload', value: true } });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');
      formData.append('category', category);
      formData.append('filename', filename);

      const res = await fetch('/api/admin/mall/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCsrfToken() || '' },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const updatedDays = days.map(d =>
            d.day === dayNumber
              ? { ...d, accommodationImages: [...(d.accommodationImages || []), data.url] }
              : d
          );
          onChange(updatedDays);
        }
      }
    } catch (error) {
      logger.error('Failed to upload accommodation image:', error);
      showError('파일 업로드에 실패했습니다.');
    } finally {
      dispatch({ type: 'SET_LOADING_STATE', payload: { key: 'upload', value: false } });
    }
  }, [days, onChange, dispatch]);

  return (
    <div className="space-y-4">
      {/* 에러 표시 */}
      {(errorState.dayBlocks || errorState.upload) && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-700 font-medium">⚠️ {errorState.dayBlocks || errorState.upload}</span>
          </div>
          <button
            onClick={() => dispatch({ type: 'CLEAR_ERROR_STATES' })}
            className="text-red-600 hover:text-red-800 text-xl"
            title="닫기"
          >
            ✕
          </button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-4">
        <h3 className="text-lg font-bold text-gray-900">여행일정</h3>
        <div className="flex gap-2 flex-wrap max-sm:flex-col max-sm:w-full">
          {nights && totalDays && (
            <span className="h-14 px-3 flex items-center justify-center bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
              {nights}박 {totalDays}일
            </span>
          )}
          {flightInfo && (
            <button
              onClick={generateFromFlightInfo}
              className="h-14 flex items-center justify-center gap-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm whitespace-nowrap hover:shadow-lg transition-all"
              title="항공 정보를 기반으로 일정 자동 생성"
            >
              ✈️ 항공정보로 자동생성
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_PPT_UPLOAD' })}
            className="h-14 flex items-center justify-center gap-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm whitespace-nowrap hover:shadow-lg transition-all"
          >
            📄 PPT 불러오기
          </button>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_GROUP_MANAGER' })}
            className="h-14 flex items-center justify-center gap-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 whitespace-nowrap hover:shadow-lg transition-all"
          >
            <FiFolder size={18} />
            그룹 관리
          </button>
          <button
            onClick={addDay}
            className="h-14 flex items-center justify-center gap-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap hover:shadow-lg transition-all"
          >
            <FiPlus size={18} />
            Day 추가
          </button>
        </div>
      </div>

      {/* 그룹 관리 모달 */}
      {showGroupManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ paddingTop: 'max(0px, env(safe-area-inset-top))', paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">일정 그룹 관리</h3>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_GROUP_MANAGER' })}
                  className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title="닫기"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* 저장된 그룹 목록 */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">저장된 그룹 불러오기</h4>
                {savedGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm">저장된 그룹이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {savedGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{group.name}</p>
                          {group.description && (
                            <p className="text-sm text-gray-500 truncate">{group.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => loadGroup(group.id)}
                          className="h-14 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap hover:shadow-md transition-all flex items-center justify-center"
                        >
                          불러오기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 새 그룹 저장 */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-700 mb-3">현재 일정을 그룹으로 저장</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => dispatch({ type: 'SET_NEW_GROUP_NAME', payload: e.target.value })}
                    placeholder="그룹 이름 입력..."
                    className="flex-1 h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveAsGroup();
                      }
                    }}
                  />
                  <button
                    onClick={saveAsGroup}
                    className="h-14 flex items-center justify-center gap-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap hover:shadow-md transition-all"
                  >
                    <FiSave size={18} />
                    저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day 목록 */}
      {loadingState.dayBlocks ? (
        <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-gray-300">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin">
              <svg className="w-8 h-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-gray-600 font-medium">일정을 불러오는 중...</p>
          </div>
        </div>
      ) : days.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">아직 일정이 없습니다</p>
          <button
            onClick={addDay}
            className="h-14 px-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium rounded transition-colors inline-flex items-center justify-center"
          >
            첫 Day 추가하기 →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day, index) => {
            const isExpanded = expandedDay === day.day;

            return (
              <div
                key={day.day}
                className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors"
              >
                {/* Day 헤더 */}
                <div className="flex items-center gap-3 p-4 bg-gray-50">
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveDay(day.day, 'up')}
                      disabled={index === 0}
                      className="h-14 w-14 flex items-center justify-center hover:bg-gray-200 rounded disabled:opacity-30 transition-colors"
                      title="위로"
                    >
                      <FiChevronUp size={20} />
                    </button>
                    <button
                      onClick={() => moveDay(day.day, 'down')}
                      disabled={index === days.length - 1}
                      className="h-14 w-14 flex items-center justify-center hover:bg-gray-200 rounded disabled:opacity-30 transition-colors"
                      title="아래로"
                    >
                      <FiChevronDown size={20} />
                    </button>
                  </div>

                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Day {day.day}</p>
                    <p className="text-sm text-gray-600">
                      {day.departure && day.arrival
                        ? `${day.departure} → ${day.arrival}`
                        : day.departure || day.arrival || '정보 없음'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => dispatch({ type: 'TOGGLE_DAY', payload: isExpanded ? null : day.day })}
                      className="h-14 px-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium flex items-center justify-center whitespace-nowrap hover:shadow-md transition-all"
                    >
                      {isExpanded ? '접기' : '편집'}
                    </button>
                    <button
                      onClick={() => removeDay(day.day)}
                      className="h-14 w-14 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg hover:shadow-md transition-colors"
                      title="삭제"
                    >
                      <FiTrash2 size={20} />
                    </button>
                  </div>
                </div>

                {/* Day 편집 폼 */}
                {isExpanded && (
                  <div className="p-6 space-y-6">
                    {/* 이모티콘 선택 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        이모티콘 (왼쪽 표시)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => dispatch({ type: 'SET_PICKER_MODE', payload: showEmojiPicker === day.day ? null : 'emoji' })}
                          className="w-16 h-16 border-2 border-gray-300 rounded-lg flex items-center justify-center text-2xl hover:border-blue-500 transition-colors bg-white"
                        >
                          {day.emoji || '선택'}
                        </button>
                        {showEmojiPicker === day.day && (
                          <div className="flex-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="grid grid-cols-10 gap-2">
                              {TRAVEL_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => {
                                    updateDay(day.day, { emoji });
                                    dispatch({ type: 'SET_PICKER_MODE', payload: null });
                                  }}
                                  className="w-10 h-10 text-2xl hover:bg-blue-100 rounded-lg transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 관광지 도착지 (드롭다운) - 크루즈 가이드 지니 연동 */}
                    <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center gap-2 mb-3">
                        <FiMapPin className="text-blue-600" size={18} />
                        <label className="text-sm font-semibold text-blue-800">
                          기항지 정보 (크루즈닷AI 연동)
                        </label>
                      </div>
                      <p className="text-xs text-blue-600 mb-3">
                        이 정보는 크루즈닷AI &quot;내일 예정&quot;에 자동으로 표시됩니다.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 도착지 선택 (드롭다운) */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            도착지 선택 <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={destinationSearch[day.day] ?? day.arrivalLocation ?? ''}
                              onChange={(e) => {
                                dispatch({ type: 'SET_DESTINATION_SEARCH', payload: { dayNumber: day.day, search: e.target.value } });
                              }}
                              placeholder="도시명 검색 (예: 후쿠오카, 지룽, 다낭...)"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            {destinationSearch[day.day] && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {destinationOptions
                                  .filter(opt =>
                                    opt.label.toLowerCase().includes((destinationSearch[day.day] || '').toLowerCase()) ||
                                    opt.city.toLowerCase().includes((destinationSearch[day.day] || '').toLowerCase())
                                  )
                                  .slice(0, 15)
                                  .map(opt => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => {
                                        updateDay(day.day, {
                                          arrivalLocation: opt.city,
                                          arrivalCountry: opt.countryCode,
                                          arrivalCountryName: opt.country,
                                          ...(opt.value === 'sea' ? { portArrivalTime: '', portDepartureTime: '' } : {}),
                                        });
                                        dispatch({ type: 'SET_DESTINATION_SEARCH', payload: { dayNumber: day.day, search: '' } });
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0"
                                    >
                                      <span className="font-medium">{opt.label}</span>
                                      {opt.countryCode && (
                                        <span className="ml-2 text-xs text-gray-500">({opt.countryCode})</span>
                                      )}
                                    </button>
                                  ))}
                                {destinationOptions.filter(opt =>
                                  opt.label.toLowerCase().includes((destinationSearch[day.day] || '').toLowerCase())
                                ).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-500">
                                      검색 결과가 없습니다
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                          {/* 선택된 도착지 표시 */}
                          {day.arrivalLocation && (
                            <div className="mt-2 flex items-center gap-2">
                              {day.arrivalLocation === '해상' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-gray-500 bg-slate-500 text-white rounded-full text-sm">
                                  🌊 해상일정 (종일 항해)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
                                  📍 {day.arrivalCountryName ? `${day.arrivalCountryName} - ` : ''}{day.arrivalLocation}
                                  {day.arrivalCountry && <span className="text-blue-200">({day.arrivalCountry})</span>}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => updateDay(day.day, {
                                  arrivalLocation: '',
                                  arrivalCountry: '',
                                  arrivalCountryName: ''
                                })}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                초기화
                              </button>
                            </div>
                          )}
                        </div>

                        {day.arrivalLocation !== '해상' && (
                          <>
                            {/* 입항 시간 */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                입항 시간
                              </label>
                              <input
                                type="time"
                                value={day.portArrivalTime || ''}
                                onChange={(e) => updateDay(day.day, { portArrivalTime: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                              <p className="text-xs text-gray-500 mt-1">크루즈가 기항지에 도착하는 시간</p>
                            </div>

                            {/* 출항 시간 */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                출항 시간
                              </label>
                              <input
                                type="time"
                                value={day.portDepartureTime || ''}
                                onChange={(e) => updateDay(day.day, { portDepartureTime: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                              />
                              <p className="text-xs text-gray-500 mt-1">크루즈가 기항지에서 출발하는 시간</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 일정 시작 */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">일정 시작</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            시간
                          </label>
                          <input
                            type="time"
                            value={day.scheduleStartTime || ''}
                            onChange={(e) => updateDay(day.day, { scheduleStartTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            일정제목
                          </label>
                          <input
                            type="text"
                            value={day.scheduleStartTitle || ''}
                            onChange={(e) => updateDay(day.day, { scheduleStartTitle: e.target.value })}
                            placeholder="예: 알래스카 싯카 도착"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 관광이미지 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        관광이미지 첨부
                      </label>
                      <div className="space-y-2">
                        {day.tourImages && day.tourImages.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {day.tourImages.map((img, idx) => (
                              <div key={idx} className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img}
                                  alt={`관광 이미지 ${idx + 1}`}
                                  className="w-full h-32 object-cover rounded-lg border border-gray-300"
                                />
                                <button
                                  onClick={() => {
                                    const newImages = [...day.tourImages!];
                                    newImages.splice(idx, 1);
                                    updateDay(day.day, { tourImages: newImages });
                                  }}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                                >
                                  <FiX size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap max-sm:flex-col max-sm:w-full">
                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_PICKER_MODE', payload: 'tour' });
                              dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: day.day, blockIndex: null } });
                              dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
                            }}
                            className="h-14 flex items-center justify-center gap-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1"
                          >
                            <FiImage size={16} />
                            크루즈정보사진에서 선택
                          </button>
                          <label className="h-14 flex items-center justify-center gap-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm cursor-pointer whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1">
                            <FiUpload size={16} />
                            파일 업로드
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={async (e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) {
                                  // 첫 번째 파일만 사용 (다중 파일은 나중에 확장 가능)
                                  const file = files[0];
                                  handleTourImageUpload(day.day, file);
                                  // 같은 파일 다시 선택 가능하도록 리셋
                                  setTimeout(() => {
                                    if (e.target) {
                                      e.target.value = '';
                                    }
                                  }, 100);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* 관광 텍스트 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        관광 텍스트
                      </label>
                      <textarea
                        value={day.tourText || ''}
                        onChange={(e) => updateDay(day.day, { tourText: e.target.value })}
                        rows={4}
                        placeholder="관광 관련 설명을 입력하세요..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* 일정 마무리 */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">일정 마무리</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            시간
                          </label>
                          <input
                            type="time"
                            value={day.scheduleEndTime || ''}
                            onChange={(e) => updateDay(day.day, { scheduleEndTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            일정마무리 텍스트
                          </label>
                          <input
                            type="text"
                            value={day.scheduleEndTitle || ''}
                            onChange={(e) => updateDay(day.day, { scheduleEndTitle: e.target.value })}
                            placeholder="예: 크루즈 출항"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 숙박 */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">숙박</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            숙박 어디에
                          </label>
                          <input
                            type="text"
                            value={day.accommodation || ''}
                            onChange={(e) => updateDay(day.day, { accommodation: e.target.value })}
                            placeholder="예: 로얄캐리비안 보이저호"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            숙박 사진 첨부
                          </label>
                          {/* 여러 장 표시 */}
                          {((day.accommodationImages && day.accommodationImages.length > 0) || day.accommodationImage) && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                              {(day.accommodationImages || []).map((imgUrl, idx) => (
                                <div key={idx} className="relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imgUrl}
                                    alt={`숙박 사진 ${idx + 1}`}
                                    className="w-full h-40 object-cover rounded-lg border border-gray-300"
                                  />
                                  <button
                                    onClick={() => {
                                      const newImages = [...(day.accommodationImages || [])];
                                      newImages.splice(idx, 1);
                                      updateDay(day.day, { accommodationImages: newImages });
                                    }}
                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                                  >
                                    <FiX size={12} />
                                  </button>
                                </div>
                              ))}
                              {/* 하위 호환: 기존 단일 이미지 */}
                              {day.accommodationImage && !(day.accommodationImages && day.accommodationImages.length > 0) && (
                                <div className="relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={day.accommodationImage}
                                    alt="숙박 사진"
                                    className="w-full h-40 object-cover rounded-lg border border-gray-300"
                                  />
                                  <button
                                    onClick={() => updateDay(day.day, { accommodationImage: '' })}
                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                                  >
                                    <FiX size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {/* 사진 추가 버튼 (항상 표시) */}
                          <div className="flex gap-2 flex-wrap max-sm:flex-col max-sm:w-full">
                            <button
                              onClick={() => {
                                dispatch({ type: 'SET_PICKER_MODE', payload: 'accommodation' });
                                dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: day.day, blockIndex: null } });
                                dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
                              }}
                              className="h-14 flex items-center justify-center gap-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1"
                            >
                              <FiImage size={16} />
                              크루즈정보사진에서 선택
                            </button>
                            <label className="h-14 flex items-center justify-center gap-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm cursor-pointer whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1">
                              <FiUpload size={16} />
                              파일 업로드 (여러 장)
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={async (e) => {
                                  const files = e.target.files;
                                  if (!files || files.length === 0) return;
                                  if (files.length === 1) {
                                    // 단일 파일: 기존 카테고리 모달 경유
                                    handleAccommodationImageUpload(day.day, files[0]);
                                  } else {
                                    // 여러 파일: URL 먼저 모두 수집 후 한 번에 상태 업데이트
                                    // (uploadAccommodationImage를 루프에서 직접 호출하면 stale closure로
                                    //  각 호출이 같은 days를 읽어 마지막 이미지만 살아남는 버그 발생)
                                    const newUrls: string[] = [];
                                    for (let i = 0; i < files.length; i++) {
                                      const file = files[i];
                                      try {
                                        const fd = new FormData();
                                        fd.append('file', file);
                                        fd.append('type', 'image');
                                        fd.append('category', '숙박');
                                        fd.append('filename', file.name.replace(/\.[^/.]+$/, ''));
                                        const res = await fetch('/api/admin/mall/upload', {
                                          method: 'POST',
                                          credentials: 'include',
                                          headers: { 'X-CSRF-Token': getCsrfToken() || '' },
                                          body: fd,
                                        });
                                        if (res.ok) {
                                          const data = await res.json();
                                          if (data.ok && data.url) newUrls.push(data.url);
                                        }
                                      } catch (err) {
                                        logger.error('Failed to upload file:', err);
                                      }
                                    }
                                    if (newUrls.length > 0) {
                                      // days를 루프 종료 후 한 번만 읽어 stale closure 방지
                                      const updatedDays = days.map(d =>
                                        d.day === day.day
                                          ? { ...d, accommodationImages: [...(d.accommodationImages || []), ...newUrls] }
                                          : d
                                      );
                                      onChange(updatedDays);
                                    }
                                    if (newUrls.length < files.length) {
                                      showError(`${files.length}개 중 ${newUrls.length}개 업로드 완료 (${files.length - newUrls.length}개 실패)`);
                                    }
                                  }
                                  setTimeout(() => { if (e.target) e.target.value = ''; }, 100);
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 식사 */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">식사</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            아침
                          </label>
                          <select
                            value={day.breakfast || ''}
                            onChange={(e) => updateDay(day.day, { breakfast: e.target.value as any || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">선택 안함</option>
                            {MEAL_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            점심
                          </label>
                          <select
                            value={day.lunch || ''}
                            onChange={(e) => updateDay(day.day, { lunch: e.target.value as any || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">선택 안함</option>
                            {MEAL_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            저녁
                          </label>
                          <select
                            value={day.dinner || ''}
                            onChange={(e) => updateDay(day.day, { dinner: e.target.value as any || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">선택 안함</option>
                            {MEAL_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* 기존 콘텐츠 블록 (하위 호환성) */}
                    <div className="border-t pt-4">
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          추가 콘텐츠 블록 (이미지/동영상/텍스트)
                        </label>
                        <div className="flex gap-2 flex-wrap max-sm:flex-col max-sm:w-full">
                          <button
                            onClick={() => addBlock(day.day, 'image')}
                            className="h-14 flex items-center justify-center gap-1 px-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1"
                          >
                            <FiImage size={16} />
                            이미지
                          </button>
                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_MULTI_SELECT_MODE', payload: true });
                              dispatch({ type: 'CLEAR_CRUISE_IMAGE_SELECTION' });
                              dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: day.day, blockIndex: null } });
                              dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
                            }}
                            className="h-14 flex items-center justify-center gap-1 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1"
                          >
                            <FiFolder size={16} />
                            크루즈사진 복수
                          </button>
                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_MULTI_SELECT_MODE', payload: true });
                              dispatch({ type: 'CLEAR_GOOGLE_DRIVE_IMAGE_SELECTION' });
                              dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: day.day, blockIndex: null } });
                              dispatch({ type: 'TOGGLE_GOOGLE_DRIVE_MODAL' });
                              loadGoogleDriveImages();
                            }}
                            className="h-14 flex items-center justify-center gap-1 px-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1"
                          >
                            <FiFolder size={16} />
                            구글드라이브 복수
                          </button>
                          <button
                            onClick={() => addBlock(day.day, 'video')}
                            className="h-14 flex items-center justify-center gap-1 px-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1"
                          >
                            <FiVideo size={16} />
                            동영상
                          </button>
                          <button
                            onClick={() => addBlock(day.day, 'text')}
                            className="h-14 flex items-center justify-center gap-1 px-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm whitespace-nowrap hover:shadow-md transition-all max-sm:flex-1"
                          >
                            <FiFileText size={16} />
                            텍스트
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {day.blocks.map((block, blockIndex) => (
                          <div
                            key={block.id}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">
                                {block.type === 'image' ? '🖼️ 이미지' :
                                  block.type === 'video' ? '🎥 동영상' : '📝 텍스트'}
                              </span>
                              <button
                                onClick={() => removeBlock(day.day, blockIndex)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                              >
                                <FiX size={16} />
                              </button>
                            </div>

                            {block.type === 'image' && (
                              <div className="space-y-2">
                                {block.url ? (
                                  <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={block.url}
                                      alt={block.alt || '이미지'}
                                      className="w-full h-48 object-cover rounded-lg border border-gray-300"
                                    />
                                    <button
                                      onClick={() => updateBlock(day.day, blockIndex, { url: '' })}
                                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                                    >
                                      <FiX size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                                      <FiImage size={20} />
                                      <span className="text-sm">이미지 업로드</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleFileUpload(day.day, blockIndex, file, 'image');
                                        }}
                                        className="hidden"
                                      />
                                    </label>
                                    <button
                                      onClick={() => {
                                        dispatch({ type: 'SET_SELECTING_FOR_BLOCK', payload: { dayNumber: day.day, blockIndex } });
                                        dispatch({ type: 'TOGGLE_CRUISE_PHOTO_MODAL' });
                                      }}
                                      className="w-full h-14 flex items-center justify-center gap-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                    >
                                      <FiFolder size={16} />
                                      <span>크루즈정보사진에서 선택</span>
                                    </button>
                                  </div>
                                )}
                                <input
                                  type="text"
                                  value={block.alt || ''}
                                  onChange={(e) => updateBlock(day.day, blockIndex, { alt: e.target.value })}
                                  placeholder="이미지 설명"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                            )}

                            {block.type === 'video' && (
                              <div className="space-y-2">
                                {block.url ? (
                                  <div className="relative">
                                    <video
                                      src={block.url}
                                      controls
                                      className="w-full h-48 rounded-lg border border-gray-300"
                                    />
                                    <button
                                      onClick={() => updateBlock(day.day, blockIndex, { url: '' })}
                                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                                    >
                                      <FiX size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                                    <FiVideo size={20} />
                                    <span className="text-sm">동영상 업로드</span>
                                    <input
                                      type="file"
                                      accept="video/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(day.day, blockIndex, file, 'video');
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                                <input
                                  type="url"
                                  value={block.url || ''}
                                  onChange={(e) => updateBlock(day.day, blockIndex, { url: e.target.value })}
                                  placeholder="또는 YouTube URL 입력"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <input
                                  type="text"
                                  value={block.title || ''}
                                  onChange={(e) => updateBlock(day.day, blockIndex, { title: e.target.value })}
                                  placeholder="동영상 제목"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                            )}

                            {block.type === 'text' && (
                              <textarea
                                value={block.content}
                                onChange={(e) => updateBlock(day.day, blockIndex, { content: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                                placeholder="텍스트 내용을 입력하세요..."
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* PPT 업로드 모달 */}
      {showPPTUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">PPT 문서 불러오기</h3>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_PPT_UPLOAD' })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                PPT 문서를 업로드하면 시간, 장소, 관광지 정보를 자동으로 추출하여 일정에 적용합니다.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                <FiFileText size={32} className="text-gray-400" />
                <span className="text-sm text-gray-600">PPT 파일 선택</span>
                <input
                  type="file"
                  accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePPTUpload(file);
                    }
                  }}
                  className="hidden"
                  disabled={uploadingPPT}
                />
              </label>
              {uploadingPPT && (
                <div className="mt-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">PPT 파싱 중...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 크루즈정보사진 선택 모달 */}
      {showCruisePhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  크루즈정보사진에서 선택
                  {multiSelectMode && <span className="ml-2 text-sm font-normal text-green-600">(복수 선택 모드)</span>}
                </h3>
                {multiSelectMode && selectedCruiseImages.length > 0 && (
                  <p className="text-sm text-blue-600 mt-1">{selectedCruiseImages.length}개 선택됨</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {multiSelectMode && selectedCruiseImages.length > 0 && (
                  <button
                    onClick={handleConfirmCruiseMultiSelect}
                    className="h-14 px-4 flex items-center justify-center bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                  >
                    선택 완료 ({selectedCruiseImages.length}개)
                  </button>
                )}
                <button
                  onClick={() => {
                    dispatch({ type: 'RESET_CRUISE_PHOTO_MODAL' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* 폴더 목록 */}
              <div className="w-1/3 border-r overflow-y-auto p-4">
                {/* 로딩 상태 */}
                {loadingState.cruiseFolders ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full animate-spin"></div>
                    <span className="text-gray-600 text-sm">폴더 로드 중...</span>
                  </div>
                ) : errorState.cruiseFolders ? (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                    <div className="flex items-start gap-3">
                      <FiX className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <div className="flex-1 min-w-0">
                        <p className="text-red-800 font-medium text-sm">{errorState.cruiseFolders}</p>
                        <button
                          onClick={loadCruiseFolders}
                          className="h-9 mt-2 px-3 bg-red-500 text-white text-sm rounded hover:bg-red-600 whitespace-nowrap transition-colors"
                        >
                          재시도
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => dispatch({ type: 'SET_SEARCH_TERM', payload: e.target.value })}
                          placeholder="폴더 검색..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {filteredFolders.map((folder) => (
                        <button
                          key={folder}
                          onClick={() => {
                            dispatch({ type: 'SET_SELECTED_FOLDER', payload: folder });
                            loadCruiseImages(folder);
                            loadCruiseImages(folder);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFolder === folder
                            ? 'bg-blue-100 text-blue-700 font-semibold'
                            : 'hover:bg-gray-100 text-gray-700'
                            }`}
                        >
                          {folder}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 이미지 그리드 */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedFolder ? (
                  loadingState.cruiseImages ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <div className="w-5 h-5 bg-blue-500 rounded-full animate-spin"></div>
                      <span className="text-gray-600 text-sm">이미지 로드 중...</span>
                    </div>
                  ) : errorState.cruiseImages ? (
                    <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                      <div className="flex items-start gap-3">
                        <FiX className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                        <div className="flex-1">
                          <p className="text-red-800 font-medium text-sm">{errorState.cruiseImages}</p>
                          <button
                            onClick={() => selectedFolder && loadCruiseImages(selectedFolder)}
                            className="h-9 mt-2 px-3 bg-red-500 text-white text-sm rounded hover:bg-red-600 whitespace-nowrap transition-colors"
                          >
                            재시도
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : cruiseImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                      {cruiseImages.map((imageUrl) => {
                        const isSelected = multiSelectMode && selectedCruiseImages.includes(imageUrl);
                        return (
                          <div
                            key={imageUrl}
                            onClick={() => handleSelectCruiseImage(imageUrl)}
                            className={`relative aspect-square cursor-pointer group ${isSelected ? 'ring-4 ring-green-500 rounded-lg' : ''}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={imageUrl}
                              className={`w-full h-full object-cover rounded-lg border-2 transition-colors ${isSelected ? 'border-green-500' : 'border-gray-200 group-hover:border-blue-500'}`}
                            />
                            {multiSelectMode && (
                              <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>
                                {isSelected && <span className="text-xs font-bold">✓</span>}
                              </div>
                            )}
                            <div className={`absolute inset-0 transition-opacity rounded-lg flex items-center justify-center ${isSelected ? 'bg-green-500 bg-opacity-20' : 'bg-black bg-opacity-0 group-hover:bg-opacity-20'}`}>
                              <span className={`font-semibold ${isSelected ? 'text-green-700' : 'text-white opacity-0 group-hover:opacity-100'}`}>
                                {isSelected ? '선택됨' : '선택'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p>이 폴더에 이미지가 없습니다.</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>왼쪽에서 폴더를 선택하세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 구글 드라이브 모달 */}
      {showGoogleDriveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-purple-600 flex items-center gap-2">
                  <FiFolder className="text-purple-500" />
                  구글드라이브 상품 이미지
                  {multiSelectMode && <span className="ml-2 text-sm font-normal text-purple-600">(복수 선택 모드)</span>}
                </h3>
                {multiSelectMode && selectedGoogleDriveImageUrls.length > 0 && (
                  <p className="text-sm text-blue-600 mt-1">{selectedGoogleDriveImageUrls.length}개 선택됨</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {multiSelectMode && selectedGoogleDriveImageUrls.length > 0 && (
                  <button
                    onClick={handleConfirmGoogleDriveMultiSelect}
                    className="h-14 px-4 flex items-center justify-center bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                  >
                    선택 완료 ({selectedGoogleDriveImageUrls.length}개)
                  </button>
                )}
                <button
                  onClick={() => {
                    dispatch({ type: 'RESET_GOOGLE_DRIVE_MODAL' });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 폴더 목록 */}
              <div className="w-64 border-r border-gray-200 overflow-y-auto p-4">
                {/* 로딩 상태 */}
                {loadingState.googleDriveFolders ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="w-4 h-4 bg-purple-500 rounded-full animate-spin"></div>
                    <span className="text-gray-600 text-sm">폴더 로드 중...</span>
                  </div>
                ) : errorState.googleDriveFolders ? (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                    <div className="flex items-start gap-3">
                      <FiX className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <div className="flex-1 min-w-0">
                        <p className="text-red-800 font-medium text-sm">{errorState.googleDriveFolders}</p>
                        <button
                          onClick={loadGoogleDriveFolders}
                          className="h-9 mt-2 px-3 bg-red-500 text-white text-sm rounded hover:bg-red-600 whitespace-nowrap transition-colors"
                        >
                          재시도
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={googleDriveSearchTerm}
                          onChange={(e) => dispatch({ type: 'SET_GOOGLE_DRIVE_SEARCH_TERM', payload: e.target.value })}
                          placeholder="폴더 검색..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          dispatch({ type: 'SET_SELECTED_GOOGLE_DRIVE_FOLDER', payload: '' });
                          loadGoogleDriveImages(); // 루트 폴더 이미지 로드
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedGoogleDriveFolder === ''
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'hover:bg-gray-100 text-gray-700'
                          }`}
                      >
                        📁 전체 이미지
                      </button>
                      {filteredGoogleDriveFolders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            dispatch({ type: 'SET_SELECTED_GOOGLE_DRIVE_FOLDER', payload: folder.id });
                            loadGoogleDriveImages(folder.id);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedGoogleDriveFolder === folder.id
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'hover:bg-gray-100 text-gray-700'
                            }`}
                        >
                          {folder.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 이미지 그리드 */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingState.googleDriveImages ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <div className="w-5 h-5 bg-purple-500 rounded-full animate-spin"></div>
                    <span className="text-gray-600 text-sm">이미지 로드 중...</span>
                  </div>
                ) : errorState.googleDriveImages ? (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                    <div className="flex items-start gap-3">
                      <FiX className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <div className="flex-1">
                        <p className="text-red-800 font-medium text-sm">{errorState.googleDriveImages}</p>
                        <button
                          onClick={() => selectedGoogleDriveFolder ? loadGoogleDriveImages(selectedGoogleDriveFolder) : loadGoogleDriveImages()}
                          className="h-9 mt-2 px-3 bg-red-500 text-white text-sm rounded hover:bg-red-600 whitespace-nowrap transition-colors"
                        >
                          재시도
                        </button>
                      </div>
                    </div>
                  </div>
                ) : googleDriveImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {googleDriveImages.map((image) => {
                      const isSelected = multiSelectMode && selectedGoogleDriveImageUrls.includes(image.url);
                      return (
                        <div
                          key={image.id}
                          onClick={() => handleSelectGoogleDriveImage(image.url)}
                          className={`relative aspect-square cursor-pointer group ${isSelected ? 'ring-4 ring-purple-500 rounded-lg' : ''}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.thumbnail || image.url}
                            alt={image.name}
                            className={`w-full h-full object-cover rounded-lg border-2 transition-colors ${isSelected ? 'border-purple-500' : 'border-gray-200 group-hover:border-purple-500'}`}
                          />
                          {multiSelectMode && (
                            <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-gray-300'}`}>
                              {isSelected && <span className="text-xs font-bold">✓</span>}
                            </div>
                          )}
                          <div className={`absolute inset-0 transition-opacity rounded-lg flex items-center justify-center ${isSelected ? 'bg-purple-500 bg-opacity-20' : 'bg-black bg-opacity-0 group-hover:bg-opacity-20'}`}>
                            <span className={`font-semibold ${isSelected ? 'text-purple-700' : 'text-white opacity-0 group-hover:opacity-100'}`}>
                              {isSelected ? '선택됨' : '선택'}
                            </span>
                          </div>
                          <p className="absolute bottom-1 left-1 right-1 text-xs text-white bg-black bg-opacity-50 px-1 py-0.5 rounded truncate">
                            {image.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>이미지가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}




