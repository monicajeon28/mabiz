// lib/cruise-data.ts
// 크루즈 라인과 선박명 데이터 유틸리티

import cruiseShipsData from '@/data/cruise_ships.json';

interface CruiseLine {
  cruise_line: string;
  description: string;
  ships: string[];
}

// 타입 안정성을 위한 타입 단언
const cruiseData = cruiseShipsData as CruiseLine[];

// 검색어 정규화 함수 (한글, 영문, 공백 제거)
function normalizeSearchTerm(term: string): string {
  return term.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9가-힣]/g, '');
}

// 모든 크루즈 라인 목록 가져오기
export function getAllCruiseLines(): string[] {
  return cruiseData.map(item => item.cruise_line);
}

// 특정 크루즈 라인의 선박 목록 가져오기
export function getShipsByCruiseLine(cruiseLine: string): string[] {
  const cruiseLineData = cruiseData.find(
    item => item.cruise_line === cruiseLine
  );
  return cruiseLineData?.ships || [];
}

// 모든 선박명 목록 가져오기 (중복 제거)
export function getAllShipNames(): string[] {
  const allShips: string[] = [];
  cruiseData.forEach(item => {
    allShips.push(...item.ships);
  });
  // 중복 제거
  return Array.from(new Set(allShips));
}

// 크루즈 라인으로 검색 (부분 일치, 한글/영어 모두 지원)
export function searchCruiseLines(query: string): string[] {
  const allLines = getAllCruiseLines();
  if (!query.trim()) return allLines;

  const normalizedQuery = normalizeSearchTerm(query);
  return allLines.filter(line => {
    const normalizedLine = normalizeSearchTerm(line);
    return normalizedLine.includes(normalizedQuery);
  });
}

// 선박명으로 검색 (부분 일치, 한글/영어 모두 지원)
export function searchShipNames(query: string): string[] {
  const allShips = getAllShipNames();
  if (!query.trim()) return allShips;

  const normalizedQuery = normalizeSearchTerm(query);
  return allShips.filter(ship => {
    const normalizedShip = normalizeSearchTerm(ship);
    return normalizedShip.includes(normalizedQuery);
  });
}

// 크루즈 라인 또는 선박명으로 통합 검색 (선박명 검색 시 해당 크루즈 라인도 포함)
export function searchCruiseLinesAndShips(query: string): { cruiseLines: string[]; ships: string[] } {
  const normalizedQuery = normalizeSearchTerm(query);

  const matchedCruiseLines: string[] = [];
  const matchedShips: string[] = [];

  cruiseData.forEach(item => {
    const normalizedLine = normalizeSearchTerm(item.cruise_line);
    if (normalizedLine.includes(normalizedQuery)) {
      matchedCruiseLines.push(item.cruise_line);
    }

    item.ships.forEach(ship => {
      const normalizedShip = normalizeSearchTerm(ship);
      if (normalizedShip.includes(normalizedQuery)) {
        matchedShips.push(ship);
        // 선박이 매칭되면 해당 크루즈 라인도 추가 (중복 제거)
        if (!matchedCruiseLines.includes(item.cruise_line)) {
          matchedCruiseLines.push(item.cruise_line);
        }
      }
    });
  });

  return {
    cruiseLines: Array.from(new Set(matchedCruiseLines)),
    ships: Array.from(new Set(matchedShips)),
  };
}
