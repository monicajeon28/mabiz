'use client';

import React, { FormEvent, useState } from 'react';

interface LandingCommentFormProps {
  slug: string;
  onCommentAdded?: () => void;
}

export function LandingCommentForm({ slug, onCommentAdded }: LandingCommentFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!authorName.trim() || !content.trim() || !password.trim()) {
        setError('작성자 이름, 내용, 비밀번호를 모두 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/public/landing-pages/${slug}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorName: authorName.trim(),
          content: content.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || '댓글 작성에 실패했습니다.');
      }

      // 성공 시 폼 초기화
      setAuthorName('');
      setContent('');
      setPassword('');
      
      // 댓글 목록 새로고침
      if (onCommentAdded) {
        onCommentAdded();
      } else {
        // 페이지 새로고침
        window.location.reload();
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : '댓글 작성 중 오류가 발생했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="lp-comment-form" style={{ marginTop: '24px' }}>
      <div className="lp-form-field">
        <label htmlFor="lp-comment-author">
          작성자 이름 <span className="lp-required">*</span>
        </label>
        <input
          id="lp-comment-author"
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="이름을 입력하세요"
          required
          disabled={isSubmitting}
        />
      </div>
      <div className="lp-form-field">
        <label htmlFor="lp-comment-password">
          비밀번호 <span className="lp-required">*</span>
        </label>
        <input
          id="lp-comment-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="댓글 수정/삭제용 비밀번호"
          required
          disabled={isSubmitting}
        />
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          댓글 수정/삭제 시 사용할 비밀번호를 입력하세요.
        </p>
      </div>
      <div className="lp-form-field">
        <label htmlFor="lp-comment-content">
          댓글 내용 <span className="lp-required">*</span>
        </label>
        <textarea
          id="lp-comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="댓글을 입력하세요"
          required
          disabled={isSubmitting}
          rows={4}
          style={{
            width: '100%',
            borderRadius: '14px',
            border: '2px solid #e2e8f0',
            padding: '14px 16px',
            fontSize: '16px',
            fontFamily: 'inherit',
            resize: 'vertical',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#6366f1';
            e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>
      {error && (
        <div className="lp-error-message" style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px' }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        className="lp-primary-button"
        disabled={isSubmitting}
        style={{ marginTop: '12px' }}
      >
        {isSubmitting ? '작성 중...' : '댓글 작성'}
      </button>
    </form>
  );
}
