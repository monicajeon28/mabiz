# Vercel Environment Variables Setup Checklist

**상태**: READY FOR USER INPUT ⏳

---

## 필수 설정 5개

### 1️⃣ DATABASE_URL
- **Status**: ✓ .env.local에 이미 설정됨
- **Vercel Dashboard 확인**: 이미 존재하는지 확인

### 2️⃣ NEON_API_KEY
- **Status**: ⏳ 사용자 제공 필요
- **값**: Neon Dashboard → API Keys → 복사

### 3️⃣ SUPABASE_PASSWORD
- **Status**: ⏳ 사용자 제공 필요
- **값**: Supabase Dashboard → Settings → Database → 복사

### 4️⃣ CRUISEDOT_WEBHOOK_SECRET
- **Status**: ⏳ 사용자 제공 필요
- **값**: cruisedot 시스템의 Webhook Bearer Token

### 5️⃣ CRUISEDOT_INVENTORY_WEBHOOK_SECRET (신규 - P0 ISS-09)
- **Status**: ⏳ 새로 생성 필요
- **방법**: `openssl rand -hex 32` 또는 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **생성된 값**: [사용자가 여기에 입력]

---

## Vercel 설정 단계

**선택 1: Vercel Dashboard (Web UI)**
1. https://vercel.com → Dashboard
2. Project: mabiz-crm
3. Settings → Environment Variables
4. 각 변수 추가 (Production, Preview, Development 모두 체크)
5. Save

**선택 2: Vercel CLI**
```bash
# 프로젝트 연결
vercel link

# 환경 변수 추가
vercel env add DATABASE_URL
vercel env add NEON_API_KEY
vercel env add SUPABASE_PASSWORD
vercel env add CRUISEDOT_WEBHOOK_SECRET
vercel env add CRUISEDOT_INVENTORY_WEBHOOK_SECRET
```

---

## 이 단계 완료하려면 사용자가:

- [ ] NEON_API_KEY 값 준비
- [ ] SUPABASE_PASSWORD 값 준비
- [ ] CRUISEDOT_WEBHOOK_SECRET 값 준비
- [ ] CRUISEDOT_INVENTORY_WEBHOOK_SECRET 생성
- [ ] Vercel 환경 변수 5개 설정
- [ ] 설정 후 `vercel env list` 실행해서 확인

**기한**: STEP 2 완료 (배포 전 필수)

---

**작성**: 2026-05-27 | **상태**: USER INPUT AWAITING
