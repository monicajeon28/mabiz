// components/admin/IncludedExcludedEditor.tsx
// 포함/불포함 사항 편집기 (useReducer + 컴포넌트 분리)

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { FiX, FiSave, FiFolder, FiTrash2, FiCheck, FiChevronDown } from 'react-icons/fi';
import suggestionsData from '@/data/included-excluded-suggestions.json';
import { showSuccess, showError } from '@/components/ui/Toast';
import { inclusionSetArraySchema, type InclusionSet } from '@/lib/schemas/inclusionSet';
import { logger } from '@/lib/logger';
import { migrateInclusionSetIds } from '@/lib/migrations/inclusionSetMigration';
import { csrfFetch } from '@/lib/csrf-client';
import ItemSection from './ItemSection';

// ---------- 설정 ----------

const STORAGE_KEY = 'inclusionSets';
const API_BASE = '/api/admin/inclusion-groups';

async function loadSets(): Promise<InclusionSet[]> {
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) {
      // 폴백: localStorage에서 로드
      logger.warn('API 요청 실패, localStorage 사용 폴백');
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const migrated = migrateInclusionSetIds(parsed.sets || []);
      const validated = inclusionSetArraySchema.parse({ sets: migrated });
      return validated.sets;
    }

    const data = await response.json();
    if (!data.ok || !Array.isArray(data.sets)) {
      throw new Error('Invalid API response');
    }

    const validated = inclusionSetArraySchema.parse({ sets: data.sets });
    return validated.sets;
  } catch (err) {
    logger.error('Failed to load inclusion sets from API', { error: String(err) });
    showError('저장된 세트를 불러올 수 없습니다. 다시 시도해주세요.');
    return [];
  }
}

async function saveSets(name: string, includes: string[], excludes: string[]): Promise<InclusionSet | null> {
  try {
    const response = await csrfFetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: `set_${nanoid(12)}`,
        name,
        includes,
        excludes,
        createdAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save set');
    }

    const data = await response.json();
    if (!data.ok || !data.set) {
      throw new Error('Invalid API response');
    }

    return data.set as InclusionSet;
  } catch (err) {
    logger.error('Failed to save inclusion set', { error: String(err) });
    showError(String(err instanceof Error ? err.message : 'Failed to save set'));
    return null;
  }
}

async function deleteSets(setId: string): Promise<boolean> {
  try {
    const response = await csrfFetch(API_BASE, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ setId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete set');
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error('Invalid API response');
    }

    return true;
  } catch (err) {
    logger.error('Failed to delete inclusion set', { error: String(err) });
    showError(String(err instanceof Error ? err.message : 'Failed to delete set'));
    return false;
  }
}

// ---------- SetToolbar (세트 저장/불러오기 툴바) ----------

interface SetToolbarProps {
  included: string[];
  excluded: string[];
  onLoad: (set: InclusionSet) => void;
}

function SetToolbar({ included, excluded, onLoad }: SetToolbarProps) {
  const [sets, setSets] = useState<InclusionSet[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    loadSetsList();
  }, []);

  const loadSetsList = useCallback(async () => {
    setIsLoading(true);
    const loaded = await loadSets();
    setSets(loaded);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleSaveClick = useCallback(() => {
    if (included.length === 0 && excluded.length === 0) {
      showError('저장할 포함/불포함 항목이 없습니다.');
      return;
    }
    setShowSaveInput(true);
    setTimeout(() => saveInputRef.current?.focus(), 50);
  }, [included, excluded]);

  const confirmSave = useCallback(async () => {
    const name = savingName.trim();
    if (!name) return;

    setIsLoading(true);
    const saved = await saveSets(name, [...included], [...excluded]);
    setIsLoading(false);

    if (saved) {
      setSets([...sets, saved]);
      setSavingName('');
      setShowSaveInput(false);
      showSuccess(`"${name}" 세트가 저장되었습니다.`);
    }
  }, [savingName, included, excluded, sets]);

  const handleLoad = useCallback(
    (set: InclusionSet) => {
      onLoad(set);
      setShowDropdown(false);
      showSuccess(`"${set.name}" 세트를 불러왔습니다.`);
    },
    [onLoad]
  );

  const handleDelete = useCallback(
    async (set: InclusionSet, e: React.MouseEvent) => {
      e.stopPropagation();
      setIsLoading(true);
      const success = await deleteSets(set.id);
      setIsLoading(false);

      if (success) {
        const updated = sets.filter((s) => s.id !== set.id);
        setSets(updated);
        showSuccess(`"${set.name}" 세트가 삭제되었습니다.`);
      }
    },
    [sets]
  );

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  if (!isMounted) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-6 flex-wrap">
      <span className="text-sm font-semibold text-gray-600 mr-1">포함/불포함 세트:</span>

      {showSaveInput ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={saveInputRef}
            type="text"
            value={savingName}
            onChange={(e) => setSavingName(e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmSave();
              else if (e.key === 'Escape') {
                setShowSaveInput(false);
                setSavingName('');
              }
            }}
            placeholder="세트 이름 (예: 지중해 표준)"
            maxLength={50}
            className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 w-48"
          />
          <button
            type="button"
            onClick={confirmSave}
            disabled={isLoading}
            className="flex items-center justify-center h-11 w-11 md:h-10 md:w-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="저장"
          >
            <FiCheck size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSaveInput(false);
              setSavingName('');
            }}
            className="flex items-center justify-center h-11 w-11 md:h-10 md:w-10 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="취소"
          >
            <FiX size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 h-11 md:h-auto md:py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          title="현재 내용 저장"
        >
          <FiSave size={16} />
          <span>{isLoading ? '저장 중...' : '저장'}</span>
        </button>
      )}

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown((prev) => !prev)}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 h-11 md:h-auto md:py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          title="저장된 세트 불러오기"
        >
          <FiFolder size={16} />
          <span>세트</span>
          <FiChevronDown size={16} className={showDropdown ? 'rotate-180' : ''} />
        </button>

        {showDropdown && (
          <div className="absolute left-0 top-full mt-1 z-50 min-w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {sets.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                저장된 세트가 없습니다.
              </div>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {sets.map((set) => (
                  <li key={set.id} className="flex items-center group hover:bg-blue-50 transition-colors">
                    <button
                      type="button"
                      onClick={() => handleLoad(set)}
                      className="flex-1 flex flex-col min-w-0 px-4 py-2.5 text-left"
                    >
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {set.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        포함 {set.includes.length}개 · 불포함 {set.excludes.length}개 ·{' '}
                        {formatDate(set.createdAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(set, e)}
                      disabled={isLoading}
                      className="mr-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex-shrink-0"
                      title="세트 삭제"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {(included.length > 0 || excluded.length > 0) && (
        <span className="ml-auto text-xs text-gray-400">
          현재: 포함 {included.length}개 · 불포함 {excluded.length}개
        </span>
      )}
    </div>
  );
}

// ---------- 메인 컴포넌트 ----------

export interface IncludedExcludedEditorProps {
  included: string[];
  excluded: string[];
  onChange: (included: string[], excluded: string[]) => void;
}

export default function IncludedExcludedEditor({
  included,
  excluded,
  onChange,
}: IncludedExcludedEditorProps) {
  const handleLoadSet = (set: InclusionSet) => {
    onChange([...set.includes], [...set.excludes]);
  };

  return (
    <div className="space-y-8">
      <SetToolbar included={included} excluded={excluded} onLoad={handleLoadSet} />

      <ItemSection
        type="included"
        items={included}
        onChange={(items) => onChange(items, excluded)}
        suggestionsData={suggestionsData.included}
      />

      <ItemSection
        type="excluded"
        items={excluded}
        onChange={(items) => onChange(included, items)}
        suggestionsData={suggestionsData.excluded}
      />
    </div>
  );
}
