'use client'
import { useState } from 'react'
import type { PsychologyLens } from '@/types/funnel-wizard'
import { LENS_DETAILS } from '@/types/funnel-wizard'

interface FunnelWizardModalProps {
  contactId: string
  contactName: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function FunnelWizardModal({
  contactId,
  contactName,
  isOpen,
  onClose,
  onSuccess,
}: FunnelWizardModalProps) {
  const [step, setStep] = useState(1)
  const [lens, setLens] = useState<PsychologyLens | undefined>()
  const [strategy, setStrategy] = useState<string>()
  const [messages, setMessages] = useState<Record<string, string>>({'0': '', '1': '', '2': '', '3': ''})
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [hour, setHour] = useState('12')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!lens) return
    setLoading(true)
    try {
      const res = await fetch('/api/funnels/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          psychologyLens: lens,
          selectedStrategy: strategy,
          customMessages: messages,
          schedule: { startDate, duration: 3, hour: parseInt(hour) },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || '실패')
        return
      }
      onSuccess?.()
      onClose()
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">🚀 자동메시지 마법사</h2>
              <p className="text-sm text-gray-600 mt-1">Step {step} / 5 - {contactName}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
          </div>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className={`flex-1 h-2 rounded-full ${s <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="p-6">
          {error && <div className="bg-red-50 p-4 rounded-lg text-red-900 mb-4">{error}</div>}

          <div className="min-h-64">
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-base font-semibold mb-6">🎯 어떤 고객이신가요?</p>
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(LENS_DETAILS) as PsychologyLens[]).map((l) => (
                    <button key={l} onClick={() => { setLens(l); setStep(2) }} 
                      className={`p-4 rounded-lg border-2 text-left min-h-24 ${lens === l ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <div className="font-semibold text-base">{LENS_DETAILS[l].name}</div>
                      <div className="text-sm text-gray-600 mt-2">{LENS_DETAILS[l].description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === 2 && lens && (
              <div className="space-y-4">
                <p className="text-base font-semibold mb-6">💡 전략을 선택하세요</p>
                <div className="space-y-2">
                  {LENS_DETAILS[lens].strategies.map((s, idx) => (
                    <button key={idx} onClick={() => { setStrategy(s); setStep(3) }} 
                      className={`w-full p-4 rounded-lg border-2 text-left ${strategy === s ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <div className="font-semibold text-base">{s}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                <p className="text-base font-semibold mb-4">📝 Day 0-3 메시지</p>
                {[0, 1, 2, 3].map((day) => (
                  <div key={day}>
                    <label className="block text-sm font-semibold mb-1">Day {day}</label>
                    <textarea 
                      value={messages[String(day)]} 
                      onChange={(e) => setMessages({...messages, [String(day)]: e.target.value})} 
                      className="w-full p-2 border rounded-lg text-sm h-16" />
                  </div>
                ))}
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <p className="text-base font-semibold mb-4">⏰ 발송 일정</p>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} 
                  className="w-full p-2 border rounded-lg text-sm" />
                <div className="flex gap-2">
                  {['8', '12', '18'].map((h) => (
                    <button key={h} onClick={() => setHour(h)} 
                      className={`flex-1 p-2 rounded-lg border-2 font-semibold text-sm ${hour === h ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                      {h === '8' ? '오전 8시' : h === '12' ? '정오' : '오후 6시'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-4">
                <p className="text-base font-semibold mb-4">✅ 최종 확인</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <div><span className="font-semibold">고객:</span> {contactName}</div>
                  <div><span className="font-semibold">렌즈:</span> {lens ? LENS_DETAILS[lens].name : '-'}</div>
                  <div><span className="font-semibold">전략:</span> {strategy || '-'}</div>
                  <div><span className="font-semibold">날짜:</span> {startDate} {hour}시</div>
                </div>
                <button onClick={handleCreate} disabled={loading} 
                  className="w-full p-2 bg-green-500 text-white font-semibold rounded-lg text-sm">
                  {loading ? '생성 중...' : '생성!'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2 border-2 rounded-lg text-sm">
              이전
            </button>
          )}
          {step < 5 && (
            <button onClick={() => setStep(step + 1)} 
              disabled={!lens || !strategy || !startDate} 
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50">
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
