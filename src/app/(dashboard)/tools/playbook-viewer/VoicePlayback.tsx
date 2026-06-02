"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Wifi, WifiOff, Signal } from "lucide-react";
import { logger } from "@/lib/logger";

interface VoicePlaybackProps {
  text: string;
  scriptId: string;
  title?: string;
}

/**
 * 네트워크 적응 음성 재생 모드 (거장단 TS아키텍트 제안)
 * - WIFI/강함: 실시간 음성 합성 (기본 품질)
 * - CELLULAR/모바일 데이터: 음성 합성 + 데이터 절약 안내
 * - OFFLINE/saveData: 텍스트 폴백 (음성 비활성, 데이터 0 소비)
 */
type NetworkMode = "WIFI" | "CELLULAR" | "OFFLINE";

interface NavigatorConnection {
  effectiveType?: string; // "4g" | "3g" | "2g" | "slow-2g"
  saveData?: boolean;
  type?: string; // "wifi" | "cellular" | ...
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
}

function detectNetworkMode(): NetworkMode {
  if (typeof navigator === "undefined") return "WIFI";

  // 오프라인
  if ("onLine" in navigator && navigator.onLine === false) return "OFFLINE";

  const conn = (navigator as Navigator & {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  });
  const c = conn.connection || conn.mozConnection || conn.webkitConnection;

  if (!c) return "WIFI"; // 정보 없으면 WiFi로 가정(데스크톱)

  // 데이터 절약 모드 → 음성 비활성 (텍스트 폴백)
  if (c.saveData === true) return "OFFLINE";

  // 느린 네트워크 → 데이터 절약 모드로 취급
  if (c.effectiveType === "2g" || c.effectiveType === "slow-2g") {
    return "OFFLINE";
  }

  if (c.type === "wifi") return "WIFI";
  if (c.type === "cellular" || c.effectiveType === "3g") return "CELLULAR";

  return "WIFI";
}

const MODE_LABEL: Record<NetworkMode, string> = {
  WIFI: "WiFi · 실시간 재생",
  CELLULAR: "모바일 데이터 · 절약 재생",
  OFFLINE: "오프라인/절약 · 텍스트만",
};

export function VoicePlayback({ text, scriptId, title }: VoicePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [networkMode, setNetworkMode] = useState<NetworkMode>("WIFI");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 브라우저 지원 확인
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      ("speechSynthesis" in window || "webkitSpeechSynthesis" in window);
    setIsSpeechSupported(supported);
  }, []);

  // 네트워크 모드 감지 + 변경 구독
  useEffect(() => {
    const update = () => setNetworkMode(detectNetworkMode());
    update();

    const conn = (navigator as Navigator & {
      connection?: NavigatorConnection;
    }).connection;

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    conn?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      conn?.removeEventListener?.("change", update);
    };
  }, []);

  const handleStop = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    if (!isSpeechSupported) return;

    if (isPlaying) {
      handleStop();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = speed;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
      setIsPlaying(true);

      logger.log("[VoicePlayback] play", { scriptId, networkMode });
    } catch (error) {
      logger.error("voice-playback:synthesis", error);
      setIsPlaying(false);
    }
  }, [isSpeechSupported, isPlaying, handleStop, text, speed, scriptId, networkMode]);

  // 음성 미지원 또는 오프라인/절약 모드 → 텍스트 폴백 안내
  const isTextFallback = !isSpeechSupported || networkMode === "OFFLINE";

  const ModeIcon =
    networkMode === "WIFI" ? Wifi : networkMode === "CELLULAR" ? Signal : WifiOff;

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
      {!isTextFallback ? (
        <button
          onClick={handlePlay}
          aria-label={isPlaying ? "음성 재생 중단" : "음성 재생"}
          className="flex-shrink-0 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          title={isPlaying ? "중단" : "재생"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      ) : (
        <span
          className="flex-shrink-0 p-2 bg-gray-300 text-gray-600 rounded-lg"
          title="이 네트워크에서는 텍스트로만 제공됩니다"
          aria-label="텍스트 전용 모드"
        >
          <WifiOff className="w-4 h-4" />
        </span>
      )}

      {!isTextFallback && (
        <select
          value={speed}
          onChange={(e) => {
            setSpeed(Number(e.target.value));
            if (isPlaying) handleStop();
          }}
          aria-label="음성 재생 속도"
          className="flex-shrink-0 px-2 py-1 text-sm border border-blue-300 rounded bg-white font-medium text-gray-700 hover:border-blue-500 focus:outline-none focus:border-blue-500"
          title="음성 재생 속도 조절"
        >
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
        </select>
      )}

      <span className="text-xs text-blue-700 font-medium ml-1">
        {title || "음성 재생"}
      </span>

      {/* 네트워크 모드 배지 */}
      <span
        className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded"
        title={MODE_LABEL[networkMode]}
      >
        <ModeIcon className="w-3 h-3" />
        {MODE_LABEL[networkMode]}
      </span>

      {/* 텍스트 폴백 안내 */}
      {isTextFallback && (
        <p className="w-full text-xs text-gray-600 mt-1">
          {!isSpeechSupported
            ? "이 브라우저는 음성 합성을 지원하지 않습니다. 스크립트 텍스트를 확인하세요."
            : "데이터 절약/오프라인 모드 — 음성 대신 텍스트를 사용하세요."}
        </p>
      )}
    </div>
  );
}
