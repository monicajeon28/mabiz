'use client';

import { useEffect, useRef, useState } from 'react';

type NetworkMode = 'WIFI' | 'CELLULAR' | 'OFFLINE';

interface VoicePlaybackConfig {
  streaming: boolean;
  cache: boolean;
  fallback: 'text' | 'text_only';
}

interface VoicePlaybackProps {
  audioUrl: string;
  text: string;
  onError?: (error: Error) => void;
  onPlay?: () => void;
  onPause?: () => void;
  autoPlay?: boolean;
}

/**
 * 네트워크 모드 감지 함수
 * Navigator.connection API를 활용하여 현재 네트워크 상태 반환
 * @returns "WIFI" | "CELLULAR" | "OFFLINE"
 */
function detectNetworkMode(): NetworkMode {
  // 브라우저 호환성 확인
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return 'OFFLINE';
  }

  // Network Information API 사용 가능 여부 확인
  const connection =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  if (!connection) {
    // API 미지원 시 온라인 상태로 WIFI로 판단
    return 'WIFI';
  }

  // saveData 플래그 확인 (사용자가 데이터 절약 모드 활성화)
  if (connection.saveData) {
    return 'CELLULAR';
  }

  // 연결 타입에 따라 모드 결정
  const effectiveType = connection.effectiveType;
  const type = connection.type;

  // effectiveType: "slow-2g", "2g", "3g", "4g"
  if (effectiveType === '4g') {
    return 'WIFI';
  }

  if (effectiveType === '3g' || effectiveType === '2g' || effectiveType === 'slow-2g') {
    return 'CELLULAR';
  }

  // type: "bluetooth", "cellular", "ethernet", "none", "wifi", "wimax", "other", "unknown"
  if (type === 'wifi' || type === 'ethernet' || type === 'wimax') {
    return 'WIFI';
  }

  if (type === 'cellular') {
    return 'CELLULAR';
  }

  if (type === 'none') {
    return 'OFFLINE';
  }

  // 기본값: WIFI로 판단 (온라인 상태일 때)
  return 'WIFI';
}

/**
 * 네트워크 모드에 따른 재생 설정 반환
 */
function getConfigByNetworkMode(mode: NetworkMode): VoicePlaybackConfig {
  switch (mode) {
    case 'WIFI':
      return {
        streaming: true,
        cache: false,
        fallback: 'text',
      };
    case 'CELLULAR':
      return {
        streaming: false,
        cache: true,
        fallback: 'text',
      };
    case 'OFFLINE':
      return {
        streaming: false,
        cache: false,
        fallback: 'text_only',
      };
  }
}

/**
 * VoicePlayback 컴포넌트
 * 네트워크 상태에 따라 오디오 스트리밍, 캐싱, 텍스트 폴백 제공
 */
export default function VoicePlayback({
  audioUrl,
  text,
  onError,
  onPlay,
  onPause,
  autoPlay = false,
}: VoicePlaybackProps) {
  const [networkMode, setNetworkMode] = useState<NetworkMode>('WIFI');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const connectionListenerRef = useRef<(() => void) | null>(null);

  // 네트워크 모드 초기 감지
  useEffect(() => {
    const initialMode = detectNetworkMode();
    setNetworkMode(initialMode);
    setAudioEnabled(initialMode !== 'OFFLINE');
  }, []);

  // 네트워크 변경 이벤트 감시
  useEffect(() => {
    const handleNetworkChange = () => {
      const newMode = detectNetworkMode();
      setNetworkMode(newMode);
      setAudioEnabled(newMode !== 'OFFLINE');

      // 네트워크가 OFFLINE이 되었을 때 재생 중지
      if (newMode === 'OFFLINE' && audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    // navigator.connection API 구독
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleNetworkChange);
      connectionListenerRef.current = () => {
        connection.removeEventListener('change', handleNetworkChange);
      };
    }

    // 온라인/오프라인 이벤트 감시
    const handleOnline = () => {
      const newMode = detectNetworkMode();
      setNetworkMode(newMode);
      setAudioEnabled(newMode !== 'OFFLINE');
    };

    const handleOffline = () => {
      setNetworkMode('OFFLINE');
      setAudioEnabled(false);
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup function: 메모리 누수 방지
    return () => {
      if (connectionListenerRef.current) {
        connectionListenerRef.current();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isPlaying]);

  // 오디오 재생 핸들러
  const handlePlay = async () => {
    if (!audioEnabled || !audioRef.current) {
      return;
    }

    try {
      setError(null);
      await audioRef.current.play();
      setIsPlaying(true);
      onPlay?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('재생 실패');
      setError(error.message);
      setAudioEnabled(false);
      onError?.(error);
    }
  };

  // 오디오 일시정지 핸들러
  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
    }
  };

  const config = getConfigByNetworkMode(networkMode);
  const showAudioControl =
    audioEnabled && (config.fallback !== 'text_only' || config.cache);

  return (
    <div className="voice-playback-container">
      {/* 네트워크 모드 표시 */}
      <div className="network-mode-badge">
        <span className={`badge badge-${networkMode.toLowerCase()}`}>
          {networkMode === 'WIFI' && '📶 Wi-Fi'}
          {networkMode === 'CELLULAR' && '📱 셀룰러'}
          {networkMode === 'OFFLINE' && '🚫 오프라인'}
        </span>
      </div>

      {/* 오디오 재생 컨트롤 */}
      {showAudioControl && (
        <div className="audio-control-section">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload={config.cache ? 'auto' : 'none'}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              const error = new Error(
                `오디오 로드 실패: ${e.currentTarget.error?.message || '알 수 없는 오류'}`
              );
              setError(error.message);
              setAudioEnabled(false);
              onError?.(error);
            }}
          />

          <div className="audio-buttons">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                disabled={!audioEnabled}
                className="btn btn-play"
                title={audioEnabled ? '재생' : '오디오를 사용할 수 없습니다'}
              >
                ▶️ 재생
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="btn btn-pause"
                title="일시정지"
              >
                ⏸️ 일시정지
              </button>
            )}
          </div>

          {/* 스트리밍 모드 표시 */}
          {config.streaming && (
            <span className="streaming-badge">🔴 스트리밍</span>
          )}
          {config.cache && <span className="cache-badge">💾 캐시됨</span>}

          {/* 에러 메시지 */}
          {error && <div className="error-message">⚠️ {error}</div>}
        </div>
      )}

      {/* 텍스트 폴백 */}
      {!audioEnabled || config.fallback === 'text_only' ? (
        <div className="text-fallback-section">
          {!audioEnabled && (
            <div className="offline-message">
              🔇 음성 사용 불가 ({networkMode === 'OFFLINE' ? '오프라인 상태' : '네트워크 제한'})
            </div>
          )}
          <div className="text-content">
            <p>{text}</p>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .voice-playback-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          background-color: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }

        .network-mode-badge {
          display: flex;
          gap: 6px;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-wifi {
          background-color: #e3f2fd;
          color: #1976d2;
        }

        .badge-cellular {
          background-color: #fff3e0;
          color: #f57c00;
        }

        .badge-offline {
          background-color: #ffebee;
          color: #d32f2f;
        }

        .audio-control-section {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .audio-buttons {
          display: flex;
          gap: 6px;
        }

        .btn {
          padding: 6px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background-color: #fff;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .btn:hover:not(:disabled) {
          background-color: #f5f5f5;
          border-color: #999;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-play {
          background-color: #4caf50;
          color: white;
          border-color: #45a049;
        }

        .btn-play:hover:not(:disabled) {
          background-color: #45a049;
        }

        .btn-pause {
          background-color: #ff9800;
          color: white;
          border-color: #e68900;
        }

        .btn-pause:hover:not(:disabled) {
          background-color: #e68900;
        }

        .streaming-badge {
          display: inline-block;
          padding: 2px 6px;
          background-color: #ffcdd2;
          color: #c62828;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 500;
        }

        .cache-badge {
          display: inline-block;
          padding: 2px 6px;
          background-color: #c8e6c9;
          color: #2e7d32;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 500;
        }

        .error-message {
          padding: 8px;
          background-color: #ffebee;
          color: #c62828;
          border-radius: 4px;
          font-size: 13px;
        }

        .text-fallback-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .offline-message {
          padding: 8px;
          background-color: #ffebee;
          color: #d32f2f;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
        }

        .text-content {
          padding: 8px;
          background-color: #fff;
          border-radius: 4px;
          border-left: 3px solid #2196f3;
          line-height: 1.6;
          color: #333;
        }

        .text-content p {
          margin: 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
