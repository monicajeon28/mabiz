'use client';

import VoicePlayback from './VoicePlayback';

export default function TestVoicePlaybackPage() {
  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>VoicePlayback 컴포넌트 테스트</h1>

      <section style={{ marginBottom: '32px' }}>
        <h2>테스트 시나리오 1: 기본 재생</h2>
        <p>네트워크 상태에 따라 자동으로 재생 모드가 전환됩니다.</p>
        <VoicePlayback
          audioUrl="https://example.com/sample-audio.mp3"
          text="이것은 샘플 텍스트입니다. 오디오를 재생해보세요."
          onPlay={() => console.log('재생 시작')}
          onPause={() => console.log('재생 일시정지')}
          onError={(err) => console.error('오디오 오류:', err.message)}
        />
      </section>

      <section>
        <h2>테스트 시나리오 2: 자동 재생</h2>
        <p>페이지 로드 후 자동으로 재생됩니다.</p>
        <VoicePlayback
          audioUrl="https://example.com/sample-audio-2.mp3"
          text="자동 재생 예제입니다."
          autoPlay={true}
        />
      </section>
    </div>
  );
}
