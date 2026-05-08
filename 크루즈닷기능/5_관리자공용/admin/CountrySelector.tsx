// components/admin/CountrySelector.tsx
// 방문 국가 선택 컴포넌트 (온보딩과 동일한 방식)

'use client';

import { useMemo, useState } from 'react';
import { normalize } from '@/utils/normalize';
import { Option } from '@/components/CountrySelect';
import CountrySelect from '@/components/CountrySelect';
import countries from '@/data/countries.json';

interface CountrySelectorProps {
  selectedCountries: Option[];
  onChange: (countries: Option[]) => void;
  maxCount?: number;
  label?: string;
}

export default function CountrySelector({
  selectedCountries,
  onChange,
  maxCount = 10,
  label = '방문 국가 설정'
}: CountrySelectorProps) {
  const [visitCount, setVisitCount] = useState<number>(selectedCountries.length || 1);
  const [countrySearchTerm, setCountrySearchTerm] = useState('');

  // 목적지 옵션 (국가 + 지역) - 온보딩과 동일
  // 미국/캐나다는 국가와 지역 모두 표시
  const destinationOptions = useMemo<Option[]>(() => {
    const out: Option[] = [];
    (countries as any[]).forEach(cont => {
      (cont?.countries || []).forEach((c: any) => {
        const countryName = c?.name;
        if (!countryName) return;

        // "대한민국 (South Korea)" 형식에서 한국어 이름만 추출
        const koreanName = countryName.split(' (')[0].trim();

        // 모든 국가는 국가와 지역 모두 추가 (한국어만 사용)
        out.push({ value: koreanName, label: koreanName });
        if (Array.isArray(c?.regions)) {
          c.regions.forEach((r: string) => {
            // 지역도 "홋카이도 (Hokkaido)" 형식에서 한국어만 추출
            const koreanRegion = r.split(' (')[0].trim();
            const v = `${koreanName} - ${koreanRegion}`;
            out.push({ value: v, label: v });
          });
        }
      });
    });
    const map = new Map<string, Option>();
    out.forEach(o => map.set(o.value, o));
    return Array.from(map.values());
  }, []);

  // 공통 필터 (한/영, 공백, 대소문자 무시)
  const filterOption = (opt: any, raw: string) =>
    normalize(opt?.label ?? '')?.includes(normalize(raw));

  // 연관검색 칩: 입력값 기준 상위 5개 추천
  const countryChips = useMemo(() => {
    if (!countrySearchTerm) return [];
    const n = normalize(countrySearchTerm);
    return destinationOptions
      .filter(o => normalize(o.label).includes(n))
      .slice(0, 5);
  }, [countrySearchTerm, destinationOptions]);

  const handleDestChange = (vals: any) => {
    const arr = (vals as Option[]) ?? [];
    const limited = arr.slice(0, visitCount);
    onChange(limited);
  };

  // 방문 국가 개수 변경 시 선택된 국가 수 조정
  const handleVisitCountChange = (count: number) => {
    setVisitCount(count);
    if (selectedCountries.length > count) {
      onChange(selectedCountries.slice(0, count));
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-600">*</span>
      </label>

      {/* 방문 국가 개수 선택 */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">방문 국가 개수 (1-10개)</label>
        <select
          value={visitCount}
          onChange={(e) => handleVisitCountChange(parseInt(e.target.value, 10))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <option key={n} value={n}>{n}개국</option>
          ))}
        </select>
      </div>

      {/* 목적지 선택 */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">
          목적지 선택 <span className="text-blue-600 font-bold">({selectedCountries.length}/{visitCount}개 선택)</span>
          {selectedCountries.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="ml-2 text-red-500 text-xs font-medium hover:underline"
            >
              초기화
            </button>
          )}
        </label>
        <CountrySelect
          instanceId="admin-dest-select"
          isMulti={true}
          options={destinationOptions}
          value={selectedCountries}
          onChange={handleDestChange}
          onInputChange={(v: string) => setCountrySearchTerm(v)}
          filterOption={filterOption}
          placeholder="목적지를 선택하세요 (여러 개 선택 가능)"
        />
        <div className="mt-1 text-xs text-gray-500">
          {visitCount}개 중 <span className="font-semibold text-blue-600">{selectedCountries.length}</span> 선택됨
        </div>
      </div>

      {/* 연관검색 칩 */}
      {countryChips.length > 0 && (
        <div className="flex gap-2 flex-wrap text-sm">
          {countryChips.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                if (selectedCountries.some(p => p.value === c.value)) return;
                if (selectedCountries.length >= visitCount) return;
                onChange([...selectedCountries, c]);
              }}
              className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* 선택된 국가 표시 */}
      {selectedCountries.length > 0 && (
        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs font-semibold text-blue-900 mb-2">선택된 국가:</p>
          <div className="flex flex-wrap gap-2">
            {selectedCountries.map((country, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-medium"
              >
                {country.label}
                <button
                  type="button"
                  onClick={() => onChange(selectedCountries.filter((_, i) => i !== idx))}
                  className="hover:text-red-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="text-xs text-blue-700 mt-2 font-semibold">
            → 크루즈몰에 &quot;{selectedCountries.length}개국 여행&quot;으로 표시됩니다
          </p>
        </div>
      )}
    </div>
  );
}




