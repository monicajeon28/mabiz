'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ContractInputField as TemplateInputField } from '@/lib/types/contract-templates';
import {
  extractAllContactFieldValues,
  validateAllFieldValues,
  sortFieldsByOrder,
} from '@/lib/utils/contract-field-mapper';
import {
  ContractInputField,
  InputFieldDef,
  InputFieldValue,
  validateInputField,
} from './ContractInputField';
import { ChevronDown } from 'lucide-react';

interface ContractSignFormProps {
  /**
   * Phase 6: inputFields는 InputFieldDef[] 또는 ContractInputField[] 타입
   * 계약서 템플릿에서 정의된 입력 필드
   */
  inputFields?: InputFieldDef[];
  onFieldsChange: (fields: InputFieldValue[]) => void;
  /**
   * Contact 객체로부터 자동 채우기
   * Contact 필드가 InputFieldDef.contactFieldName과 일치하면 자동 매핑
   */
  contact?: Record<string, any> | null;
  /**
   * 레거시: boundData를 Contact 형식으로 변환해 전달 가능
   */
  contactAutoFill?: Record<string, string | boolean> | null;
  showCompactPreview?: boolean;
}

export function ContractSignForm({
  inputFields = [],
  onFieldsChange,
  contact = null,
  contactAutoFill = null,
  showCompactPreview = true,
}: ContractSignFormProps) {
  // 필드 ID 정규화: id 또는 key 둘 다 사용 가능
  const normalizedFields = useMemo(
    () =>
      inputFields.map((field) => ({
        ...field,
        id: field.id || field.key || '',
        key: field.key || field.id || '',
      })),
    [inputFields]
  );

  // Phase 6: inputFields를 정렬하고 Contact 값 자동 추출
  const sortedFields = useMemo(() => {
    if (!normalizedFields || normalizedFields.length === 0) {
      return [];
    }
    // Properly typed sort using ContractInputField order property
    const fields = normalizedFields as unknown as TemplateInputField[];
    return sortFieldsByOrder(fields);
  }, [normalizedFields]);

  // Contact 병합: contact || contactAutoFill
  const mergedContact = useMemo(() => {
    return contact || contactAutoFill || null;
  }, [contact, contactAutoFill]);

  const contactValues = useMemo(() => {
    if (!mergedContact || sortedFields.length === 0) {
      return {};
    }
    // Extract values from Contact based on field's contactFieldName mapping
    const result: Record<string, any> = {};
    for (const field of sortedFields) {
      const fieldId = field.id || '';
      const fieldName = field.contactFieldName || (field as any).contactFieldName;
      if (fieldName) {
        const value = extractAllContactFieldValues(mergedContact, [fieldName]);
        if (value && value[fieldName] !== undefined) {
          result[fieldId] = value[fieldName];
        }
      }
    }
    return result;
  }, [mergedContact, sortedFields]);

  // 필드별 value 상태 관리 (Contact 값으로 초기화)
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    sortedFields.forEach((field) => {
      // 우선순위: 1) Contact 자동 추출값 2) contactAutoFill 직접 매핑 3) 기본값 4) 빈 문자열
      const fieldId = field.id || '';
      const fromContact = contactValues[fieldId];
      const fromAutoFill = contactAutoFill ? contactAutoFill[fieldId] : undefined;
      initial[fieldId] = fromContact ?? fromAutoFill ?? field.defaultValue ?? '';
    });
    return initial;
  });

  // 필드별 에러 상태 관리
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 섹션별로 필드 그룹화 (향후 섹션 기능 확장용)
  const groupedFields = useMemo(() => {
    const groups: Record<string, TemplateInputField[]> = {};
    sortedFields.forEach((field) => {
      // 향후 섹션 지원 시 category 필드 추가
      const section = 'contactInfo'; // 기본값: contactInfo 섹션
      if (!groups[section]) groups[section] = [];
      groups[section].push(field);
    });
    return groups;
  }, [sortedFields]);

  // 필드 값 변경 핸들러
  const handleFieldChange = useCallback(
    (fieldId: string, value: string | boolean) => {
      setFieldValues((prev) => ({ ...prev, [fieldId]: value }));

      // 에러 재검증 (validator 함수는 간단한 체크만 - 자세한 검증은 validateAllFieldValues 사용)
      const field = sortedFields.find((f) => f.id === fieldId);
      if (field) {
        // ContractInputField 기반 검증
        const strValue = String(value).trim();
        let error: string | null = null;

        if (field.required && !strValue) {
          error = `${field.label}은(는) 필수입니다`;
        } else if (strValue) {
          // 간단한 타입별 검증
          switch (field.type) {
            case 'date':
              if (!/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
                error = `${field.label}은(는) YYYY-MM-DD 형식이어야 합니다`;
              }
              break;
            case 'email':
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
                error = `${field.label}은(는) 올바른 이메일 형식이 아닙니다`;
              }
              break;
            case 'phone':
              if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(strValue)) {
                error = `${field.label}은(는) 올바른 전화번호 형식이 아닙니다`;
              }
              break;
          }
        }

        setFieldErrors((prev) => {
          const next = { ...prev };
          if (error) {
            next[fieldId] = error;
          } else {
            delete next[fieldId];
          }
          return next;
        });
      }

      // 부모에 변경 알림
      const outputFields: InputFieldValue[] = Object.entries(fieldValues).map(
        ([key, val]) => ({
          key,
          value: key === fieldId ? value : val,
        })
      );
      onFieldsChange(outputFields);
    },
    [sortedFields, fieldValues, onFieldsChange]
  );

  // 전체 유효성 검사 (contract-field-mapper 유틸 사용)
  const validateAll = useCallback(() => {
    const validation = validateAllFieldValues(sortedFields, fieldValues);
    setFieldErrors(validation.errors);
    return validation.isValid;
  }, [sortedFields, fieldValues]);

  // 미리보기: 구성된 필드들의 요약
  const previewData = useMemo(() => {
    return sortedFields
      .filter((f) => {
        const fieldId = f.id || '';
        return fieldValues[fieldId];
      })
      .slice(0, 3) // 처음 3개만 표시
      .map((f) => ({
        label: f.label,
        value: String(fieldValues[f.id || '']),
      }));
  }, [sortedFields, fieldValues]);

  if (sortedFields.length === 0) {
    return null; // 입력 필드가 없으면 렌더링 안 함
  }

  return (
    <div className="space-y-6">
      {/* 필드 입력 섹션 */}
      <div className="border-2 border-gray-300 rounded-lg p-6 bg-white space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📋 계약서 정보 입력
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {sortedFields.filter((f) => f.required).length}개 필수 정보를 입력해주세요
          </p>
        </div>

        {/* 필드별 렌더링 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(groupedFields).map(([section, fields]) =>
            fields.map((field) => {
              const fieldId = field.id || '';
              // InputFieldDef 형식으로 변환
              const fieldDef: InputFieldDef = {
                ...field,
                key: fieldId,
              };
              return (
                <div key={fieldId}>
                  <ContractInputField
                    field={fieldDef}
                    value={fieldValues[fieldId] ?? ''}
                    onChange={(key, value) => handleFieldChange(fieldId, value)}
                    error={fieldErrors[fieldId]}
                    disabled={false}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* 검증 버튼 */}
        <button
          type="button"
          onClick={validateAll}
          className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          입력 내용 검증
        </button>
      </div>

      {/* 미리보기 섹션 (선택사항) */}
      {showCompactPreview && previewData.length > 0 && (
        <details className="border-2 border-blue-300 rounded-lg bg-blue-50 overflow-hidden">
          <summary className="px-6 py-4 cursor-pointer flex items-center justify-between hover:bg-blue-100 transition">
            <span className="font-medium text-gray-900">
              ✓ 입력 내용 미리보기 ({sortedFields.length}개 필드)
            </span>
            <ChevronDown className="h-4 w-4 text-gray-600" />
          </summary>

          <div className="px-6 py-4 space-y-2 border-t border-blue-300">
            {previewData.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-600 font-medium">{item.label}:</span>
                <span className="text-gray-900 font-semibold">{item.value}</span>
              </div>
            ))}
            {sortedFields.length > 3 && (
              <p className="text-xs text-gray-600 italic pt-2">
                외 {sortedFields.length - 3}개 항목...
              </p>
            )}
          </div>
        </details>
      )}

      {/* 에러 요약 */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 rounded">
          <p className="text-sm font-medium text-red-900">
            {Object.keys(fieldErrors).length}개 필드에 오류가 있습니다:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1">
            {Object.entries(fieldErrors).map(([fieldId, error]) => (
              <li key={fieldId} className="text-sm text-red-800">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Phase 6: useContractSignForm Hook
 * ContractSignForm으로부터 입력 필드 값 추출 및 검증
 */
export function useContractSignForm() {
  const [formData, setFormData] = useState<InputFieldValue[]>([]);
  const [isValid, setIsValid] = useState(false);

  const handleFieldsChange = useCallback((fields: InputFieldValue[]) => {
    setFormData(fields);
  }, []);

  /**
   * 입력 필드 배열과 폼 데이터를 바탕으로 전체 유효성 검사
   * @param inputFields InputFieldDef[] 배열 (id 또는 key 필드 포함)
   */
  const validate = useCallback((inputFields: InputFieldDef[]) => {
    // formData를 Record<fieldId, value>로 변환
    const fieldValues: Record<string, any> = {};
    formData.forEach((f) => {
      fieldValues[f.key] = f.value;
    });

    // 필드 정규화
    const normalizedFields = inputFields.map((field) => ({
      ...field,
      id: field.id || field.key || '',
    })) as TemplateInputField[];

    // validateAllFieldValues 유틸 사용
    const validation = validateAllFieldValues(normalizedFields, fieldValues);
    setIsValid(validation.isValid);
    return validation.isValid;
  }, [formData]);

  return {
    formData,
    isValid,
    handleFieldsChange,
    validate,
  };
}
