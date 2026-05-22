/**
 * PNR 유틸리티 함수들 (포매팅, 색상, 그룹화 등)
 */

import type { Traveler } from '@/src/lib/types/pnr';

/**
 * 방 색상 팔레트 (시각적으로 구분하기 쉬운 색상)
 */
export const ROOM_COLORS = [
  {
    name: '빨강',
    value: '#EF4444',
    bg: 'bg-red-100',
    border: 'border-red-400',
    text: 'text-red-700',
  },
  {
    name: '파랑',
    value: '#3B82F6',
    bg: 'bg-blue-100',
    border: 'border-blue-400',
    text: 'text-blue-700',
  },
  {
    name: '초록',
    value: '#22C55E',
    bg: 'bg-green-100',
    border: 'border-green-400',
    text: 'text-green-700',
  },
  {
    name: '노랑',
    value: '#EAB308',
    bg: 'bg-yellow-100',
    border: 'border-yellow-400',
    text: 'text-yellow-700',
  },
  {
    name: '보라',
    value: '#A855F7',
    bg: 'bg-purple-100',
    border: 'border-purple-400',
    text: 'text-purple-700',
  },
  {
    name: '분홍',
    value: '#EC4899',
    bg: 'bg-pink-100',
    border: 'border-pink-400',
    text: 'text-pink-700',
  },
  {
    name: '하늘',
    value: '#06B6D4',
    bg: 'bg-cyan-100',
    border: 'border-cyan-400',
    text: 'text-cyan-700',
  },
  {
    name: '주황',
    value: '#F97316',
    bg: 'bg-orange-100',
    border: 'border-orange-400',
    text: 'text-orange-700',
  },
];

/**
 * 방 번호에 해당하는 색상 값 반환
 * @param roomNumber 방 번호 (1부터 시작)
 * @returns HEX 색상값 (예: #EF4444)
 */
export function getRoomColorValue(roomNumber: number): string {
  const index = Math.max(0, (roomNumber - 1) % ROOM_COLORS.length);
  return ROOM_COLORS[index].value;
}

/**
 * 방 번호에 해당하는 색상 객체 전체 반환
 * @param roomNumber 방 번호 (1부터 시작)
 * @returns 색상 객체 { name, value, bg, border, text }
 */
export function getRoomColor(roomNumber: number) {
  const index = Math.max(0, (roomNumber - 1) % ROOM_COLORS.length);
  return ROOM_COLORS[index];
}

/**
 * 여행자 배열을 이름으로 포매팅
 * @param travelers 여행자 배열
 * @returns 쉼표로 구분된 이름 문자열 (예: "홍길동, 김철수")
 */
export function formatTravelerNames(travelers: Traveler[]): string {
  return travelers.map((t) => t.korName || '미입력').join(', ');
}

/**
 * 객실 타입과 번호로 라벨 생성
 * @param roomNumber 방 번호
 * @param cabinType 객실 타입 (기본값: '객실')
 * @returns 라벨 문자열 (예: "발코니1")
 */
export function getRoomLabel(
  roomNumber: number,
  cabinType: string | null = null
): string {
  const type = cabinType || '객실';
  return `${type}${roomNumber}`;
}

/**
 * 여행자 배열을 방 번호로 그룹화
 * @param travelers 여행자 배열
 * @returns 방 번호를 키로 하는 그룹 객체 { [roomNumber]: Traveler[] }
 */
export function groupTravelersByRoom(
  travelers: Traveler[]
): { [key: number]: Traveler[] } {
  const groups: { [key: number]: Traveler[] } = {};

  travelers.forEach((traveler, index) => {
    const roomNum = traveler.roomNumber;
    if (!groups[roomNum]) {
      groups[roomNum] = [];
    }
    groups[roomNum].push(traveler);
  });

  return groups;
}

/**
 * 다음 방 번호 계산 (동행자 추가 시 사용)
 * @param currentRoomNumbers 현재 방 번호 배열
 * @returns 다음 방 번호
 */
export function getNextRoomNumber(currentRoomNumbers: number[]): number {
  if (currentRoomNumbers.length === 0) return 1;

  const maxRoom = Math.max(...currentRoomNumbers);
  const nextRoom = maxRoom + 1;

  // 방 번호가 8을 초과하면 1로 리셋 (색상이 8가지뿐이므로)
  return nextRoom > 8 ? 1 : nextRoom;
}
