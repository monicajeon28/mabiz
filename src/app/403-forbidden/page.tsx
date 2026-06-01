import Link from 'next/link';

/**
 * 403 Forbidden Page
 *
 * 다음의 경우에 표시됨:
 * 1. MEMBER가 /admin/* 접근 시도
 * 2. FREE_SALES가 /team/* 접근 시도
 * 3. 미인증 사용자가 보호된 경로 접근 시도
 *
 * 미들웨어에서 이 페이지로 리다이렉트함
 */
export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full text-center">
        {/* Error Code */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-navy-900 mb-4">403</h1>
          <p className="text-2xl font-semibold text-gray-700">접근 권한이 없습니다</p>
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          요청하신 페이지에 접근할 권한이 없습니다.
          <br />
          관리자에게 문의하시거나 권한이 있는 페이지로 이동하세요.
        </p>

        {/* Icons/Visual Indicator */}
        <div className="mb-8 text-5xl">🔒</div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            대시보드로 이동
          </Link>

          <Link
            href="/sign-in"
            className="block px-4 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            다시 로그인
          </Link>
        </div>

        {/* Contact Support */}
        <div className="mt-8 pt-8 border-t border-gray-300">
          <p className="text-sm text-gray-600">
            문제가 지속되면&nbsp;
            <a
              href="https://support.cruisedot.com"
              className="text-blue-600 hover:underline font-medium"
            >
              고객 지원팀
            </a>
            에 문의하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
