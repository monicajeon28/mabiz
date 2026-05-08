'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiSave, FiX, FiPlus, FiTrash2, FiEye } from 'react-icons/fi';
import dynamic from 'next/dynamic';
// ErrorBoundary는 전역 Providers에서 처리하므로 여기서는 제거
import { normalizeLandingImageUrl, normalizeLandingHtmlContent } from '@/lib/landing-html';

// 리치 텍스트 에디터 동적 임포트 (SSR 방지)
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="h-[650px] flex items-center justify-center text-gray-500">에디터 로딩 중...</div>
});
import 'react-quill/dist/quill.snow.css';

interface CustomerGroup {
  id: number;
  name: string;
}

const createDataFieldsState = (enableMarketingConsent = true) => ({
  phone: { enabled: false, required: false },
  name: { enabled: false, required: false },
  gender: { enabled: false, required: false },
  birthDate: { enabled: false, required: false },
  email: { enabled: false, required: false },
  address: { enabled: false, required: false },
  marketingConsent: { enabled: enableMarketingConsent, required: enableMarketingConsent },
});

export default function NewLandingPagePage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params?.partnerId as string;
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedPageId, setSavedPageId] = useState<number | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [editorMode, setEditorMode] = useState<'editor' | 'html' | 'text'>('editor');
  const [previewDevice, setPreviewDevice] = useState<'iphone' | 'samsung'>('iphone');
  const [showPreview, setShowPreview] = useState(true);
  const [quillKey, setQuillKey] = useState(0);

  // 기본 정보
  const [formData, setFormData] = useState({
    title: '',
    exposureTitle: '',
    category: '',
    pageGroup: '',
    description: '',
    htmlContent: '',
    headerScript: '',
    businessInfo: null as any,
    exposureImage: null as File | null,
    groupId: null as number | null,
    inputLimit: '무제한 허용',
    completionPageUrl: '',
    buttonTitle: '신청하기',
    smsNotification: false,
    commentEnabled: false,
    infoCollection: false,
    isPublic: true,
    marketingAccountId: null as number | null,
    marketingFunnelId: null as number | null,
    funnelOrder: null as number | null,
    scheduledMessageId: null as number | null,
  });

  // 데이터 수집 필드
  const [dataFields, setDataFields] = useState(() => createDataFieldsState(true));

  // 상품 구매 설정
  const [productPurchase, setProductPurchase] = useState({
    enabled: false,
    paymentProvider: 'payapp' as 'payapp' | 'welcomepay',
    productName: '',
    sellingPrice: 0,
    purchaseQuantity: 0,
    useQuantity: false,
    paymentType: 'basic' as 'basic' | 'cardInput',
    paymentGroupId: null as number | null,
    dbGroupId: null as number | null,
  });

  // 댓글 설정
  const [commentSettings, setCommentSettings] = useState({
    count: 10,
    startDate: '',
    endDate: '',
  });

  // 댓글 미리보기
  const [previewComments, setPreviewComments] = useState<Array<{ authorName: string; content: string; createdAt: string }>>([]);
  const [isGeneratingComments, setIsGeneratingComments] = useState(false);

  // 사업자 정보
  const [businessInfoFields, setBusinessInfoFields] = useState({
    siteName: '',
    companyName: '',
    businessNumber: '',
    businessPhone: '',
    privacyOfficer: '',
    address: '',
  });

  // 노출용 이미지 미리보기
  const [exposureImagePreview, setExposureImagePreview] = useState<string | null>(null);
  const [exposureImageUrl, setExposureImageUrl] = useState<string | null>(null);

  // exposureImagePreview 메모리 정리
  useEffect(() => {
    return () => {
      if (exposureImagePreview) {
        URL.revokeObjectURL(exposureImagePreview);
      }
    };
  }, [exposureImagePreview]);

  // 이미지 업로드 모달
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ file?: File; url: string; name: string }>>([]);
  const [imageModalMode, setImageModalMode] = useState<'upload' | 'cruise'>('upload');
  const [cruisePhotoSearch, setCruisePhotoSearch] = useState('');
  const [cruisePhotos, setCruisePhotos] = useState<Array<{ url: string; title: string }>>([]);
  const [isLoadingCruisePhotos, setIsLoadingCruisePhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<any>(null);
  const quillInstanceRef = useRef<any>(null);
  const [isQuillReady, setIsQuillReady] = useState(false);
  const [quillValue, setQuillValue] = useState(formData.htmlContent || '');
  const onChangeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const quillValueRef = useRef<string>(formData.htmlContent || '');
  const isUpdatingRef = useRef(false);

  // 신규 그룹 추가 모달
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3B82F6');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupTarget, setNewGroupTarget] = useState<'main' | 'payment' | 'db'>('main');

  // 이미지 드래그 앤 드롭
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 추가 항목 (질문)
  const [additionalFields, setAdditionalFields] = useState<Array<{ id: string; name: string; required: boolean }>>([]);
  const [newAdditionalField, setNewAdditionalField] = useState('');

  // 고객 그룹 목록
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: number; accountName: string }>>([]);
  const [funnels, setFunnels] = useState<Array<{ id: number; funnelName: string; accountId: number }>>([]);

  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchCustomerGroups();
    fetchAccounts();
    fetchFunnels();
  }, []);

  // quillValue 초기화
  useEffect(() => {
    if (!quillValue && formData.htmlContent) {
      setQuillValue(formData.htmlContent);
      quillValueRef.current = formData.htmlContent;
    }
  }, [formData.htmlContent]);

  // quillValueRef 동기화
  useEffect(() => {
    quillValueRef.current = quillValue;
  }, [quillValue]);

  // editorMode가 'editor'로 변경될 때 에디터 강제 표시
  useEffect(() => {
    if (editorMode === 'editor') {
      // 약간의 지연 후 에디터 표시 (ReactQuill 마운트 대기)
      const timer = setTimeout(() => {
        const container = document.getElementById('quill-editor-container');
        if (container) {
          container.style.setProperty('display', 'flex', 'important');
          container.style.setProperty('visibility', 'visible', 'important');
          container.style.setProperty('opacity', '1', 'important');
          container.classList.remove('hidden');

          // Quill 요소도 강제 표시
          const quillElement = container.querySelector('.quill');
          if (quillElement) {
            (quillElement as HTMLElement).style.setProperty('display', 'flex', 'important');
            (quillElement as HTMLElement).style.setProperty('visibility', 'visible', 'important');
            (quillElement as HTMLElement).style.setProperty('opacity', '1', 'important');
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [editorMode]);

  // 에디터가 항상 표시되도록 강제 (매우 강력한 보호)
  useEffect(() => {
    // 에디터 컨테이너가 항상 표시되도록 강제
    const forceShowEditor = () => {
      const container = document.getElementById('quill-editor-container');
      if (container) {
        // 모든 가능한 방법으로 표시 강제
        container.style.setProperty('display', 'flex', 'important');
        container.style.setProperty('visibility', 'visible', 'important');
        container.style.setProperty('opacity', '1', 'important');
        container.style.setProperty('position', 'relative', 'important');
        container.style.setProperty('z-index', '1', 'important');

        // Quill 요소도 강제 표시
        const quillElement = container.querySelector('.quill');
        if (quillElement) {
          (quillElement as HTMLElement).style.setProperty('display', 'flex', 'important');
          (quillElement as HTMLElement).style.setProperty('visibility', 'visible', 'important');
          (quillElement as HTMLElement).style.setProperty('opacity', '1', 'important');
        }

        const toolbar = container.querySelector('.ql-toolbar');
        if (toolbar) {
          (toolbar as HTMLElement).style.setProperty('display', 'flex', 'important');
          (toolbar as HTMLElement).style.setProperty('visibility', 'visible', 'important');
          (toolbar as HTMLElement).style.setProperty('opacity', '1', 'important');
        }

        const editor = container.querySelector('.ql-editor');
        if (editor) {
          (editor as HTMLElement).style.setProperty('display', 'block', 'important');
          (editor as HTMLElement).style.setProperty('visibility', 'visible', 'important');
          (editor as HTMLElement).style.setProperty('opacity', '1', 'important');
        }
      }
    };

    // 즉시 실행
    forceShowEditor();

    // 매우 빠른 주기로 확인 및 복구
    const keepAliveInterval = setInterval(() => {
      if (editorMode === 'editor') {
        forceShowEditor();

        try {
          const container = document.getElementById('quill-editor-container');
          if (container) {
            // 모든 Quill 요소 강제 표시
            const quillElement = container.querySelector('.quill') as HTMLElement;
            const toolbar = container.querySelector('.ql-toolbar') as HTMLElement;
            const qlContainer = container.querySelector('.ql-container') as HTMLElement;
            const qlEditor = container.querySelector('.ql-editor') as HTMLElement;

            if (quillElement) {
              quillElement.style.setProperty('display', 'flex', 'important');
              quillElement.style.setProperty('flex-direction', 'column', 'important');
              quillElement.style.setProperty('visibility', 'visible', 'important');
              quillElement.style.setProperty('opacity', '1', 'important');
            }

            // 기본 툴바는 사용하지 않으므로 숨김 처리만 수행
            if (toolbar) {
              toolbar.style.setProperty('display', 'none', 'important');
              toolbar.style.setProperty('visibility', 'hidden', 'important');
              toolbar.style.setProperty('opacity', '0', 'important');
            }

            if (qlContainer) {
              qlContainer.style.setProperty('display', 'flex', 'important');
              qlContainer.style.setProperty('flex-direction', 'column', 'important');
              qlContainer.style.setProperty('visibility', 'visible', 'important');
              qlContainer.style.setProperty('opacity', '1', 'important');
              qlContainer.style.setProperty('order', '1', 'important');
              qlContainer.style.setProperty('flex', '1', 'important');
            }

            if (qlEditor) {
              qlEditor.style.setProperty('display', 'block', 'important');
              qlEditor.style.setProperty('visibility', 'visible', 'important');
              qlEditor.style.setProperty('opacity', '1', 'important');
              qlEditor.style.setProperty('min-height', '600px', 'important');
              qlEditor.style.setProperty('background', 'white', 'important');
            }

            // Quill 인스턴스 확인 및 복구
            if (quillElement) {
              const quill = (quillElement as any).__quill || (quillElement as any).quill;
              if (quill && !isQuillReady) {
                quillInstanceRef.current = quill;
                quillRef.current = quillElement;
                setIsQuillReady(true);
              }
            }
          }
        } catch (error) {
          // 무시
        }
      }
    }, 50); // 0.05초마다 확인 (매우 빠른 복구)

    return () => {
      clearInterval(keepAliveInterval);
    };
  }, [isQuillReady, editorMode]);

  // Quill 인스턴스를 가져오는 헬퍼 함수
  const getQuillInstance = (): any => {
    // 1. ref에 저장된 인스턴스 확인
    if (quillInstanceRef.current) {
      return quillInstanceRef.current;
    }

    // 3. DOM에서 직접 검색 (가장 확실한 방법)
    const container = document.getElementById('quill-editor-container');
    if (container) {
      const quillElement = container.querySelector('.quill');
      if (quillElement) {
        // Quill 인스턴스는 DOM 요소의 __quill 속성이나 quill 속성에 저장됨
        const quill = (quillElement as any).__quill || (quillElement as any).quill;
        if (quill) {
          quillInstanceRef.current = quill;
          quillRef.current = quillElement;
          return quill;
        }

        // 전역 Quill 객체를 통해 검색
        if ((window as any).Quill) {
          const Quill = (window as any).Quill;
          // find 메서드가 있는지 확인
          if (Quill.find) {
            const q = Quill.find(quillElement);
            if (q) {
              quillInstanceRef.current = q;
              quillRef.current = quillElement;
              return q;
            }
          }
        }
      }
    }

    return null;
  };


  // ReactQuill 에디터 인스턴스 가져오기 및 준비 상태 관리
  useEffect(() => {
    // 에디터가 항상 마운트되어 있으므로 초기화만 수행
    // 에디터 표시 강제
    const forceShow = () => {
      const container = document.getElementById('quill-editor-container');
      if (container) {
        container.style.setProperty('display', 'flex', 'important');
        container.style.setProperty('visibility', 'visible', 'important');
        container.style.setProperty('opacity', '1', 'important');
      }
    };

    // 즉시 실행
    forceShow();

    let retryTimer: NodeJS.Timeout | null = null;
    const timer = setTimeout(() => {
      try {
        forceShow();
        const container = document.getElementById('quill-editor-container');
        if (container) {
          const quillElement = (container.querySelector('.quill') || container.querySelector('.ql-container')?.closest('.quill')) as HTMLElement;
          if (quillElement) {
            // Quill 인스턴스 가져오기
            const quill = (quillElement as any).__quill || (quillElement as any).quill;
            if (quill) {
              // addRange() 에러 방지: Quill의 Selection 클래스의 setNativeRange 메서드 래핑
              if (!quill._selectionWrapped) {
                try {
                  // Selection 인스턴스 가져오기
                  const selection = quill.selection;
                  if (selection && selection.constructor) {
                    const SelectionClass = selection.constructor;
                    const prototype = SelectionClass.prototype;

                    // setNativeRange 메서드 래핑
                    if (prototype && prototype.setNativeRange && !prototype._setNativeRangeWrapped) {
                      const originalSetNativeRange = prototype.setNativeRange.bind(prototype);
                      prototype.setNativeRange = function (range: any, force?: boolean) {
                        try {
                          if (!range) {
                            return originalSetNativeRange(null, force);
                          }

                          // 현재 에디터의 길이 확인
                          const editor = this?.scroll?.domNode || this?.container?.querySelector('.ql-editor');
                          if (editor) {
                            const length = editor.textContent?.length || 0;
                            const safeIndex = Math.max(0, Math.min(range.index || 0, length));
                            const safeLength = Math.max(0, Math.min(range.length || 0, length - safeIndex));

                            const safeRange = {
                              index: safeIndex,
                              length: safeLength
                            };
                            return originalSetNativeRange(safeRange, force);
                          }

                          return originalSetNativeRange(range, force);
                        } catch (error) {
                          // 에러 무시
                          return null;
                        }
                      };
                      prototype._setNativeRangeWrapped = true;
                    }
                  }

                  // setSelection 메서드도 래핑
                  const originalSetSelection = quill.setSelection.bind(quill);
                  quill.setSelection = (index: number, source?: string, force?: boolean) => {
                    try {
                      const length = quill.getLength();
                      const safeIndex = Math.max(0, Math.min(index, length - 1));
                      return originalSetSelection(safeIndex, source, force);
                    } catch (error) {
                      return null;
                    }
                  };

                  quill._selectionWrapped = true;
                } catch (error) {
                  // 래핑 실패해도 계속 진행
                }
              }

              quillInstanceRef.current = quill;
              quillRef.current = quillElement;
              setIsQuillReady(true);

              // 기본 툴바 숨김
              setTimeout(() => {
                const toolbar = (quillElement as HTMLElement).querySelector('.ql-toolbar') as HTMLElement;
                if (toolbar) {
                  toolbar.style.setProperty('display', 'none', 'important');
                  toolbar.style.setProperty('visibility', 'hidden', 'important');
                  toolbar.style.setProperty('opacity', '0', 'important');
                }
              }, 100);
            } else {
              // Quill 인스턴스가 아직 준비되지 않았으면 재시도
              retryTimer = setTimeout(() => {
                forceShow();
                const retryQuill = (quillElement as any).__quill || (quillElement as any).quill;
                if (retryQuill) {
                  // addRange() 에러 방지: Quill의 Selection 클래스의 setNativeRange 메서드 래핑
                  if (!retryQuill._selectionWrapped) {
                    try {
                      const selection = retryQuill.selection;
                      if (selection && selection.constructor) {
                        const SelectionClass = selection.constructor;
                        const prototype = SelectionClass.prototype;

                        if (prototype && prototype.setNativeRange && !prototype._setNativeRangeWrapped) {
                          const originalSetNativeRange = prototype.setNativeRange.bind(prototype);
                          prototype.setNativeRange = function (range: any, force?: boolean) {
                            try {
                              if (!range) {
                                return originalSetNativeRange(null, force);
                              }

                              const editor = this?.scroll?.domNode || this?.container?.querySelector('.ql-editor');
                              if (editor) {
                                const length = editor.textContent?.length || 0;
                                const safeIndex = Math.max(0, Math.min(range.index || 0, length));
                                const safeLength = Math.max(0, Math.min(range.length || 0, length - safeIndex));

                                const safeRange = {
                                  index: safeIndex,
                                  length: safeLength
                                };
                                return originalSetNativeRange(safeRange, force);
                              }

                              return originalSetNativeRange(range, force);
                            } catch (error) {
                              return null;
                            }
                          };
                          prototype._setNativeRangeWrapped = true;
                        }
                      }

                      const originalSetSelection = retryQuill.setSelection.bind(retryQuill);
                      retryQuill.setSelection = (index: number, source?: string, force?: boolean) => {
                        try {
                          const length = retryQuill.getLength();
                          const safeIndex = Math.max(0, Math.min(index, length - 1));
                          return originalSetSelection(safeIndex, source, force);
                        } catch (error) {
                          return null;
                        }
                      };

                      retryQuill._selectionWrapped = true;
                    } catch (error) {
                      // 래핑 실패해도 계속 진행
                    }
                  }

                  quillInstanceRef.current = retryQuill;
                  quillRef.current = quillElement;
                  setIsQuillReady(true);

                  // 기본 툴바 숨김
                  setTimeout(() => {
                    const toolbar = (quillElement as HTMLElement).querySelector('.ql-toolbar') as HTMLElement;
                    if (toolbar) {
                      toolbar.style.setProperty('display', 'none', 'important');
                      toolbar.style.setProperty('visibility', 'hidden', 'important');
                      toolbar.style.setProperty('opacity', '0', 'important');
                    }
                  }, 100);
                }
              }, 500);
            }
          }
        }
      } catch (error) {
        // 에러 무시 (콘솔에 출력하지 않음)
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [editorMode]);

  // htmlContent가 외부에서 변경될 때만 quillValue 업데이트 (에디터가 준비된 경우)
  useEffect(() => {
    if (editorMode === 'editor' && isQuillReady && formData.htmlContent !== quillValueRef.current) {
      // ref와 state 모두 업데이트
      quillValueRef.current = formData.htmlContent || '';
      setQuillValue(formData.htmlContent || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.htmlContent, editorMode, isQuillReady]);

  // onChange 핸들러 메모이제이션 (리렌더링 최소화)
  const handleQuillChange = useCallback((value: string) => {
    try {
      // ref에만 저장 (리렌더링 방지)
      if (value === null || value === undefined) {
        quillValueRef.current = '';
      } else {
        quillValueRef.current = typeof value === 'string' ? value : String(value || '');
      }

      // formData 업데이트는 매우 긴 debounce로 처리 (리렌더링 최소화)
      if (onChangeDebounceRef.current) {
        clearTimeout(onChangeDebounceRef.current);
      }

      // 2초 debounce로 formData 업데이트 (에디터가 사라지지 않도록)
      onChangeDebounceRef.current = setTimeout(() => {
        setFormData(prev => ({ ...prev, htmlContent: quillValueRef.current }));
      }, 2000);
    } catch (error) {
      console.error('ReactQuill onChange error:', error);
    }
  }, []);

  // 신규 그룹 생성
  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      alert('그룹 이름을 입력해주세요.');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const response = await fetch('/api/partner/customer-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          color: newGroupColor,
        }),
      });

      const data = await response.json();

      if (data.ok && data.group) {
        // 그룹 목록 새로고침
        await fetchCustomerGroups();

        // 생성된 그룹을 해당 필드에 설정
        if (newGroupTarget === 'main') {
          setFormData({ ...formData, groupId: data.group.id });
        } else if (newGroupTarget === 'payment') {
          setProductPurchase({ ...productPurchase, paymentGroupId: data.group.id });
        } else if (newGroupTarget === 'db') {
          setProductPurchase({ ...productPurchase, dbGroupId: data.group.id });
        }

        // 모달 닫기 및 초기화
        setShowNewGroupModal(false);
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupColor('#3B82F6');
        alert('그룹이 생성되었습니다.');
      } else {
        alert(data.error || '그룹 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('그룹 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // 이미지 압축 및 리사이징 함수
  const compressAndResizeImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // 리사이징: 가로 1200px, 세로 비율 유지 (최대 20000px)
          let width = Math.min(img.width, 1200);
          let height = (img.height / img.width) * width;
          if (height > 20000) {
            height = 20000;
            width = (img.width / img.height) * height;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            0.85 // 품질 85%
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert file to data URL'));
      reader.readAsDataURL(file);
    });
  };

  // 파일 선택 핸들러
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 최대 10개 제한
    if (selectedImages.length + files.length > 10) {
      alert('이미지는 한번에 10개까지 선택할 수 있습니다.');
      return;
    }

    // 파일 크기 및 타입 검증
    const validFiles: File[] = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        alert(`${file.name}은(는) 20MB를 초과합니다.`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        alert(`${file.name}은(는) 이미지 파일이 아닙니다.`);
        continue;
      }
      validFiles.push(file);
    }

    // 이미지 압축 및 리사이징
    const processedImages: Array<{ file?: File; url: string; name: string }> = [];
    for (const file of validFiles) {
      try {
        const compressedFile = await compressAndResizeImage(file);
        const url = URL.createObjectURL(compressedFile);
        processedImages.push({ file: compressedFile, url, name: file.name });
      } catch (error) {
        console.error('Image processing error:', error);
        alert(`${file.name} 처리 중 오류가 발생했습니다.`);
      }
    }

    setSelectedImages([...selectedImages, ...processedImages]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 크루즈정보사진 검색
  const handleCruisePhotoSearch = async () => {
    if (!cruisePhotoSearch.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }

    setIsLoadingCruisePhotos(true);
    try {
      const response = await fetch(`/api/photos?q=${encodeURIComponent(cruisePhotoSearch)}`);
      if (response.ok) {
        const data = await response.json();
        setCruisePhotos(data.items || []);
      } else {
        alert('사진 검색에 실패했습니다.');
      }
    } catch (error) {
      console.error('Cruise photo search error:', error);
      alert('사진 검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingCruisePhotos(false);
    }
  };

  // 이미지 삽입 (에디터에)
  const insertImagesToEditor = async () => {
    if (selectedImages.length === 0) {
      alert('삽입할 이미지를 선택해주세요.');
      return;
    }

    const convertToPersistentUrl = async (img: { url: string; file?: File }) => {
      let url = img.url;

      // 크루즈정보사진 이미지인 경우 URL 정규화
      // 상대 경로인 경우 절대 URL로 변환
      if (url && !url.startsWith('http') && !url.startsWith('blob:') && !url.startsWith('data:')) {
        // 상대 경로인 경우
        if (url.startsWith('/')) {
          // 이미 /로 시작하는 경우
          url = `${window.location.origin}${url}`;
        } else {
          // 상대 경로인 경우
          url = `${window.location.origin}/${url}`;
        }
      }

      const normalizedUrl = normalizeLandingImageUrl(url, { baseOrigin: window.location.origin });

      if (normalizedUrl.startsWith('blob:') && img.file) {
        try {
          const dataUrl = await fileToDataUrl(img.file);
          return dataUrl;
        } catch (error) {
          console.error('[Image Insert] Failed to convert blob URL to data URL:', error);
          return normalizedUrl;
        }
      }
      return normalizedUrl;
    };

    let preparedImages: Array<{ url: string; name: string; file?: File; persistentUrl: string }>;
    try {
      preparedImages = await Promise.all(
        selectedImages.map(async (img) => ({
          ...img,
          persistentUrl: await convertToPersistentUrl(img),
        }))
      );
    } catch (conversionError) {
      console.error('[Image Insert] Error preparing images:', conversionError);
      alert('이미지를 준비하는 동안 오류가 발생했습니다.');
      return;
    }

    // 이미지 태그 생성 (URL 정규화)
    const imageTags = preparedImages
      .map((img) => {
        return `<p><img src="${img.persistentUrl}" alt="${img.name || ''}" style="max-width: 100%; height: auto;" /></p>`;
      })
      .join('\n');

    if (editorMode === 'html') {
      // HTML 모드: 이미지 태그 추가
      const newContent = formData.htmlContent + '\n' + imageTags;
      setFormData({
        ...formData,
        htmlContent: newContent,
      });
    } else if (editorMode === 'editor') {
      // Editor 모드: Quill 인스턴스에 직접 삽입
      try {
        // Quill 인스턴스 확인 및 대기
        let quill = getQuillInstance();
        if (!quill) {
          // Quill 인스턴스가 없으면 잠시 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 100));
          quill = getQuillInstance();

          // 여전히 없으면 한 번 더 시도
          if (!quill) {
            await new Promise(resolve => setTimeout(resolve, 200));
            quill = getQuillInstance();
          }
        }

        if (quill) {
          try {
            // 현재 커서 위치 가져오기
            const range = quill.getSelection(true);
            let insertIndex = range ? range.index : quill.getLength() - 1;

            // 안전한 인덱스로 조정
            const length = quill.getLength();
            insertIndex = Math.max(0, Math.min(insertIndex, length - 1));

            // 커서를 삽입 위치로 이동
            quill.setSelection(insertIndex, 0, 'user');

            // 각 이미지를 개별적으로 삽입
            for (let index = 0; index < preparedImages.length; index++) {
              const img = preparedImages[index];
              try {
                // 현재 커서 위치 가져오기
                const currentRange = quill.getSelection(true);
                let currentIndex = currentRange ? currentRange.index : quill.getLength() - 1;
                const length = quill.getLength();
                currentIndex = Math.max(0, Math.min(currentIndex, length - 1));

                // 커서를 삽입 위치로 이동
                quill.setSelection(currentIndex, 0, 'user');

                // insertEmbed를 사용하여 이미지 삽입
                quill.insertEmbed(currentIndex, 'image', img.persistentUrl, 'user');

                // 이미지 사이에 줄바꿈 추가 (마지막 이미지가 아닌 경우)
                if (index < preparedImages.length - 1) {
                  const newLength = quill.getLength();
                  if (newLength > 0) {
                    const newIndex = Math.max(0, newLength - 1);
                    quill.insertText(newIndex, '\n', 'user');
                    // 커서를 다음 삽입 위치로 이동
                    quill.setSelection(newIndex + 1, 0, 'user');
                  }
                }
              } catch (imgError) {
                console.error('[Image Insert] Error inserting image:', img, imgError);
                // 에러 발생 시 HTML로 직접 삽입 시도
                try {
                  const currentRange = quill.getSelection(true);
                  let currentIndex = currentRange ? currentRange.index : quill.getLength() - 1;
                  const length = quill.getLength();
                  currentIndex = Math.max(0, Math.min(currentIndex, length - 1));

                  const imageHtml = `<img src="${img.persistentUrl}" alt="${img.name || ''}" style="max-width: 100%; height: auto;" />`;
                  const delta = quill.clipboard.convert({ html: imageHtml });

                  // Delta를 사용하여 삽입
                  const Quill = (window as any).Quill;
                  if (Quill && Quill.import) {
                    const Delta = Quill.import('delta');
                    quill.updateContents(
                      new Delta()
                        .retain(currentIndex)
                        .concat(delta),
                      'user'
                    );
                  } else {
                    // Delta를 사용할 수 없으면 HTML을 직접 삽입
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = imageHtml;
                    const imgElement = tempDiv.querySelector('img');
                    if (imgElement) {
                      quill.insertEmbed(currentIndex, 'image', img.persistentUrl, 'user');
                    }
                  }
                } catch (fallbackError) {
                  console.error('[Image Insert] Fallback also failed:', fallbackError);
                }
              }
            }

            // 삽입 후 커서를 끝으로 이동
            const newLength = quill.getLength();
            if (newLength > 0) {
              quill.setSelection(newLength - 1, 0, 'user');
            }

            // Quill의 내용을 ref와 state에 반영
            const quillContent = quill.root.innerHTML;
            console.log('[Image Insert] Final Quill content:', quillContent.substring(0, 500));
            quillValueRef.current = quillContent;
            setQuillValue(quillContent);

            // formData 업데이트
            if (onChangeDebounceRef.current) {
              clearTimeout(onChangeDebounceRef.current);
            }
            onChangeDebounceRef.current = setTimeout(() => {
              setFormData(prev => ({ ...prev, htmlContent: quillContent }));
            }, 500);
          } catch (error) {
            console.error('Quill 이미지 삽입 오류:', error);
            // 에러 발생 시 HTML로 직접 추가
            const currentContent = quillValueRef.current || formData.htmlContent || '';
            const newContent = currentContent + '\n' + imageTags;
            quillValueRef.current = newContent;
            setQuillValue(newContent);
            setFormData(prev => ({ ...prev, htmlContent: newContent }));
          }
        } else {
          // Quill 인스턴스가 없으면 HTML로 직접 추가
          console.warn('[Image Insert] Quill instance not found, using HTML fallback');
          const currentContent = quillValueRef.current || formData.htmlContent || '';
          const newContent = currentContent + '\n' + imageTags;
          quillValueRef.current = newContent;
          setQuillValue(newContent);
          setFormData(prev => ({ ...prev, htmlContent: newContent }));
        }

        // 에디터가 표시되도록 강제
        setTimeout(() => {
          const container = document.getElementById('quill-editor-container');
          if (container) {
            container.style.setProperty('display', 'flex', 'important');
            container.style.setProperty('visibility', 'visible', 'important');
            container.style.setProperty('opacity', '1', 'important');
            container.classList.remove('hidden');
          }
        }, 100);
      } catch (error) {
        console.error('이미지 삽입 오류:', error);
        // 에러 발생 시 기본 방식으로 폴백
        const currentContent = quillValueRef.current || formData.htmlContent || '';
        const newContent = currentContent + '\n' + imageTags;
        quillValueRef.current = newContent;
        setQuillValue(newContent);
        setFormData(prev => ({ ...prev, htmlContent: newContent }));
      }
    }

    // 모달 닫기 및 초기화
    setShowImageModal(false);
    setSelectedImages([]);
    setCruisePhotos([]);
    setCruisePhotoSearch('');
  };

  // 드래그 앤 드롭 핸들러 (파일 추가용)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // 파일 선택과 동일한 로직
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    input.files = dataTransfer.files;

    const event = new Event('change', { bubbles: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    handleFileSelect(event as any);
  };

  // 이미지 순서 변경을 위한 드래그 핸들러
  const handleImageDragStart = (index: number) => {
    setDraggedImageIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedImageIndex !== null && draggedImageIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleImageDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
      setDraggedImageIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 이미지 순서 변경
    const newImages = [...selectedImages];
    const draggedImage = newImages[draggedImageIndex];
    newImages.splice(draggedImageIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);

    setSelectedImages(newImages);
    setDraggedImageIndex(null);
    setDragOverIndex(null);
  };

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null);
    setDragOverIndex(null);
  };

  // 미리보기 업데이트를 위한 의존성 값들을 메모이제이션 (무한 루프 방지)
  const dataFieldsStr = useMemo(() => JSON.stringify(dataFields), [dataFields]);
  const additionalFieldsStr = useMemo(() => JSON.stringify(additionalFields), [additionalFields]);
  const productPurchaseStr = useMemo(() => JSON.stringify(productPurchase), [productPurchase]);

  // 미리보기 업데이트 (하단 입력 폼 포함)
  useEffect(() => {
    if (previewRef.current) {
      const iframe = previewRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();

        // 활성화된 필드들로 하단 폼 생성
        const formFields: string[] = [];

        if (formData.infoCollection) {
          // 활성화된 필드들만 표시 (이름 → 휴대폰 번호 순서)
          if (dataFields.name.enabled) {
            formFields.push(`
              <div class="form-field">
                <label>이름 ${dataFields.name.required ? '<span class="required">*</span>' : ''}</label>
                <input type="text" placeholder="이름을 입력하세요" ${dataFields.name.required ? 'required' : ''} />
              </div>
            `);
          }

          if (dataFields.phone.enabled) {
            formFields.push(`
              <div class="form-field">
                <label>휴대폰 번호 ${dataFields.phone.required ? '<span class="required">*</span>' : ''}</label>
                <input type="tel" placeholder="010-1234-5678" ${dataFields.phone.required ? 'required' : ''} />
              </div>
            `);
          }

          if (dataFields.gender.enabled) {
            formFields.push(`
              <div class="form-field">
                <label>성별 ${dataFields.gender.required ? '<span class="required">*</span>' : ''}</label>
                <select ${dataFields.gender.required ? 'required' : ''}>
                  <option value="">선택하세요</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </div>
            `);
          }

          if (dataFields.birthDate.enabled) {
            formFields.push(`
              <div class="form-field">
                <label>생년월일 ${dataFields.birthDate.required ? '<span class="required">*</span>' : ''}</label>
                <input type="date" ${dataFields.birthDate.required ? 'required' : ''} />
              </div>
            `);
          }

          if (dataFields.email.enabled) {
            formFields.push(`
              <div class="form-field">
                <label>이메일 ${dataFields.email.required ? '<span class="required">*</span>' : ''}</label>
                <input type="email" placeholder="example@email.com" ${dataFields.email.required ? 'required' : ''} />
              </div>
            `);
          }

          if (dataFields.address.enabled) {
            formFields.push(`
              <div class="form-field">
                <label>주소 ${dataFields.address.required ? '<span class="required">*</span>' : ''}</label>
                <input type="text" placeholder="주소를 입력하세요" ${dataFields.address.required ? 'required' : ''} />
              </div>
            `);
          }

          if (dataFields.marketingConsent.enabled) {
            formFields.push(`
              <div class="form-field checkbox-field">
                <label>
                  <input type="checkbox" checked ${dataFields.marketingConsent.required ? 'required' : ''} />
                  마케팅 활용 및 광고성 정보 수신 동의
                  ${dataFields.marketingConsent.required ? '<span class="required">*</span>' : ''}
                </label>
              </div>
            `);
          }

          // 추가 항목 (질문)
          additionalFields.forEach((field) => {
            formFields.push(`
              <div class="form-field">
                <label>${field.name} ${field.required ? '<span class="required">*</span>' : ''}</label>
                <input type="text" placeholder="${field.name}을(를) 입력하세요" ${field.required ? 'required' : ''} />
              </div>
            `);
          });

          // 상품 구매 기능
          if (productPurchase.enabled) {
            formFields.push(`
              <div class="product-purchase">
                <h3>${productPurchase.productName || '상품명'}</h3>
                <p>판매가격: ${productPurchase.sellingPrice.toLocaleString()}원</p>
                ${productPurchase.useQuantity ? `<p>구매수량: ${productPurchase.purchaseQuantity}개</p>` : ''}
              </div>
            `);
          }

          // 신청하기 버튼
          formFields.push(`
            <div class="form-submit">
              <button type="submit" class="submit-btn">${formData.buttonTitle || '신청하기'}</button>
            </div>
          `);
        }

        // Editor 모드와 HTML 모드에 따라 다른 콘텐츠 사용
        // HTML 모드: formData.htmlContent를 직접 사용 (HTML 코드만 인식, 정규화 없이, Editor로 변환하지 않음)
        // Editor 모드: quillValueRef.current 사용 (Quill이 생성한 HTML, 정규화 필요)
        let previewContent = '';
        if (editorMode === 'html') {
          // HTML 탭: HTML 코드만 직접 사용 (정규화 없이 순수 HTML 렌더링, Editor 형식으로 변환하지 않음)
          // formData.htmlContent를 그대로 사용하여 HTML 코드를 직접 렌더링
          // quillValueRef는 절대 사용하지 않음
          previewContent = formData.htmlContent || '';
        } else if (editorMode === 'editor') {
          // Editor 탭: Quill이 생성한 HTML 사용 (정규화 필요)
          previewContent = quillValueRef.current || quillValue || formData.htmlContent || '';
        } else {
          // 기본값
          previewContent = formData.htmlContent || '';
        }

        // HTML 탭일 때는 HTML 코드를 직접 렌더링 (완전한 HTML 문서일 수 있음, 정규화 없이)
        if (editorMode === 'html') {
          // HTML 탭: HTML 코드를 직접 렌더링 (Editor로 변환하지 않음, 정규화하지 않음)
          // previewContent가 완전한 HTML 문서일 수 있으므로 그대로 렌더링
          const htmlContent = previewContent || '';
          // HTML 문서가 완전한 경우 (DOCTYPE, html 태그 포함)
          if (htmlContent.trim().toLowerCase().startsWith('<!doctype') || htmlContent.trim().toLowerCase().startsWith('<html')) {
            // 완전한 HTML 문서인 경우 그대로 렌더링 (정규화 없이)
            doc.write(htmlContent);
          } else {
            // HTML 문서의 일부만 있는 경우 body에 삽입 (정규화 없이)
            doc.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                      padding: 20px; 
                      line-height: 1.6; 
                      background: #f5f5f5;
                    }
                    img { max-width: 100%; height: auto; }
                    .form-section {
                      margin-top: 40px;
                      padding: 20px;
                      background: white;
                      border-radius: 12px;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .form-field {
                      margin-bottom: 20px;
                    }
                    .form-field label {
                      display: block;
                      margin-bottom: 8px;
                      font-weight: 600;
                      color: #333;
                    }
                    .form-field input,
                    .form-field select {
                      width: 100%;
                      padding: 12px;
                      border: 2px solid #e0e0e0;
                      border-radius: 8px;
                      font-size: 16px;
                    }
                    .form-field input:focus,
                    .form-field select:focus {
                      outline: none;
                      border-color: #3b82f6;
                    }
                    .checkbox-field label {
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      cursor: pointer;
                    }
                    .checkbox-field input[type="checkbox"] {
                      width: 20px;
                      height: 20px;
                    }
                    .required {
                      color: #ef4444;
                    }
                    .submit-btn {
                      width: 100%;
                      padding: 16px;
                      background: #3b82f6;
                      color: white;
                      border: none;
                      border-radius: 8px;
                      font-size: 18px;
                      font-weight: 600;
                      cursor: pointer;
                    }
                    .submit-btn:hover {
                      background: #2563eb;
                    }
                    .product-purchase {
                      margin-top: 20px;
                      margin-bottom: 20px;
                      padding: 15px;
                      background-color: #f8f9fa;
                      border-radius: 8px;
                      border: 1px solid #e9ecef;
                    }
                    .product-purchase h3 {
                      margin-bottom: 10px;
                      font-size: 18px;
                      color: #333;
                    }
                    .product-purchase p {
                      margin-bottom: 5px;
                      color: #555;
                    }
                    /* 댓글 섹션 스타일 */
                    .comments-section {
                      margin-top: 40px;
                      padding: 20px;
                      background: white;
                      border-radius: 12px;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .comments-header {
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      margin-bottom: 20px;
                      padding-bottom: 10px;
                      border-bottom: 1px solid #eee;
                    }
                    .comments-count {
                      font-weight: bold;
                      color: #333;
                    }
                    .comment-form {
                      margin-bottom: 30px;
                    }
                    .comment-input-wrap {
                      display: flex;
                      gap: 10px;
                    }
                    .comment-input {
                      flex: 1;
                      padding: 12px;
                      border: 1px solid #ddd;
                      border-radius: 8px;
                      resize: none;
                      height: 50px;
                    }
                    .comment-submit {
                      padding: 0 20px;
                      background: #3b82f6;
                      color: white;
                      border: none;
                      border-radius: 8px;
                      font-weight: 600;
                      cursor: pointer;
                    }
                    .comment-list {
                      display: flex;
                      flex-direction: column;
                      gap: 20px;
                    }
                    .comment-item {
                      padding-bottom: 20px;
                      border-bottom: 1px solid #f0f0f0;
                    }
                    .comment-item:last-child {
                      border-bottom: none;
                    }
                    .comment-author {
                      font-weight: 600;
                      margin-bottom: 4px;
                      color: #333;
                    }
                    .comment-date {
                      font-size: 12px;
                      color: #888;
                      margin-bottom: 8px;
                    }
                    .comment-content {
                      color: #444;
                      line-height: 1.5;
                    }
                    /* 사업자 정보 스타일 */
                    .business-info {
                      margin-top: 40px;
                      padding: 20px;
                      background: #f8f9fa;
                      border-top: 1px solid #e9ecef;
                      font-size: 12px;
                      color: #666;
                      line-height: 1.6;
                    }
                    .business-info p {
                      margin-bottom: 4px;
                    }
                  </style>
                  ${formData.headerScript || ''}
                </head>
                <body>
                  ${htmlContent}
                  ${formData.infoCollection ? `
                    <div class="form-section">
                      <h2 style="margin-bottom: 20px; font-size: 24px;">신청하기</h2>
                      <form>
                        ${formFields.join('')}
                      </form>
                    </div>
                  ` : ''}
                </body>
              </html>
            `);
          }
        } else {
          // Editor 탭: 정규화된 HTML 사용
          doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    padding: 20px; 
                    line-height: 1.6; 
                    background: #f5f5f5;
                  }
                  img { max-width: 100%; height: auto; }
                  .form-section {
                    margin-top: 40px;
                    padding: 20px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  }
                  .form-field {
                    margin-bottom: 20px;
                  }
                  .form-field label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #333;
                  }
                  .form-field input,
                  .form-field select {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 16px;
                  }
                  .form-field input:focus,
                  .form-field select:focus {
                    outline: none;
                    border-color: #3b82f6;
                  }
                  .checkbox-field label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                  }
                  .checkbox-field input[type="checkbox"] {
                    width: 20px;
                    height: 20px;
                  }
                  .required {
                    color: #ef4444;
                  }
                  .submit-btn {
                    width: 100%;
                    padding: 16px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: 600;
                    cursor: pointer;
                  }
                  .submit-btn:hover {
                    background: #2563eb;
                  }
                  .product-purchase {
                    padding: 20px;
                    background: #f0f9ff;
                    border-radius: 8px;
                    margin-bottom: 20px;
                  }
                  .product-purchase h3 {
                    margin-bottom: 10px;
                  }
                </style>
                ${(() => {
              // headerScript에서 중복 선언 방지를 위해 스크립트 태그를 정리
              let headerScript = formData.headerScript || '';
              // notificationPopup 같은 변수 중복 선언 방지
              if (headerScript.includes('notificationPopup')) {
                // 모든 선언을 window 객체로 변경하고 중복 체크 추가
                headerScript = headerScript.replace(
                  /(var|let|const)\s+notificationPopup\s*=/gi,
                  'if (typeof window.notificationPopup === "undefined") { window.notificationPopup ='
                );
                // 함수 선언도 처리
                headerScript = headerScript.replace(
                  /function\s+notificationPopup/gi,
                  'window.notificationPopup = window.notificationPopup || function'
                );
                // 닫는 중괄호 추가 (열린 중괄호가 있는 경우)
                const openBraces = (headerScript.match(/\{/g) || []).length;
                const closeBraces = (headerScript.match(/\}/g) || []).length;
                if (openBraces > closeBraces) {
                  headerScript = headerScript + '}';
                }
              }
              return headerScript;
            })()}
              </head>
              <body>
                ${normalizeLandingHtmlContent(previewContent || '', { baseOrigin: window.location.origin })}
                ${formData.infoCollection ? `
                  <div class="form-section">
                    <h2 style="margin-bottom: 20px; font-size: 24px;">신청하기</h2>
                    <form>
                      ${formFields.join('')}
                    </form>
                  </div>
                ` : ''}
                ${formData.commentEnabled && previewComments.length > 0 ? `
                  <div class="comments-section" style="margin-top: 40px; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h2 style="margin-bottom: 20px; font-size: 24px; font-weight: 600;">댓글 (${previewComments.length})</h2>
                    <div class="comments-list">
                      ${previewComments.map((comment, idx) => `
                        <div class="comment-item" style="padding: 16px; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; ${idx === previewComments.length - 1 ? 'border-bottom: none;' : ''}">
                          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600; color: #1f2937; font-size: 14px;">${comment.authorName || '익명'}</span>
                            <span style="font-size: 12px; color: #6b7280;">${new Date(comment.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                          </div>
                          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${comment.content || ''}</p>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
                ${businessInfoFields.siteName || businessInfoFields.companyName || businessInfoFields.businessNumber || businessInfoFields.businessPhone || businessInfoFields.privacyOfficer || businessInfoFields.address ? `
                  <div class="business-info-section" style="margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="margin-bottom: 16px; font-size: 18px; font-weight: 600; color: #1f2937;">사업자 정보</h3>
                    <div style="font-size: 13px; color: #4b5563; line-height: 1.8;">
                      ${businessInfoFields.siteName ? `<div><strong>사이트명:</strong> ${businessInfoFields.siteName}</div>` : ''}
                      ${businessInfoFields.companyName ? `<div><strong>회사명:</strong> ${businessInfoFields.companyName}</div>` : ''}
                      ${businessInfoFields.businessNumber ? `<div><strong>사업자번호:</strong> ${businessInfoFields.businessNumber}</div>` : ''}
                      ${businessInfoFields.businessPhone ? `<div><strong>대표연락처:</strong> ${businessInfoFields.businessPhone}</div>` : ''}
                      ${businessInfoFields.privacyOfficer ? `<div><strong>개인정보담당:</strong> ${businessInfoFields.privacyOfficer}</div>` : ''}
                      ${businessInfoFields.address ? `<div><strong>주소:</strong> ${businessInfoFields.address}</div>` : ''}
                    </div>
                  </div>
                ` : ''}
              </body>
            </html>
          `);
        }
        doc.close();
      }
    }
  }, [
    editorMode,
    formData.htmlContent,
    quillValue, // 항상 포함 (조건부 제거로 인한 경고 방지)
    formData.headerScript,
    formData.infoCollection,
    formData.buttonTitle,
    formData.commentEnabled,
    previewComments.length,
    businessInfoFields.siteName,
    businessInfoFields.companyName,
    businessInfoFields.businessNumber,
    businessInfoFields.businessPhone,
    businessInfoFields.privacyOfficer,
    businessInfoFields.address,
    // 메모이제이션된 의존성 값들 사용 (무한 루프 방지)
    dataFieldsStr,
    additionalFieldsStr,
    productPurchaseStr,
  ]);

  const fetchCustomerGroups = async () => {
    try {
      const response = await fetch('/api/partner/customer-groups', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setCustomerGroups(data.groups || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch customer groups:', err);
    }
  };

  const fetchAccounts = async () => {
    // 파트너용 마케팅 계정 API가 없으므로 빈 배열로 설정
    try {
      setAccounts([]);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const fetchFunnels = async () => {
    // 파트너용 마케팅 퍼널 API가 없으므로 빈 배열로 설정
    try {
      setFunnels([]);
    } catch (err) {
      console.error('Failed to fetch funnels:', err);
    }
  };

  // 자동 저장 함수
  const autoSave = async (isAutoSave = true) => {
    // 최소한 제목이나 내용이 있어야 저장
    if (!formData.title && !formData.htmlContent) {
      return;
    }

    if (isAutoSave) {
      setAutoSaving(true);
      setAutoSaveStatus('saving');
    }

    try {
      const infoCollectionData = {
        fields: dataFields,
        additionalFields: additionalFields,
        productPurchase: productPurchase.enabled ? productPurchase : null,
        commentSettings: formData.commentEnabled ? commentSettings : null,
        // 사업자 정보 포함
        ...(businessInfoFields.siteName || businessInfoFields.companyName || businessInfoFields.businessNumber || businessInfoFields.businessPhone || businessInfoFields.privacyOfficer || businessInfoFields.address ? {
          siteName: businessInfoFields.siteName,
          companyName: businessInfoFields.companyName,
          businessNumber: businessInfoFields.businessNumber,
          businessPhone: businessInfoFields.businessPhone,
          privacyOfficer: businessInfoFields.privacyOfficer,
          address: businessInfoFields.address,
        } : {}),
      };

      // 저장 시 Editor 모드와 HTML 모드에 따라 다른 처리
      let finalHtmlContent = '';
      if (editorMode === 'html') {
        // HTML 탭: HTML 코드를 그대로 사용 (정규화 없이, Editor 형식으로 변환하지 않음, quillValueRef 사용하지 않음)
        finalHtmlContent = formData.htmlContent || '';
      } else if (editorMode === 'editor' && quillValueRef.current !== undefined) {
        // Editor 탭: Quill이 생성한 HTML 사용 (정규화 필요)
        finalHtmlContent = quillValueRef.current;
      } else {
        finalHtmlContent = formData.htmlContent || '';
      }

      // HTML 콘텐츠 내 이미지 URL 정규화 (HTML 탭일 때는 정규화하지 않음, Editor 형식으로 변환하지 않음)
      const normalizedHtmlContent = editorMode === 'html'
        ? finalHtmlContent  // HTML 탭: HTML 코드 그대로 사용 (정규화 없이, Editor 형식으로 변환하지 않음)
        : normalizeLandingHtmlContent(finalHtmlContent, { baseOrigin: window.location.origin });  // Editor 탭: 정규화 필요

      const submitData: any = {
        title: formData.title || '임시 저장',
        htmlContent: normalizedHtmlContent,
        category: formData.category || null,
        pageGroup: formData.pageGroup || null,
        description: formData.description || null,
        exposureTitle: formData.exposureTitle || null,
        headerScript: formData.headerScript || null,
        groupId: formData.groupId || null,
        marketingAccountId: formData.marketingAccountId || null,
        marketingFunnelId: formData.marketingFunnelId || null,
        funnelOrder: formData.funnelOrder || null,
        inputLimit: formData.inputLimit || '무제한 허용',
        completionPageUrl: formData.completionPageUrl || null,
        buttonTitle: formData.buttonTitle || '신청하기',
        commentEnabled: formData.commentEnabled || false,
        infoCollection: formData.infoCollection || false,
        scheduledMessageId: formData.scheduledMessageId || null,
        additionalGroupId: null,
        checkDuplicateGroup: false,
        businessInfo: infoCollectionData,
        exposureImage: null,
      };

      // undefined 값 제거
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      const url = savedPageId
        ? `/api/partner/landing-pages/${savedPageId}`
        : '/api/partner/landing-pages';
      const method = savedPageId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        if (!savedPageId && data.landingPage?.id) {
          setSavedPageId(data.landingPage.id);
        }
        setAutoSaveStatus('saved');
        setTimeout(() => {
          setAutoSaveStatus('idle');
        }, 2000);
      } else {
        setAutoSaveStatus('error');
        setTimeout(() => {
          setAutoSaveStatus('idle');
        }, 3000);
      }
    } catch (err) {
      console.error('Auto-save error:', err);
      setAutoSaveStatus('error');
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    } finally {
      if (isAutoSave) {
        setAutoSaving(false);
      }
    }
  };

  // 자동 저장 트리거 (debounce) - 비활성화됨
  useEffect(() => {
    // 자동 저장 기능 비활성화 - 타이머 정리만 수행
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []); // 빈 배열로 한 번만 실행

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 저장 전에 quillValueRef의 최신 값을 formData에 반영
    if (editorMode === 'editor' && quillValueRef.current !== undefined) {
      setFormData(prev => ({ ...prev, htmlContent: quillValueRef.current }));
      // debounce 타이머가 있다면 취소하고 즉시 업데이트
      if (onChangeDebounceRef.current) {
        clearTimeout(onChangeDebounceRef.current);
      }
    }
    setLoading(true);

    try {
      const infoCollectionData = {
        fields: dataFields,
        additionalFields: additionalFields,
        productPurchase: productPurchase.enabled ? productPurchase : null,
        commentSettings: formData.commentEnabled ? commentSettings : null,
        // 저장 모드 정보 저장 (HTML 코드인지 Editor인지 구분)
        editorMode: editorMode === 'html' ? 'html' : 'editor',
        // 사업자 정보 포함
        ...(businessInfoFields.siteName || businessInfoFields.companyName || businessInfoFields.businessNumber || businessInfoFields.businessPhone || businessInfoFields.privacyOfficer || businessInfoFields.address ? {
          siteName: businessInfoFields.siteName,
          companyName: businessInfoFields.companyName,
          businessNumber: businessInfoFields.businessNumber,
          businessPhone: businessInfoFields.businessPhone,
          privacyOfficer: businessInfoFields.privacyOfficer,
          address: businessInfoFields.address,
        } : {}),
      };

      // 저장 시 Editor 모드와 HTML 모드에 따라 다른 처리
      let finalHtmlContent = '';
      if (editorMode === 'html') {
        // HTML 탭: HTML 코드를 그대로 사용 (정규화 없이, Editor 형식으로 변환하지 않음, quillValueRef 사용하지 않음)
        finalHtmlContent = formData.htmlContent || '';
      } else if (editorMode === 'editor' && quillValueRef.current !== undefined) {
        // Editor 탭: Quill이 생성한 HTML 사용 (정규화 필요)
        finalHtmlContent = quillValueRef.current;
      } else {
        finalHtmlContent = formData.htmlContent || '';
      }

      // HTML 콘텐츠 내 이미지 URL 정규화 (HTML 탭일 때는 정규화하지 않음, Editor 형식으로 변환하지 않음)
      const normalizedHtmlContent = editorMode === 'html'
        ? finalHtmlContent  // HTML 탭: HTML 코드 그대로 사용 (정규화 없이, Editor 형식으로 변환하지 않음)
        : normalizeLandingHtmlContent(finalHtmlContent, { baseOrigin: window.location.origin });  // Editor 탭: 정규화 필요

      // 노출용 이미지 업로드 (새로 업로드한 파일이 있는 경우)
      let exposureImageUrl = null;
      if (formData.exposureImage) {
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', formData.exposureImage);
          uploadFormData.append('type', 'image');
          uploadFormData.append('category', 'landing-exposure');
          uploadFormData.append('filename', formData.exposureImage.name);

          const uploadResponse = await fetch('/api/admin/mall/upload', {
            method: 'POST',
            credentials: 'include',
            body: uploadFormData,
          });

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            if (uploadData.ok && uploadData.url) {
              exposureImageUrl = uploadData.url;
              console.log('노출용 이미지 업로드 성공:', exposureImageUrl);
            } else {
              console.error('노출용 이미지 업로드 응답 오류:', uploadData);
            }
          } else {
            const errorText = await uploadResponse.text();
            console.error('노출용 이미지 업로드 실패:', uploadResponse.status, errorText);
          }
        } catch (uploadError) {
          console.error('노출용 이미지 업로드 실패:', uploadError);
          alert('노출용 이미지 업로드에 실패했습니다. 다시 시도해주세요.');
          setLoading(false);
          return;
        }
      }

      const submitData: any = {
        title: formData.title || '',
        htmlContent: normalizedHtmlContent,
        category: formData.category || null,
        pageGroup: formData.pageGroup || null,
        description: formData.description || null,
        exposureTitle: formData.exposureTitle || null,
        headerScript: formData.headerScript || null,
        groupId: formData.groupId || null,
        marketingAccountId: formData.marketingAccountId || null,
        marketingFunnelId: formData.marketingFunnelId || null,
        funnelOrder: formData.funnelOrder || null,
        inputLimit: formData.inputLimit || '무제한 허용',
        completionPageUrl: formData.completionPageUrl || null,
        buttonTitle: formData.buttonTitle || '신청하기',
        commentEnabled: formData.commentEnabled || false,
        infoCollection: formData.infoCollection || false,
        scheduledMessageId: formData.scheduledMessageId || null,
        additionalGroupId: null, // 제거된 필드이지만 API 호환성을 위해 null 전송
        checkDuplicateGroup: false, // 제거된 필드이지만 API 호환성을 위해 false 전송
        businessInfo: infoCollectionData, // 실제 설정 데이터는 businessInfo에 저장
        exposureImage: exposureImageUrl, // 업로드된 이미지 URL
      };

      // undefined 값 제거
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined) {
          delete submitData[key];
        }
      });

      console.log('Submitting landing page data:', {
        title: submitData.title,
        hasHtmlContent: !!submitData.htmlContent,
        htmlContentLength: submitData.htmlContent?.length || 0,
        infoCollection: submitData.infoCollection,
        businessInfo: submitData.businessInfo,
        groupId: submitData.groupId,
        marketingAccountId: submitData.marketingAccountId,
        marketingFunnelId: submitData.marketingFunnelId,
      });

      let requestBody;
      try {
        requestBody = JSON.stringify(submitData);
        console.log('Request body size:', requestBody.length, 'bytes');
      } catch (stringifyError: any) {
        console.error('Failed to stringify submitData:', stringifyError);
        console.error('Problematic data:', submitData);
        alert('데이터 직렬화 중 오류가 발생했습니다: ' + stringifyError.message);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/partner/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: requestBody,
      });

      let data;
      try {
        const responseText = await response.text();
        console.log('Server response status:', response.status);
        console.log('Server response text (first 500 chars):', responseText.substring(0, 500));

        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response JSON:', parseError);
          console.error('Full response text:', responseText);
          throw new Error(`서버 응답을 파싱할 수 없습니다. 상태: ${response.status}, 응답: ${responseText.substring(0, 200)}`);
        }
      } catch (textError: any) {
        console.error('Failed to read response:', textError);
        throw new Error('서버 응답을 읽을 수 없습니다: ' + textError.message);
      }

      if (!response.ok || !data.ok) {
        const errorMessage = data.error || data.details?.message || data.details?.code || '랜딩페이지 생성에 실패했습니다.';
        console.error('Landing page creation error:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details,
          fullData: JSON.stringify(data, null, 2),
        });

        // 개발 환경에서 더 자세한 에러 표시
        if (data.details) {
          alert(`에러: ${errorMessage}\n\n상세 정보:\n${JSON.stringify(data.details, null, 2)}`);
        } else {
          alert(`에러: ${errorMessage}`);
        }

        throw new Error(errorMessage);
      }

      // 저장된 페이지 ID 업데이트
      if (data.landingPage?.id) {
        setSavedPageId(data.landingPage.id);
      }

      alert('랜딩페이지가 생성되었습니다!');

      // 랜딩페이지 목록으로 이동
      if (partnerId) {
        router.push(`/partner/${partnerId}/landing-pages`);
      } else {
        router.back();
      }

      // 댓글 자동 생성 (댓글 기능이 활성화되고 설정이 있는 경우)
      if (formData.commentEnabled && commentSettings && commentSettings.count && commentSettings.startDate && commentSettings.endDate) {
        try {
          const commentResponse = await fetch(`/api/partner/landing-pages/${data.landingPage.id}/comments/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              count: commentSettings.count,
              departureDate: commentSettings.startDate, // API는 departureDate를 요구함
              endDate: commentSettings.endDate,
            }),
          });

          if (commentResponse.ok) {
            const commentData = await commentResponse.json();
            if (commentData.ok) {
              console.log(`댓글 ${commentData.count}개가 생성되었습니다.`);
              alert(`댓글 ${commentData.count}개가 생성되었습니다.`);
            } else {
              console.error('댓글 생성 실패:', commentData.error);
              alert(`댓글 생성에 실패했습니다: ${commentData.error || '알 수 없는 오류'}`);
            }
          } else {
            const errorData = await commentResponse.json().catch(() => ({}));
            console.error('댓글 생성 API 오류:', commentResponse.status, errorData);
            alert(`댓글 생성에 실패했습니다: ${errorData.error || 'API 오류'}`);
          }
        } catch (commentError) {
          console.error('댓글 생성 중 오류:', commentError);
          alert(`댓글 생성 중 오류가 발생했습니다: ${commentError instanceof Error ? commentError.message : '알 수 없는 오류'}`);
          // 댓글 생성 실패해도 랜딩페이지 생성은 성공으로 처리
        }
      }
    } catch (err) {
      console.error('Failed to create landing page:', err);
      alert(err instanceof Error ? err.message : '랜딩페이지 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const addAdditionalField = () => {
    if (!newAdditionalField.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }
    setAdditionalFields([...additionalFields, {
      id: Date.now().toString(),
      name: newAdditionalField.trim(),
      required: false,
    }]);
    setNewAdditionalField('');
  };

  const removeAdditionalField = (id: string) => {
    setAdditionalFields(additionalFields.filter(f => f.id !== id));
  };

  const toggleDataField = (field: keyof typeof dataFields) => {
    if (!formData.infoCollection) {
      alert('먼저 정보수집 기능을 활성화해주세요.');
      return;
    }
    const newValue = !dataFields[field].enabled;
    setDataFields({
      ...dataFields,
      [field]: {
        ...dataFields[field],
        enabled: newValue,
        required: newValue ? dataFields[field].required : false, // 비활성화 시 필수도 해제
      },
    });
  };

  const toggleDataFieldRequired = (field: keyof typeof dataFields) => {
    if (!dataFields[field].enabled) {
      alert('먼저 해당 항목을 활성화해주세요.');
      return;
    }
    setDataFields({
      ...dataFields,
      [field]: { ...dataFields[field], required: !dataFields[field].required },
    });
  };

  const toggleAdditionalFieldRequired = (id: string) => {
    setAdditionalFields(additionalFields.map(f =>
      f.id === id ? { ...f, required: !f.required } : f
    ));
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg max-w-[1920px] mx-auto">
        {/* 헤더 */}
        <div className="border-b px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">블로그형 랜딩페이지 작성</h1>
            {autoSaveStatus === 'saving' && (
              <span className="text-sm text-blue-600 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                자동 저장 중...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-sm text-green-600 flex items-center gap-2">
                <span>✓</span>
                자동 저장 완료
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-sm text-red-600">자동 저장 실패</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
            >
              <FiEye size={18} />
              {showPreview ? '미리보기 숨기기' : '미리보기 보기'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <FiX size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-4 p-4">
            {/* 왼쪽: 모바일 미리보기 */}
            {showPreview && (
              <div className="w-[400px] flex-shrink-0">
                <div className="sticky top-4 bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-700">모바일 미리보기</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('iphone')}
                        className={`px-3 py-1 text-xs rounded ${previewDevice === 'iphone' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        iPhone
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('samsung')}
                        className={`px-3 py-1 text-xs rounded ${previewDevice === 'samsung' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        Samsung
                      </button>
                    </div>
                  </div>
                  <div className={`relative ${previewDevice === 'iphone' ? 'bg-black' : 'bg-gray-900'} rounded-[2.5rem] p-2 shadow-2xl`}>
                    {/* 노치/상단바 */}
                    <div className={`${previewDevice === 'iphone' ? 'h-6' : 'h-4'} bg-black rounded-t-[2rem] flex items-center justify-center`}>
                      {previewDevice === 'iphone' && (
                        <div className="w-32 h-5 bg-black rounded-full"></div>
                      )}
                      {previewDevice === 'samsung' && (
                        <div className="w-16 h-1 bg-gray-700 rounded-full"></div>
                      )}
                    </div>
                    {/* 화면 */}
                    <div className="bg-white rounded-[2rem] overflow-hidden" style={{ height: '700px' }}>
                      <iframe
                        ref={previewRef}
                        className="w-full h-full border-0"
                        title="Preview"
                      />
                    </div>
                    {/* 하단 홈 인디케이터 */}
                    <div className={`${previewDevice === 'iphone' ? 'h-8' : 'h-2'} bg-black rounded-b-[2rem] flex items-center justify-center`}>
                      {previewDevice === 'iphone' && (
                        <div className="w-32 h-1 bg-gray-700 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 오른쪽: 에디터 영역 */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
              {/* 기본 정보 */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">기본 정보</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      대분류 <span className="text-gray-400 text-xs font-normal">※ 카테고리 분류</span>
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="예: B2B크루즈"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      페이지묶음 <span className="text-gray-400 text-xs font-normal">※ 동일한 묶음끼리 목록에서 표시</span>
                    </label>
                    <input
                      type="text"
                      value={formData.pageGroup}
                      onChange={(e) => setFormData({ ...formData, pageGroup: e.target.value })}
                      placeholder="예: B2B크루즈"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      제목 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">노출용 제목</label>
                    <input
                      type="text"
                      value={formData.exposureTitle}
                      onChange={(e) => setFormData({ ...formData, exposureTitle: e.target.value })}
                      placeholder="SNS 공유 시 표시될 제목"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">노출용 설명</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="SNS 공유 시 표시될 설명"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 콘텐츠 에디터 */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
                <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">콘텐츠</h2>
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorMode('editor')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${editorMode === 'editor'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('html')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${editorMode === 'html'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    HTML
                  </button>
                </div>
                {/* HTML 탭일 때는 Editor 관련 모든 것을 완전히 숨김, textarea만 표시 */}
                {editorMode === 'html' ? (
                  /* HTML 탭: HTML 코드만 입력 가능 (Editor 완전히 제거, 툴바 없음, 1칸만 표시) */
                  <div className="min-h-[700px] border-2 border-gray-200 rounded-lg overflow-hidden mb-20 bg-white">
                    <textarea
                      value={formData.htmlContent || ''}
                      onChange={(e) => {
                        // HTML 탭에서는 HTML 코드를 그대로 저장 (Editor로 변환하지 않음)
                        const newValue = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          htmlContent: newValue
                        }));
                        // HTML 탭에서는 quillValueRef를 절대 업데이트하지 않음
                        // 미리보기는 useEffect에서 formData.htmlContent 변경을 감지하여 자동 업데이트됨
                      }}
                      onBlur={(e) => {
                        // 포커스를 잃을 때도 HTML 코드 그대로 유지
                        const newValue = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          htmlContent: newValue
                        }));
                      }}
                      className="w-full h-[700px] px-6 py-4 border-0 font-mono text-sm focus:outline-none resize-none bg-white text-gray-900"
                      placeholder="HTML 코드를 입력하세요..."
                      spellCheck={false}
                      style={{
                        minHeight: '700px',
                        height: '700px',
                        width: '100%',
                        fontFamily: '"Courier New", Courier, monospace',
                        lineHeight: '1.6',
                        overflow: 'auto',
                        tabSize: 2,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        display: 'block',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ) : editorMode === 'editor' ? (
                  /* Editor 탭: Editor만 표시 */
                  <div className="min-h-[700px] border-2 border-gray-200 rounded-lg overflow-hidden mb-20">
                    <div
                      className="h-[700px] flex flex-col relative"
                      id="quill-editor-container"
                      style={{
                        display: 'flex',
                        visibility: 'visible',
                        opacity: 1,
                        position: 'relative',
                        zIndex: 1,
                        paddingBottom: '80px' // 하단 툴바 공간 확보
                      }}
                    >
                      <style dangerouslySetInnerHTML={{
                        __html: `
                        #quill-editor-container {
                          display: flex !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                          position: relative !important;
                          z-index: 1 !important;
                        }
                        #quill-editor-container .quill {
                          display: flex !important;
                          flex-direction: column !important;
                          height: 100% !important;
                          width: 100% !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                          position: relative !important;
                        }
                        /* 툴바를 하단으로 이동 */
                        #quill-editor-container .ql-container {
                          order: 1 !important;
                          flex: 1 !important;
                          display: flex !important;
                          flex-direction: column !important;
                          min-height: 500px !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                          border: 1px solid #ccc !important;
                          border-bottom: none !important;
                        }
                        /* Quill 기본 툴바 완전히 숨김 */
                        #quill-editor-container .ql-toolbar {
                          display: none !important;
                          visibility: hidden !important;
                          opacity: 0 !important;
                          height: 0 !important;
                          padding: 0 !important;
                          margin: 0 !important;
                          border: none !important;
                        }
                        #quill-editor-container .ql-toolbar .ql-formats {
                          display: inline-flex !important;
                          align-items: center !important;
                          margin-right: 8px !important;
                          vertical-align: middle !important;
                          gap: 4px !important;
                        }
                        #quill-editor-container .ql-toolbar button {
                          display: inline-flex !important;
                          align-items: center !important;
                          justify-content: center !important;
                          width: 36px !important;
                          height: 36px !important;
                          padding: 0 !important;
                          margin: 0 !important;
                          border: 1px solid transparent !important;
                          border-radius: 4px !important;
                          background: transparent !important;
                          cursor: pointer !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                          transition: all 0.2s ease !important;
                        }
                        #quill-editor-container .ql-toolbar button:hover {
                          background: #e0e0e0 !important;
                          border-color: #ccc !important;
                        }
                        #quill-editor-container .ql-toolbar button.ql-active {
                          background: #d0d0d0 !important;
                          border-color: #999 !important;
                        }
                        #quill-editor-container .ql-toolbar button svg {
                          width: 18px !important;
                          height: 18px !important;
                        }
                        #quill-editor-container .ql-toolbar .ql-picker {
                          display: inline-block !important;
                          height: 36px !important;
                          margin: 0 !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                        }
                        #quill-editor-container .ql-toolbar .ql-picker-label {
                          display: inline-flex !important;
                          align-items: center !important;
                          justify-content: center !important;
                          padding: 0 10px !important;
                          height: 36px !important;
                          border: 1px solid transparent !important;
                          border-radius: 4px !important;
                          cursor: pointer !important;
                          transition: all 0.2s ease !important;
                        }
                        #quill-editor-container .ql-toolbar .ql-picker-label:hover {
                          background: #e0e0e0 !important;
                          border-color: #ccc !important;
                        }
                        #quill-editor-container .ql-toolbar .ql-picker-options {
                          padding: 8px !important;
                        }
                        #quill-editor-container .ql-toolbar .ql-picker-item {
                          padding: 6px 12px !important;
                          border-radius: 4px !important;
                        }
                        #quill-editor-container .ql-toolbar .ql-picker-item:hover {
                          background: #e0e0e0 !important;
                        }
                        #quill-editor-container .ql-container {
                          border-bottom: 1px solid #ccc !important;
                          border-left: 1px solid #ccc !important;
                          border-right: 1px solid #ccc !important;
                          border-top: none !important;
                          font-size: 16px !important;
                          flex: 1 !important;
                          display: flex !important;
                          flex-direction: column !important;
                          min-height: 0 !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                          width: 100% !important;
                        }
                        #quill-editor-container .ql-editor {
                          min-height: 600px !important;
                          flex: 1 !important;
                          padding: 12px 15px !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                          display: block !important;
                          position: relative !important;
                          width: 100% !important;
                          overflow-y: auto !important;
                          background: white !important;
                        }
                        #quill-editor-container .ql-editor * {
                          visibility: visible !important;
                          opacity: 1 !important;
                        }
                        /* 에디터가 항상 표시되도록 강제 */
                        #quill-editor-container .quill,
                        #quill-editor-container .ql-container,
                        #quill-editor-container .ql-editor {
                          display: flex !important;
                          visibility: visible !important;
                          opacity: 1 !important;
                          pointer-events: auto !important;
                        }
                        #quill-editor-container .ql-container {
                          display: flex !important;
                        }
                        #quill-editor-container .ql-editor {
                          display: block !important;
                        }
                        /* 이미지 스타일 */
                        #quill-editor-container .ql-editor img {
                          max-width: 100% !important;
                          height: auto !important;
                          display: block !important;
                          margin: 10px 0 !important;
                          border-radius: 4px !important;
                        }
                        #quill-editor-container .ql-editor p {
                          margin: 10px 0 !important;
                        }
                        #quill-editor-container .ql-editor p img {
                          margin: 0 !important;
                        }
                      `}} />
                      {/* ErrorBoundary는 전역 Providers에서 처리하므로 제거 */}
                      {/* HTML 탭일 때는 ReactQuill을 절대 렌더링하지 않음 */}
                      {editorMode === 'editor' ? (
                        <>
                          <ReactQuill
                            key="editor-fixed"
                            theme="snow"
                            value={(() => {
                              // 안전한 값 추출 및 검증
                              let val: string = '';
                              try {
                                val = quillValueRef.current || quillValue || formData.htmlContent || '';
                                // null, undefined 체크
                                if (val == null) val = '';
                                // 문자열이 아닌 경우 변환
                                if (typeof val !== 'string') {
                                  val = String(val || '');
                                }
                                // 빈 문자열 보장
                                if (!val) val = '';
                              } catch (error) {
                                console.error('ReactQuill value 처리 오류:', error);
                                val = '';
                              }
                              return val;
                            })()}
                            readOnly={false}
                            onChange={handleQuillChange}
                            onChangeSelection={(range) => {
                              // addRange 에러 방지: range가 유효한지 확인
                              if (range && quillInstanceRef.current) {
                                try {
                                  const length = quillInstanceRef.current.getLength();
                                  if (range.index >= 0 && range.index <= length &&
                                    range.length >= 0 && range.index + range.length <= length) {
                                    // 유효한 range
                                  }
                                } catch (error) {
                                  // 무시
                                }
                              }
                            }}
                            onBlur={() => {
                              // blur 시에도 에디터가 표시되도록 유지
                              requestAnimationFrame(() => {
                                const container = document.getElementById('quill-editor-container');
                                if (container && editorMode === 'editor') {
                                  container.style.display = 'flex';
                                  container.style.visibility = 'visible';
                                  container.style.opacity = '1';
                                }
                              });
                            }}
                            onFocus={() => {
                              // 포커스 시 에디터가 준비되었는지 확인
                              try {
                                const container = document.getElementById('quill-editor-container');
                                if (container) {
                                  container.style.setProperty('display', 'flex', 'important');
                                  container.style.setProperty('visibility', 'visible', 'important');
                                  container.style.setProperty('opacity', '1', 'important');
                                  container.classList.remove('hidden');
                                }

                                const quillElement = container?.querySelector('.ql-container')?.closest('.quill');
                                if (quillElement) {
                                  const quill = (quillElement as any).__quill || (quillElement as any).quill;
                                  if (quill) {
                                    // addRange() 에러 방지: Quill의 Selection 클래스의 setNativeRange 메서드 래핑
                                    if (!quill._selectionWrapped) {
                                      try {
                                        const selection = quill.selection;
                                        if (selection && selection.constructor) {
                                          const SelectionClass = selection.constructor;
                                          const prototype = SelectionClass.prototype;

                                          if (prototype && prototype.setNativeRange && !prototype._setNativeRangeWrapped) {
                                            const originalSetNativeRange = prototype.setNativeRange.bind(prototype);
                                            prototype.setNativeRange = function (range: any, force?: boolean) {
                                              try {
                                                if (!range) {
                                                  return originalSetNativeRange(null, force);
                                                }

                                                const editor = this?.scroll?.domNode || this?.container?.querySelector('.ql-editor');
                                                if (editor) {
                                                  const length = editor.textContent?.length || 0;
                                                  const safeIndex = Math.max(0, Math.min(range.index || 0, length));
                                                  const safeLength = Math.max(0, Math.min(range.length || 0, length - safeIndex));

                                                  const safeRange = {
                                                    index: safeIndex,
                                                    length: safeLength
                                                  };
                                                  return originalSetNativeRange(safeRange, force);
                                                }

                                                return originalSetNativeRange(range, force);
                                              } catch (error) {
                                                return null;
                                              }
                                            };
                                            prototype._setNativeRangeWrapped = true;
                                          }
                                        }

                                        const originalSetSelection = quill.setSelection.bind(quill);
                                        quill.setSelection = (index: number, source?: string, force?: boolean) => {
                                          try {
                                            const length = quill.getLength();
                                            const safeIndex = Math.max(0, Math.min(index, length - 1));
                                            return originalSetSelection(safeIndex, source, force);
                                          } catch (error) {
                                            return null;
                                          }
                                        };

                                        quill._selectionWrapped = true;
                                      } catch (error) {
                                        // 래핑 실패해도 계속 진행
                                      }
                                    }

                                    quillInstanceRef.current = quill;
                                    quillRef.current = quillElement;
                                    setIsQuillReady(true);
                                  }
                                }
                              } catch (error) {
                                // 에러 무시
                              }
                            }}
                            bounds="#quill-editor-container"
                            preserveWhitespace={true}
                            modules={{
                              toolbar: [], // 빈 툴바 생성 후 CSS로 숨김
                            }}
                            formats={[
                              'header', 'size',
                              'bold', 'italic', 'underline', 'strike',
                              'list', // 'bullet' 제거 (list에 포함됨)
                              'color', 'background',
                              'align',
                              'link', 'image'
                            ]}
                            style={{ height: '650px' }}
                            className="bg-white"
                          />
                        </>
                      ) : null}

                      {/* 커스텀 하단 고정 툴바 */}
                      {editorMode === 'editor' && (
                        <div
                          id="custom-toolbar"
                          className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg z-50 px-4 py-3 w-full"
                          style={{
                            position: 'sticky',
                            bottom: 0,
                            left: 0,
                            right: 0,
                          }}
                        >
                          <div className="max-w-full mx-auto flex flex-wrap items-center gap-2 justify-start">
                            {/* 헤더 */}
                            <select
                              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium bg-white hover:bg-gray-50 cursor-pointer"
                              onChange={(e) => {
                                const quill = getQuillInstance();
                                if (!quill) return;
                                const value = e.target.value;
                                if (value === '') {
                                  quill.format('header', false);
                                } else {
                                  quill.format('header', value);
                                }
                              }}
                            >
                              <option value="">Normal</option>
                              <option value="1">Heading 1</option>
                              <option value="2">Heading 2</option>
                              <option value="3">Heading 3</option>
                            </select>

                            {/* 크기 */}
                            <select
                              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium bg-white hover:bg-gray-50 cursor-pointer"
                              onChange={(e) => {
                                const quill = getQuillInstance();
                                if (!quill) return;
                                const value = e.target.value;
                                if (value === '') {
                                  quill.format('size', false);
                                } else {
                                  quill.format('size', value);
                                }
                              }}
                            >
                              <option value="">Size</option>
                              <option value="small">Small</option>
                              <option value="large">Large</option>
                              <option value="huge">Huge</option>
                            </select>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            {/* 서식 버튼 */}
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm font-bold bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                const currentFormat = quill.getFormat();
                                quill.format('bold', !currentFormat.bold);
                              }}
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm italic bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                const currentFormat = quill.getFormat();
                                quill.format('italic', !currentFormat.italic);
                              }}
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm underline bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                const currentFormat = quill.getFormat();
                                quill.format('underline', !currentFormat.underline);
                              }}
                              title="Underline"
                            >
                              U
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm line-through bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                const currentFormat = quill.getFormat();
                                quill.format('strike', !currentFormat.strike);
                              }}
                              title="Strike"
                            >
                              S
                            </button>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            {/* 목록 */}
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                quill.format('list', 'ordered');
                              }}
                              title="Ordered List"
                            >
                              <span className="text-lg">1.</span>
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                quill.format('list', 'bullet');
                              }}
                              title="Bullet List"
                            >
                              <span className="text-lg">•</span>
                            </button>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            {/* 링크 */}
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                const range = quill.getSelection(true);
                                if (range && range.length > 0) {
                                  const url = prompt('링크 URL을 입력하세요:');
                                  if (url) {
                                    quill.formatText(range.index, range.length, 'link', url);
                                  }
                                } else {
                                  // 선택된 텍스트가 없으면 링크 삽입
                                  const url = prompt('링크 URL을 입력하세요:');
                                  if (url) {
                                    const text = prompt('링크 텍스트를 입력하세요:', url);
                                    if (text) {
                                      const range = quill.getSelection(true);
                                      const index = range ? range.index : quill.getLength();
                                      quill.insertText(index, text, 'link', url);
                                    }
                                  }
                                }
                              }}
                              title="Link"
                            >
                              🔗
                            </button>

                            {/* 이미지 */}
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowImageModal(true);
                              }}
                              title="Image"
                            >
                              🖼️
                            </button>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            {/* 정렬 */}
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                quill.format('align', false); // left is default (false)
                              }}
                              title="Align Left"
                            >
                              ⬅️
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                quill.format('align', 'center');
                              }}
                              title="Align Center"
                            >
                              ⬌
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (!quill) return;
                                quill.format('align', 'right');
                              }}
                              title="Align Right"
                            >
                              ➡️
                            </button>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            {/* 색상 */}
                            <input
                              type="color"
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                              onChange={(e) => {
                                const quill = getQuillInstance();
                                if (quill) {
                                  const editorElement = quillRef.current;
                                  if (editorElement) {
                                    editorElement.focus();
                                  }
                                  setTimeout(() => {
                                    quill.focus();
                                    const range = quill.getSelection(true);
                                    if (!range) {
                                      const length = quill.getLength();
                                      quill.setSelection(length - 1, 0);
                                    }
                                    quill.format('color', e.target.value);
                                  }, 10);
                                }
                              }}
                              title="Text Color"
                            />
                            <input
                              type="color"
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                              onChange={(e) => {
                                const quill = getQuillInstance();
                                if (quill) {
                                  const editorElement = quillRef.current;
                                  if (editorElement) {
                                    editorElement.focus();
                                  }
                                  setTimeout(() => {
                                    quill.focus();
                                    const range = quill.getSelection(true);
                                    if (!range) {
                                      const length = quill.getLength();
                                      quill.setSelection(length - 1, 0);
                                    }
                                    quill.format('background', e.target.value);
                                  }, 10);
                                }
                              }}
                              title="Background Color"
                            />

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            {/* 지우기 */}
                            <button
                              type="button"
                              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.preventDefault();
                                const quill = getQuillInstance();
                                if (quill) {
                                  const editorElement = quillRef.current;
                                  if (editorElement) {
                                    editorElement.focus();
                                  }
                                  // 포커스 후 잠시 대기하여 커서 위치 확보
                                  setTimeout(() => {
                                    const range = quill.getSelection(true);
                                    if (range) {
                                      quill.removeFormat(range.index, range.length);
                                    } else {
                                      // 선택이 없으면 현재 블록의 포맷 제거
                                      const length = quill.getLength();
                                      if (length > 1) {
                                        const lineRange = quill.getLine(Math.max(0, length - 2));
                                        if (lineRange) {
                                          quill.removeFormat(lineRange[0].offset(), lineRange[0].length());
                                        }
                                      }
                                    }
                                  }, 10);
                                }
                              }}
                              title="Clear Formatting"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 정보수집 기능 */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
                <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">정보수집</h2>
                <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                  <div>
                    <label className="font-semibold text-gray-700">정보수집 기능 사용</label>
                    <p className="text-xs text-gray-500 mt-1">정보수집을 활성화하면 하단에 입력 폼이 표시됩니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newValue = !formData.infoCollection;
                      setFormData({ ...formData, infoCollection: newValue });
                      if (!newValue) {
                        // 정보수집 끄면 모든 필드 비활성화
                        setDataFields(createDataFieldsState(false));
                      } else {
                        // 정보수집 켜면 마케팅 동의는 자동 활성화 + 필수
                        setDataFields(prev => ({
                          ...prev,
                          marketingConsent: { enabled: true, required: true },
                        }));
                      }
                    }}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${formData.infoCollection ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${formData.infoCollection ? 'translate-x-7' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* 데이터 수집 설정 */}
              {formData.infoCollection && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">데이터 수집 설정</h2>

                  <div className="space-y-2 mb-6">
                    {/* 모든 필드 (휴대폰 번호 포함) */}
                    {[
                      { key: 'phone' as const, label: '휴대폰 번호' },
                      { key: 'name' as const, label: '이름' },
                      { key: 'gender' as const, label: '성별' },
                      { key: 'birthDate' as const, label: '생년월일' },
                      { key: 'email' as const, label: '이메일' },
                      { key: 'address' as const, label: '주소' },
                      { key: 'marketingConsent' as const, label: '마케팅 활용 및 광고성 정보 수신 동의' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                        <span className="font-medium text-gray-700">{label}</span>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => toggleDataField(key)}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${dataFields[key].enabled ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${dataFields[key].enabled ? 'translate-x-7' : 'translate-x-0'
                                }`}
                            />
                          </button>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dataFields[key].required}
                              onChange={() => toggleDataFieldRequired(key)}
                              disabled={!dataFields[key].enabled}
                              className={`w-5 h-5 rounded border-2 ${dataFields[key].enabled
                                ? 'border-blue-600 text-blue-600 cursor-pointer'
                                : 'border-gray-300 cursor-not-allowed opacity-50'
                                }`}
                            />
                            <span className={`text-sm font-medium ${dataFields[key].enabled ? 'text-gray-700' : 'text-gray-400'
                              }`}>
                              필수
                            </span>
                          </label>
                        </div>
                      </div>
                    ))}

                    {/* 상품 구매 기능 사용 */}
                    <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                      <span className="font-medium text-gray-700">상품 구매 기능 사용</span>
                      <button
                        type="button"
                        onClick={() => setProductPurchase({ ...productPurchase, enabled: !productPurchase.enabled })}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${productPurchase.enabled ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${productPurchase.enabled ? 'translate-x-7' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>

                    {/* 상품 구매 설정 */}
                    {productPurchase.enabled && (
                      <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-4">
                        <h3 className="font-bold text-gray-800 mb-3">상품 구매 설정</h3>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            결제 제공업체 <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="paymentProvider"
                                value="payapp"
                                checked={productPurchase.paymentProvider === 'payapp'}
                                onChange={(e) => setProductPurchase({ ...productPurchase, paymentProvider: 'payapp' })}
                                className="w-5 h-5"
                              />
                              <span>페이앱</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="paymentProvider"
                                value="welcomepay"
                                checked={productPurchase.paymentProvider === 'welcomepay'}
                                onChange={(e) => setProductPurchase({ ...productPurchase, paymentProvider: 'welcomepay' })}
                                className="w-5 h-5"
                              />
                              <span>웰컴페이먼츠</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            상품명 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={productPurchase.productName}
                            onChange={(e) => setProductPurchase({ ...productPurchase, productName: e.target.value })}
                            placeholder="상품명을 입력하세요"
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            판매가격 <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={productPurchase.sellingPrice}
                              onChange={(e) => setProductPurchase({ ...productPurchase, sellingPrice: parseInt(e.target.value) || 0 })}
                              placeholder="0"
                              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-gray-600">원</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">구매수량</label>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={productPurchase.useQuantity}
                                onChange={(e) => setProductPurchase({ ...productPurchase, useQuantity: e.target.checked })}
                                className="w-5 h-5 rounded border-2 border-blue-600 text-blue-600"
                              />
                              <span className="text-sm">구매수량 사용</span>
                            </label>
                            {productPurchase.useQuantity && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={productPurchase.purchaseQuantity}
                                  onChange={(e) => setProductPurchase({ ...productPurchase, purchaseQuantity: parseInt(e.target.value) || 0 })}
                                  placeholder="0"
                                  className="w-24 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-gray-600">개</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            결제 타입 <span className="text-red-500">*</span>
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="paymentType"
                                value="basic"
                                checked={productPurchase.paymentType === 'basic'}
                                onChange={(e) => setProductPurchase({ ...productPurchase, paymentType: 'basic' })}
                                className="w-5 h-5"
                              />
                              <span>기본타입</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="paymentType"
                                value="cardInput"
                                checked={productPurchase.paymentType === 'cardInput'}
                                onChange={(e) => setProductPurchase({ ...productPurchase, paymentType: 'cardInput' })}
                                className="w-5 h-5"
                              />
                              <span>카드번호입력#1</span>
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            * 인스타그램 혹은 페이스북 앱 내에서 결제 시 카드번호 입력으로 결제가 진행됩니다. (모듈 팝업 결제 방식을 제공하지 않음)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">결제요청시 연결그룹</label>
                          <div className="flex gap-2">
                            <select
                              value={productPurchase.paymentGroupId || ''}
                              onChange={(e) => setProductPurchase({ ...productPurchase, paymentGroupId: e.target.value ? parseInt(e.target.value) : null })}
                              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">결제요청시 그룹 선택</option>
                              {customerGroups.map(group => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setNewGroupTarget('payment');
                                setShowNewGroupModal(true);
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                            >
                              신규 그룹 만들기
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">DB 작성시 연결그룹</label>
                          <div className="flex gap-2">
                            <select
                              value={productPurchase.dbGroupId || ''}
                              onChange={(e) => setProductPurchase({ ...productPurchase, dbGroupId: e.target.value ? parseInt(e.target.value) : null })}
                              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">연결할 그룹 선택</option>
                              {customerGroups.map(group => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setNewGroupTarget('db');
                                setShowNewGroupModal(true);
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                            >
                              신규 그룹 만들기
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 추가 항목 (질문) */}
                  <div className="border-t-2 pt-4 mt-6">
                    <h3 className="font-bold text-gray-800 mb-4">추가 항목 (질문)</h3>
                    {additionalFields.length > 0 && (
                      <div className="space-y-3 mb-4">
                        {additionalFields.map((field, index) => (
                          <div key={field.id} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg bg-gray-50">
                            <span className="font-semibold text-gray-700 w-20">질문 #{index + 1}</span>
                            <input
                              type="text"
                              value={field.name}
                              onChange={(e) => setAdditionalFields(additionalFields.map(f =>
                                f.id === field.id ? { ...f, name: e.target.value } : f
                              ))}
                              placeholder="질문을 입력하세요"
                              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={() => toggleAdditionalFieldRequired(field.id)}
                                className="w-5 h-5 rounded border-2 border-blue-600 text-blue-600"
                              />
                              <span className="text-sm font-medium text-gray-700">필수</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => removeAdditionalField(field.id)}
                              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newAdditionalField}
                        onChange={(e) => setNewAdditionalField(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAdditionalField())}
                        placeholder="질문을 입력하세요"
                        className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addAdditionalField}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors shadow-md"
                      >
                        항목추가
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 그룹 연결 설정 */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">그룹 연결 설정</h2>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">연결할 그룹</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.groupId || ''}
                      onChange={(e) => setFormData({ ...formData, groupId: e.target.value ? parseInt(e.target.value) : null })}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">연결할 그룹 선택</option>
                      {customerGroups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setNewGroupTarget('main');
                        setShowNewGroupModal(true);
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      신규 그룹 만들기
                    </button>
                  </div>
                </div>
              </div>

              {/* 기타 설정 */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
                <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">기타 설정</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">댓글기능</label>
                      <p className="text-xs text-gray-500 mt-1">Gemini API로 자동 댓글 생성</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, commentEnabled: !formData.commentEnabled })}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${formData.commentEnabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${formData.commentEnabled ? 'translate-x-7' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>

                  {/* 댓글 설정 */}
                  {formData.commentEnabled && (
                    <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-4">
                      <h3 className="font-bold text-gray-800 mb-3">댓글 자동 생성 설정</h3>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          댓글 개수 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={commentSettings.count}
                          onChange={(e) => setCommentSettings({ ...commentSettings, count: parseInt(e.target.value) || 10 })}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">생성할 댓글 개수를 입력하세요 (1-100)</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            시작일 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={commentSettings.startDate}
                            onChange={(e) => setCommentSettings({ ...commentSettings, startDate: e.target.value })}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            종료일 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={commentSettings.endDate}
                            onChange={(e) => setCommentSettings({ ...commentSettings, endDate: e.target.value })}
                            min={commentSettings.startDate}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        * 지정한 날짜 범위 내에서 랜덤하게 댓글 작성일이 생성됩니다.<br />
                        * Gemini API가 글 내용과 이미지를 분석하여 자연스러운 댓글을 자동 생성합니다.<br />
                        * 댓글에는 ㅎㅎ, ㅋㅋ, ^^, :) 등의 이모티콘이 자연스럽게 포함됩니다.
                      </p>

                      {/* AI 댓글 미리보기 생성 버튼 */}
                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!commentSettings.count || !commentSettings.startDate || !commentSettings.endDate) {
                              alert('댓글 개수, 시작일, 종료일을 모두 입력해주세요.');
                              return;
                            }

                            setIsGeneratingComments(true);
                            try {
                              // 생성 페이지에서는 페이지 ID가 없으므로 샘플 댓글 생성
                              // HTML에서 텍스트 추출
                              const textContent = (formData.htmlContent || '')
                                .replace(/<[^>]*>/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim() || formData.title || '';

                              // 샘플 댓글 생성 (날짜 범위 내에서 랜덤 생성)
                              const startDate = new Date(commentSettings.startDate);
                              const endDate = new Date(commentSettings.endDate);
                              const timeDiff = endDate.getTime() - startDate.getTime();

                              const emojis = ['ㅎㅎ', 'ㅋㅋ', '^^', ':)', '👍', '😊', '👏', '🎉', '💕', '✨'];
                              const names = ['김민수', '이영희', '박지훈', '최수진', '정다은', '강호영', '윤소미', '임태현', '한지우', '오유진'];
                              const contents = [
                                '정말 좋은 정보네요! 이번 크루즈 여행에 참고하겠습니다.',
                                '저도 신청해볼게요! 기대가 되네요',
                                '완전 추천합니다! 친구들에게도 공유할게요',
                                '정보 감사합니다! 유용하게 사용하겠어요',
                                '정말 도움되는 글이네요!',
                                '저도 경험해보고 싶어요',
                                '꼭 한번 가보고 싶습니다!',
                                '좋은 정보 공유 감사합니다',
                                '이번 여행 계획에 참고하겠습니다',
                                '완전 대박이네요!'
                              ];

                              const sampleComments = Array.from({ length: Math.min(commentSettings.count, 50) }, (_, i) => ({
                                authorName: names[i % names.length],
                                content: `${contents[i % contents.length]} ${emojis[i % emojis.length]}`,
                                createdAt: new Date(
                                  startDate.getTime() + Math.random() * timeDiff
                                ).toISOString(),
                              }));

                              setPreviewComments(sampleComments);
                              alert(`${sampleComments.length}개의 댓글 미리보기가 생성되었습니다! 오른쪽 모바일 미리보기에서 확인하세요.`);
                            } catch (error: any) {
                              console.error('댓글 미리보기 생성 중 오류:', error);
                              alert(error?.message || '댓글 미리보기 생성 중 오류가 발생했습니다.');
                            } finally {
                              setIsGeneratingComments(false);
                            }
                          }}
                          disabled={isGeneratingComments || !commentSettings.count || !commentSettings.startDate || !commentSettings.endDate}
                          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-md"
                        >
                          {isGeneratingComments ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              생성 중...
                            </>
                          ) : (
                            <>
                              <span className="text-lg">✨</span>
                              AI 댓글 미리보기 생성
                            </>
                          )}
                        </button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          * 저장 전에는 샘플 댓글로 미리보기가 표시됩니다.
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">정보입력제한</label>
                    <select
                      value={formData.inputLimit}
                      onChange={(e) => setFormData({ ...formData, inputLimit: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="무제한 허용">무제한 허용 (신청자 또 받을 수 있음)</option>
                      <option value="1회만 허용">1회만 허용 (신청자 1번만 받음)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      * 그룹을 연결하여 데이터를 입력받을경우 제한을 사용할수 있습니다.<br />
                      랜딩페이지 랜딩데이터 입력 휴대폰 번호를 체크합니다.<br />
                      목록에서 데이터 확인후 삭제하면 다시 입력받을수 있습니다.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">신청완료 페이지</label>
                    <input
                      type="url"
                      value={formData.completionPageUrl}
                      onChange={(e) => setFormData({ ...formData, completionPageUrl: e.target.value })}
                      placeholder="* http:// 포함 url 입력"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">신청하기 버튼 제목</label>
                    <input
                      type="text"
                      value={formData.buttonTitle}
                      onChange={(e) => setFormData({ ...formData, buttonTitle: e.target.value })}
                      placeholder="예: 등록, 등록하기"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">* 하단의 신청하기 버튼의 텍스트를 변경할수 있습니다.</p>
                  </div>
                </div>
              </div>

              {/* 고급 설정 */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">고급 설정</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">헤더 스크립트</label>
                    <p className="text-xs text-gray-500 mb-2">구글, 페이스북 코드 심기</p>
                    <textarea
                      value={formData.headerScript}
                      onChange={(e) => setFormData({ ...formData, headerScript: e.target.value })}
                      rows={6}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="HTML head 태그에 삽입할 스크립트"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">사업자 정보</label>
                    <div className="space-y-2 text-sm">
                      <input
                        type="text"
                        placeholder="사이트명"
                        value={businessInfoFields.siteName}
                        onChange={(e) => setBusinessInfoFields({ ...businessInfoFields, siteName: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="회사명"
                        value={businessInfoFields.companyName}
                        onChange={(e) => setBusinessInfoFields({ ...businessInfoFields, companyName: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="대표전화"
                        value={businessInfoFields.businessPhone}
                        onChange={(e) => setBusinessInfoFields({ ...businessInfoFields, businessPhone: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="개인정보담당"
                        value={businessInfoFields.privacyOfficer}
                        onChange={(e) => setBusinessInfoFields({ ...businessInfoFields, privacyOfficer: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="사업자등록번호"
                        value={businessInfoFields.businessNumber}
                        onChange={(e) => setBusinessInfoFields({ ...businessInfoFields, businessNumber: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="주소"
                        value={businessInfoFields.address}
                        onChange={(e) => setBusinessInfoFields({ ...businessInfoFields, address: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">노출용 이미지</label>
                    <p className="text-xs text-gray-500 mb-2">* 1200 x 630 권장 (광고 썸네일)</p>
                    {/* 저장된 이미지가 있는 경우 표시 */}
                    {exposureImageUrl && !exposureImagePreview && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium mb-2">현재 저장된 이미지:</p>
                        <div className="flex items-center gap-3">
                          <img
                            src={exposureImageUrl}
                            alt="저장된 노출용 이미지"
                            className="w-20 h-20 object-cover rounded border border-gray-300"
                          />
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 break-all">{exposureImageUrl}</p>
                            <button
                              type="button"
                              onClick={() => setExposureImageUrl(null)}
                              className="mt-2 text-xs text-red-600 hover:text-red-800"
                            >
                              이미지 제거
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 새로 업로드한 이미지 미리보기 */}
                    {exposureImagePreview && (
                      <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 font-medium mb-2">새로 업로드할 이미지:</p>
                        <div className="relative">
                          <img
                            src={exposureImagePreview}
                            alt="노출용 이미지 미리보기"
                            className="w-full max-w-xs h-auto object-cover rounded border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setExposureImagePreview(null);
                              setFormData({ ...formData, exposureImage: null });
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setFormData({ ...formData, exposureImage: file });
                        if (file) {
                          const previewUrl = URL.createObjectURL(file);
                          setExposureImagePreview(previewUrl);
                          // 새 파일을 선택하면 기존 저장된 이미지 URL 초기화
                          setExposureImageUrl(null);
                        } else {
                          setExposureImagePreview(null);
                        }
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                    />
                    {/* SNS 공유 미리보기 */}
                    {(exposureImagePreview || exposureImageUrl) && (
                      <div className="mt-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">SNS 공유 미리보기</h3>
                        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm max-w-md">
                          {/* 이미지 */}
                          <div className="w-full aspect-[1.91/1] bg-gray-100 overflow-hidden">
                            <img
                              src={exposureImagePreview || exposureImageUrl || ''}
                              alt="노출용 이미지"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {/* 제목 및 설명 */}
                          <div className="p-4">
                            {formData.exposureTitle && (
                              <h4 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
                                {formData.exposureTitle}
                              </h4>
                            )}
                            {formData.description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {formData.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 truncate">
                              {typeof window !== 'undefined' ? window.location.origin : ''}/landing/{savedPageId ? `landing-${savedPageId}` : '...'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">카카오톡, 페이스북 등에서 공유 시 이렇게 표시됩니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-4 pb-6">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold shadow-lg transition-colors"
                >
                  <FiSave size={20} />
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 이미지 업로드 모달 */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">사진 첨부하기</h2>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImages([]);
                  setCruisePhotos([]);
                  setCruisePhotoSearch('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* 탭 */}
            <div className="border-b px-6 py-3 flex gap-2">
              <button
                onClick={() => setImageModalMode('upload')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${imageModalMode === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                파일 선택
              </button>
              <button
                onClick={() => setImageModalMode('cruise')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${imageModalMode === 'cruise'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                크루즈정보사진
              </button>
            </div>

            {/* 내용 */}
            <div className="p-6">
              {imageModalMode === 'upload' ? (
                <div>
                  {/* 안내 문구 */}
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      마우스로 드래그하여 순서를 바꿀 수 있습니다.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        파일선택
                      </button>
                      <button
                        onClick={() => setSelectedImages([])}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                      >
                        전체삭제
                      </button>
                    </div>
                  </div>

                  {/* 드래그 앤 드롭 영역 */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mb-6 min-h-[300px] flex flex-col items-center justify-center"
                  >
                    {selectedImages.length === 0 ? (
                      <>
                        <div className="text-6xl text-gray-400 mb-4">📄</div>
                        <p className="text-gray-600 mb-4">
                          마우스로 드래그해서 이미지를 추가해주세요.
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </>
                    ) : (
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-4 w-full">
                        {selectedImages.map((img, index) => (
                          <div
                            key={index}
                            draggable
                            onDragStart={() => handleImageDragStart(index)}
                            onDragOver={(e) => handleImageDragOver(e, index)}
                            onDragLeave={handleImageDragLeave}
                            onDrop={(e) => handleImageDrop(e, index)}
                            onDragEnd={handleImageDragEnd}
                            className={`relative group cursor-move transition-all ${draggedImageIndex === index ? 'opacity-50 scale-95' : ''
                              } ${dragOverIndex === index ? 'ring-4 ring-blue-400 scale-105' : ''
                              }`}
                          >
                            <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-1 rounded z-10">
                              {index + 1}
                            </div>
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 pointer-events-none"
                              draggable={false}
                            />
                            <button
                              onClick={() => {
                                setSelectedImages(selectedImages.filter((_, i) => i !== index));
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <FiX size={14} />
                            </button>
                            <p className="text-xs text-gray-600 mt-1 truncate">{img.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 안내 사항 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1 text-sm text-gray-700">
                    <p>• 이미지는 한번에 10개까지 선택할 수 있습니다.</p>
                    <p>• 20MB 이하의 이미지 파일만 등록할 수 있습니다.</p>
                    <p>• 이미지는 압축되어서 업로드될 수 있습니다.</p>
                    <p>• 가로 1200px, 세로 20000px로 변경될 수 있습니다.</p>
                  </div>
                </div>
              ) : (
                <div>
                  {/* 검색 */}
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={cruisePhotoSearch}
                      onChange={(e) => setCruisePhotoSearch(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleCruisePhotoSearch();
                        }
                      }}
                      placeholder="크루즈정보사진 검색 (예: 코스타 세레나)"
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleCruisePhotoSearch}
                      disabled={isLoadingCruisePhotos}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                      {isLoadingCruisePhotos ? '검색 중...' : '검색'}
                    </button>
                  </div>

                  {/* 검색 결과 */}
                  {cruisePhotos.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mb-4">
                      {cruisePhotos.map((photo, index) => (
                        <div
                          key={index}
                          className="relative group cursor-pointer"
                          onClick={() => {
                            const isSelected = selectedImages.some((img) => img.url === photo.url);
                            if (isSelected) {
                              setSelectedImages(selectedImages.filter((img) => img.url !== photo.url));
                            } else {
                              if (selectedImages.length >= 10) {
                                alert('이미지는 한번에 10개까지 선택할 수 있습니다.');
                                return;
                              }
                              setSelectedImages([...selectedImages, { url: photo.url, name: photo.title || `사진 ${index + 1}` }]);
                            }
                          }}
                        >
                          <img
                            src={photo.url}
                            alt={photo.title || `사진 ${index + 1}`}
                            className={`w-full h-32 object-cover rounded-lg border-2 transition-all ${selectedImages.some((img) => img.url === photo.url)
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : 'border-gray-200'
                              }`}
                          />
                          {selectedImages.some((img) => img.url === photo.url) && (
                            <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                              ✓
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      {cruisePhotoSearch ? '검색 결과가 없습니다.' : '검색어를 입력하고 검색 버튼을 클릭하세요.'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImages([]);
                  setCruisePhotos([]);
                  setCruisePhotoSearch('');
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                취소
              </button>
              <button
                onClick={insertImagesToEditor}
                disabled={selectedImages.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                등록 ({selectedImages.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신규 그룹 추가 모달 */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">그룹 생성</h2>
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setNewGroupName('');
                  setNewGroupDescription('');
                  setNewGroupColor('#3B82F6');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  그룹 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="예: 동남아 고객, 일본 고객"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  그룹 설명
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="그룹에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  그룹 색상
                </label>
                <input
                  type="color"
                  value={newGroupColor}
                  onChange={(e) => setNewGroupColor(e.target.value)}
                  className="w-full h-12 rounded-lg border border-gray-300 cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGroupModal(false);
                    setNewGroupName('');
                    setNewGroupDescription('');
                    setNewGroupColor('#3B82F6');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewGroup}
                  disabled={isCreatingGroup || !newGroupName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingGroup ? '생성 중...' : '생성'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
