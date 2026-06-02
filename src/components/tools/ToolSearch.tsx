"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: string;
}

interface ToolSearchProps {
  onSelectTool: (toolId: string, category: string) => void;
  allTools: SearchResult[];
}

export function ToolSearch({ onSelectTool, allTools }: ToolSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const results = query.trim()
    ? allTools.filter((tool) =>
        tool.title.toLowerCase().includes(query.toLowerCase()) ||
        tool.description.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleSelect = (toolId: string, category: string) => {
    onSelectTool(toolId, category);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="도구 검색... (상품명, 기능, 상황)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-navy-900"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 드롭다운 결과 */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {results.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleSelect(tool.id, tool.category)}
              className="w-full text-left px-4 py-2.5 hover:bg-navy-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg mt-0.5">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {tool.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                    {tool.description}
                  </p>
                </div>
                <span className="text-xs bg-navy-100 text-navy-900 px-2 py-0.5 rounded whitespace-nowrap ml-2">
                  {tool.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* "결과 없음" 상태 */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-600 z-50">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
