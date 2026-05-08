'use client'

import { useState, useCallback, useRef } from 'react'
import { logger } from '@/lib/logger'

interface UseImageFetchResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  fetch: (url: string) => Promise<void>
  abort: () => void
}

/**
 * 이미지 라이브러리 fetch 공통 훅
 *
 * AbortController를 이용한 경쟁 조건 방지 + loading/error 상태 관리
 * ImageLibrary, ImageLibraryModal 두 컴포넌트에서 공유
 *
 * @param logPrefix - logger 출력에 사용할 컴포넌트 이름 (예: '[ImageLibrary]')
 */
export function useImageFetch<T>(logPrefix: string): UseImageFetchResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Race condition 방지: 이전 요청 취소용
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (url: string) => {
    // 이전 요청 취소
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    // H-4: AbortError 발생 시 finally의 setLoading(false)가 새 요청을 덮어쓰는 race condition 방지
    let wasAborted = false

    try {
      const res = await fetch(url, {
        signal: abortRef.current.signal,
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error(`API 요청 실패: ${res.status}`)
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      // AbortError는 정상 (요청 취소됨) — wasAborted 플래그로 finally 제어
      if (err instanceof Error && err.name === 'AbortError') {
        wasAborted = true
        return
      }

      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      logger.error(`${logPrefix} fetch 실패:`, { error: errorMsg })
    } finally {
      if (!wasAborted) setLoading(false)
    }
  }, [logPrefix])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { data, loading, error, fetch: fetchData, abort }
}
