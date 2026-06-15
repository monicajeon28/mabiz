'use client';

import { useState, useCallback } from 'react';
import type {
  ContractInputField as TemplateField,
  ContractInputFieldType,
} from '@/lib/types/contract-templates';

/**
 * Phase 6: 입력 필드 타입 정의
 * email, phone, number를 추가로 지원하여 text와 구분
 */
export type InputFieldType = ContractInputFieldType | 'email' | 'phone' | 'number';

export interface InputFieldOption {
  label: string;
  value: string;
}

/**
 * Phase 6: 입력 필드 정의 인터페이스
 * ContractInputField와 호환 가능하며 선택적으로 key/defaultValue 추가 지원
 */
export interface InputFieldDef extends Omit<TemplateField, 'id'> {
  // 호환성: 'id' 또는 'key' 사용 가능
  id?: string;
  key?: string;
  type: InputFieldType;
  defaultValue?: string;
  /** Contact 필드값 자동 초기화 (선택사항) */
  contactFieldName?: string | null;
}

export interface InputFieldValue {
  key: string;
  value: string | boolean;
}

interface ContractInputFieldProps {
  field: InputFieldDef;
  value: string | boolean;
  onChange: (fieldKey: string, value: string | boolean) => void;
  error?: string;
  disabled?: boolean;
}

const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export function ContractInputField({
  field,
  value,
  onChange,
  error,
  disabled,
}: ContractInputFieldProps) {
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (newValue: string | boolean) => {
      // Handle both key and id properties for compatibility
      const fieldKey = field.key || (field as any).id || '';
      onChange(fieldKey, newValue);
    },
    [field.key, onChange]
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const showError = touched && error;

  switch (field.type) {
    case 'text': {
      const maxLength = field.maxLength ?? 100;
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-600 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={String(value)}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            disabled={disabled}
            maxLength={maxLength}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
              showError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-600'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          />
          {field.helpText && (
            <p className="text-xs text-gray-500">{field.helpText}</p>
          )}
          {showError && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );
    }

    case 'email':
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-600 ml-1">*</span>}
          </label>
          <input
            type="email"
            value={String(value)}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
              showError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-600'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          />
          {field.helpText && (
            <p className="text-xs text-gray-500">{field.helpText}</p>
          )}
          {showError && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );

    case 'phone':
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-600 ml-1">*</span>}
          </label>
          <input
            type="tel"
            value={String(value)}
            onChange={(e) => {
              const formatted = formatPhoneNumber(e.target.value);
              handleChange(formatted);
            }}
            onBlur={handleBlur}
            placeholder={field.placeholder || '010-0000-0000'}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
              showError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-600'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          />
          {field.helpText && (
            <p className="text-xs text-gray-500">{field.helpText}</p>
          )}
          {showError && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-600 ml-1">*</span>}
          </label>
          <input
            type="number"
            value={String(value)}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
              showError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-600'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          />
          {field.helpText && (
            <p className="text-xs text-gray-500">{field.helpText}</p>
          )}
          {showError && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );

    case 'date':
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-600 ml-1">*</span>}
          </label>
          <input
            type="date"
            value={String(value)}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
              showError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-600'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          />
          {field.helpText && (
            <p className="text-xs text-gray-500">{field.helpText}</p>
          )}
          {showError && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );

    case 'dropdown':
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-600 ml-1">*</span>}
          </label>
          <select
            value={String(value)}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
              showError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-600'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          >
            <option value="">{field.placeholder || '선택하세요'}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.helpText && (
            <p className="text-xs text-gray-500">{field.helpText}</p>
          )}
          {showError && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChange(e.target.checked)}
              onBlur={handleBlur}
              disabled={disabled}
              className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-600 ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              }`}
            />
            <span className="text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-600 ml-1">*</span>}
            </span>
          </label>
          {field.helpText && (
            <p className="text-xs text-gray-500 ml-6">{field.helpText}</p>
          )}
          {showError && <p className="text-xs text-red-600 ml-6">{error}</p>}
        </div>
      );

    default:
      return null;
  }
}

// Validation helper
export function validateInputField(field: InputFieldDef, value: string | boolean): string | null {
  const stringValue = String(value);

  if (field.required && !stringValue.trim()) {
    return `${field.label}은 필수 입력 항목입니다`;
  }

  if (!field.required && !stringValue.trim()) {
    return null; // 선택사항이고 비어있으면 OK
  }

  if (field.type === 'email' && stringValue.trim()) {
    if (!emailRegex.test(stringValue)) {
      return '올바른 이메일 형식이 아닙니다';
    }
  }

  if (field.type === 'phone' && stringValue.trim()) {
    if (!phoneRegex.test(stringValue)) {
      return '올바른 전화번호 형식이 아닙니다 (010-0000-0000)';
    }
  }

  if (field.type === 'date' && stringValue.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
      return '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)';
    }
  }

  if (field.pattern && stringValue.trim()) {
    try {
      const regex = new RegExp(field.pattern);
      if (!regex.test(stringValue)) {
        return `${field.label} 형식이 올바르지 않습니다`;
      }
    } catch (e) {
      // Pattern 파싱 오류는 무시
    }
  }

  return null;
}
