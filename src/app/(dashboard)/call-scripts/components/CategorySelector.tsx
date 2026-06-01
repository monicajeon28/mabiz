"use client";

import { cn } from "@/lib/utils";

interface CategorySelectorProps {
  selected: string;
  onSelect: (category: string) => void;
}

const CATEGORIES = [
  {
    id: "healthcare",
    name: "헬스케어",
    description: "건강관리 상품",
    color: "bg-blue-100 border-blue-300",
    icon: "🏥",
  },
  {
    id: "rental",
    name: "렌탈",
    description: "렌탈 서비스",
    color: "bg-green-100 border-green-300",
    icon: "🏠",
  },
  {
    id: "product_new_db",
    name: "상품 (신규 DB)",
    description: "신규/콜드 고객",
    color: "bg-orange-100 border-orange-300",
    icon: "📦",
  },
  {
    id: "product_inactive_db",
    name: "상품 (부재중 DB)",
    description: "기존/쉬던 고객",
    color: "bg-purple-100 border-purple-300",
    icon: "🔄",
  },
];

export function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">카테고리 선택</h3>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "p-3 rounded-lg border-2 text-left transition-all",
              selected === cat.id
                ? `${cat.color} border-solid`
                : "bg-gray-50 border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="text-lg">{cat.icon}</div>
            <div className="font-medium text-sm mt-1">{cat.name}</div>
            <div className="text-sm text-gray-600">{cat.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
