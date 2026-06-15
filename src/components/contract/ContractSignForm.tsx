'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ContractInputField,
  InputFieldDef,
  InputFieldValue,
  validateInputField,
} from './ContractInputField';
import { ChevronDown } from 'lucide-react';

interface ContractSignFormProps {
  inputFields?: InputFieldDef[];
  onFieldsChange: (fields: InputFieldValue[]) => void;
  contactAutoFill?: Record<string, string | boolean>;
  showCompactPreview?: boolean;
}

export function ContractSignForm({
  inputFields = [],
  onFieldsChange,
  contactAutoFill = {},
  showCompactPreview = true,
}: ContractSignFormProps) {
  // 필드별 value 상태 관리 (contactAutoFill로 초기화)
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    inputFields.forEach((field) => {
      initial[field.key] = contactAutoFill[field.key] || field.defaultValue || '';
    });
    return initial;
  });

  // 필드별 에러 상태 관리
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 섹션별로 필드 그룹화 (향후 섹션 기능 확장용)
  const groupedFields = useMemo(() => {
    const groups: Record<string, InputFieldDef[]> = {};
    inputFields.forEach((field) => {
      const section = 'contactInfo'; // 기본값: contactInfo 섹션
      if (!groups[section]) groups[section] = [];
      groups[section].push(field);
    });
    return groups;
  }, [inputFields]);

  // 필드 값 변경 핸들러
  const handleFieldChange = useCallback(
    (fieldKey: string, value: string | boolean) => {
      setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));

      // 에러 재검증
      const field = inputFields.find((f) => f.key === fieldKey);
      if (field) {
        const error = validateInputField(field, value);
        setFieldErrors((prev) => {
          const next = { ...prev };
          if (error) {
            next[fieldKey] = error;
          } else {
            delete next[fieldKey];
          }
          return next;
        });
      }

      // 부모에 변경 알림 (1회)
      const outputFields: InputFieldValue[] = Object.entries(fieldValues).map(
        ([key, val]) => ({
          key,
          value: key === fieldKey ? value : val,
        })
      );
      onFieldsChange(outputFields);
    },
    [inputFields, fieldValues, onFieldsChange]
  );

  // 전체 유효성 검사
  const validateAll = useCallback(() => {
    const errors: Record<string, string> = {};
    let isValid = true;

    inputFields.forEach((field) => {
      const error = validateInputField(field, fieldValues[field.key]);
      if (error) {
        errors[field.key] = error;
        isValid = false;
      }
    });

    setFieldErrors(errors);
    return isValid;
  }, [inputFields, fieldValues]);

  // 미리보기: 구성된 필드들의 요약
  const previewData = useMemo(() => {
    return inputFields
      .filter((f) => fieldValues[f.key])
      .slice(0, 3) // 처음 3개만 표시
      .map((f) => ({
        label: f.label,
        value: String(fieldValues[f.key]),
      }));
  }, [inputFields, fieldValues]);

  if (inputFields.length === 0) {
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
            {inputFields.filter((f) => f.required).length}개 필수 정보를 입력해주세요
          </p>
        </div>

        {/* 필드별 렌더링 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(groupedFields).map(([section, fields]) =>
            fields.map((field) => (
              <div key={field.key}>
                <ContractInputField
                  field={field}
                  value={fieldValues[field.key] ?? ''}
                  onChange={handleFieldChange}
                  error={fieldErrors[field.key]}
                  disabled={false}
                />
              </div>
            ))
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
              ✓ 입력 내용 미리보기 ({inputFields.length}개 필드)
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
            {inputFields.length > 3 && (
              <p className="text-xs text-gray-600 italic pt-2">
                외 {inputFields.length - 3}개 항목...
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
            {Object.entries(fieldErrors).map(([key, error]) => (
              <li key={key} className="text-sm text-red-800">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Hook: 입력 필드 유효성 검사 + 데이터 추출
export function useContractSignForm() {
  const [formData, setFormData] = useState<InputFieldValue[]>([]);
  const [isValid, setIsValid] = useState(false);

  const handleFieldsChange = useCallback((fields: InputFieldValue[]) => {
    setFormData(fields);
  }, []);

  const validate = useCallback((inputFields: InputFieldDef[]) => {
    let valid = true;
    for (const field of inputFields) {
      const fieldData = formData.find((f) => f.key === field.key);
      const value = fieldData?.value ?? '';
      const error = validateInputField(field, value);
      if (error) {
        valid = false;
        break;
      }
    }
    setIsValid(valid);
    return valid;
  }, [formData]);

  return {
    formData,
    isValid,
    handleFieldsChange,
    validate,
  };
}
