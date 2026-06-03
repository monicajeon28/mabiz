import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = [
  // 검사 제외 폴더
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "dist/**",
      "cypress/**",
      "scripts/**",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  // TypeScript + React 파일 규칙
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // typescript-eslint 추천 규칙 기반
      ...tsPlugin.configs.recommended.rules,

      // [경고] any 타입 → 점진적 개선 대상
      "@typescript-eslint/no-explicit-any": "warn",

      // [경고] 안 쓰는 변수 → 점진적 개선 대상 (_로 시작하면 예외)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // [에러] React hooks 순서 위반 → 앱 크래시 직접 원인, 즉시 차단
      "react-hooks/rules-of-hooks": "error",

      // [경고] useEffect 의존성 누락 → 메모리 누수 위험, 점진적 개선
      "react-hooks/exhaustive-deps": "warn",

      // [경고] require() → 점진적 import 전환
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
];

export default eslintConfig;
