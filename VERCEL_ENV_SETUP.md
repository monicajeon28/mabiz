# Vercel 환경변수 설정 가이드

## 설정 위치
```
https://vercel.com/projects/mabiz/settings/environment-variables
```

## 추가할 환경변수

### Staging 환경
```
이름: CRUISEDOT_WEBHOOK_SECRET
값: sk_staging_651ffc29ea402ae3fa003f25bef3cf809660ba6f8dc9c4def22da937c011f3d9
선택: Preview (Staging)
```

### Production 환경
```
이름: CRUISEDOT_WEBHOOK_SECRET
값: sk_prod_2a3aee11fa698d47d29144422c6ca45ce5b700d1d0e65eba95d793818ae6075f
선택: Production
```

## 설정 단계

1. Vercel Dashboard 열기
2. mabiz 프로젝트 → Settings
3. Environment Variables 클릭
4. "Add New" 클릭
5. 위의 Staging 정보 입력 → Save
6. 위의 Production 정보 입력 → Save
7. **자동으로 배포 반영됨** ✅

## 확인

- [ ] Staging 환경변수 설정 완료
- [ ] Production 환경변수 설정 완료
- [ ] Vercel 배포 자동 완료 확인

## 다음 단계

1. **2026-05-24 (금)**: 크루즈닷몰 스테이징 배포 후 통지
2. **2026-05-24 오후**: 우리 스테이징 배포 + 기초 테스트
3. **2026-05-25 (토)**: 통합 테스트 시작
