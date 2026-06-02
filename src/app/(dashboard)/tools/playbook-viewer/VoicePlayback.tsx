"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { logger } from "@/lib/logger";

interface VoicePlaybackProps {
  text: string;
  scriptId: string;
  title?: string;
}

export function VoicePlayback({ text, scriptId, title }: VoicePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 브라우저 지원 확인
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      ("speechSynthesis" in window || "webkitSpeechSynthesis" in window);
    setIsSpeechSupported(supported);
  }, []);

  const handlePlay = () => {
    if (!isSpeechSupported) return;

    // 기존 재생 중단
    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    try {
      // 새로운 음성 합성 객체 생성
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = speed;
      utterance.pitch = 1;
      utterance.volume = 1;

      // 재생 완료 이벤트
      utterance.onend = () => {
        setIsPlaying(false);
      };

      utterance.onerror = () => {
        setIsPlaying(false);
      };

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
      setIsPlaying(true);
    } catch (error) {
      logger.error("voice-playback:synthesis", error);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
  };

  if (!isSpeechSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <button
        onClick={isPlaying ? handleStop : handlePlay}
        aria-label={isPlaying ? "음성 재생 중단" : "음성 재생"}
        className="flex-shrink-0 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        title={isPlaying ? "중단" : "재생"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>

      <select
        value={speed}
        onChange={(e) => {
          setSpeed(Number(e.target.value));
          if (isPlaying) {
            speechSynthesis.cancel();
            setIsPlaying(false);
          }
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

      <span className="text-xs text-blue-700 font-medium ml-1">
        {title || "음성 재생"}
      </span>
    </div>
  );
}
