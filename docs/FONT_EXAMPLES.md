# 폰트 설정 실제 예제 (Copy & Paste)

## 📋 목차

1. [페이지 레이아웃](#페이지-레이아웃)
2. [대시보드](#대시보드)
3. [폼](#폼)
4. [카드 컴포넌트](#카드-컴포넌트)
5. [테이블](#테이블)
6. [모달](#모달)
7. [메시지](#메시지)
8. [히어로 섹션](#히어로-섹션)

---

## 페이지 레이아웃

### 기본 페이지 구조

```tsx
// app/(dashboard)/contacts/page.tsx
import { Heading, Body, Button } from "@/components/ui";
import { Heading as TypoHeading, Body as TypoBody } from "@/components/Typography";

export default function ContactsPage() {
  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div className="space-y-2">
        <TypoHeading level="h1">고객 관리</TypoHeading>
        <TypoBody size="sm" muted>
          전체 고객 및 상담 내역을 관리합니다.
        </TypoBody>
      </div>

      {/* 콘텐츠 */}
      <section className="space-y-4">
        {/* 본문 */}
      </section>
    </div>
  );
}
```

### 섹션 제목 + 설명

```tsx
<div className="space-y-4 border-b pb-6">
  <div>
    <TypoHeading level="h2">판매 현황</TypoHeading>
  </div>
  <TypoBody size="sm" muted>
    이번 달 판매 데이터입니다. 매일 자동으로 업데이트됩니다.
  </TypoBody>
</div>
```

---

## 대시보드

### KPI 카드 모음

```tsx
import { Stat } from "@/components/Typography";

export function DashboardKPI() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 총 매출 */}
      <div className="p-6 bg-card rounded-lg border">
        <Stat
          label="총 매출"
          value={2450000}
          format="currency"
          unit="원"
          change={15.3}
        />
      </div>

      {/* 활성 고객 */}
      <div className="p-6 bg-card rounded-lg border">
        <Stat
          label="활성 고객"
          value={324}
          unit="명"
          change={8.2}
        />
      </div>

      {/* 전환율 */}
      <div className="p-6 bg-card rounded-lg border">
        <Stat
          label="전환율"
          value={0.325}
          format="percent"
          unit="상태"
          change={-2.1}
        />
      </div>
    </div>
  );
}
```

### 매출 차트 + 설명

```tsx
import { Heading, Body, Number } from "@/components/Typography";
import { Chart } from "@/components/ui/Chart";

export function SalesChart() {
  return (
    <div className="p-6 bg-card rounded-lg border space-y-4">
      {/* 제목 */}
      <div>
        <Heading level="h3">월별 매출</Heading>
      </div>

      {/* 현재값 */}
      <div className="flex items-baseline gap-2">
        <Number value={1234567} format="currency" locale="ko-KR" />
        <Body size="sm" muted>
          지난달 대비 <Number value={0.15} format="percent" />
        </Body>
      </div>

      {/* 차트 */}
      <Chart data={/* ... */} />

      {/* 범례 */}
      <Body size="xs" muted>
        * 데이터는 매일 자동 업데이트됩니다.
      </Body>
    </div>
  );
}
```

---

## 폼

### 기본 폼

```tsx
import { Label, Body, Button } from "@/components/Typography";
import { Input } from "@/components/ui/input";

export function ContactForm() {
  return (
    <form className="space-y-6">
      {/* 이름 입력 */}
      <div className="space-y-2">
        <Label htmlFor="name" required>
          이름
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="고객 이름을 입력하세요"
        />
        <Body size="xs" muted>
          고객의 실명을 입력해주세요.
        </Body>
      </div>

      {/* 이메일 입력 */}
      <div className="space-y-2">
        <Label htmlFor="email" required>
          이메일
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="email@example.com"
        />
      </div>

      {/* 선택사항 필드 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="phone">전화번호</Label>
          <Body size="xs" muted>선택사항</Body>
        </div>
        <Input
          id="phone"
          type="tel"
          placeholder="010-1234-5678"
        />
      </div>

      {/* 제출 버튼 */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          저장
        </Button>
        <Button type="button" variant="outline" className="flex-1">
          취소
        </Button>
      </div>
    </form>
  );
}
```

### 필드 그룹

```tsx
// 섹션별 폼 그룹

<div className="space-y-6">
  {/* 기본 정보 섹션 */}
  <div className="space-y-4">
    <Heading level="h3">기본 정보</Heading>
    {/* 필드들 */}
  </div>

  {/* 연락처 섹션 */}
  <div className="space-y-4 border-t pt-6">
    <Heading level="h3">연락처</Heading>
    {/* 필드들 */}
  </div>

  {/* 옵션 섹션 */}
  <div className="space-y-4 border-t pt-6">
    <Heading level="h3">추가 옵션</Heading>
    {/* 필드들 */}
  </div>
</div>
```

---

## 카드 컴포넌트

### 고객 카드

```tsx
import { Heading, Body, Caption, Highlight } from "@/components/Typography";

export function CustomerCard({ customer }) {
  return (
    <div className="p-6 bg-card rounded-lg border hover:border-primary transition">
      {/* 헤더 */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <Heading level="h4">{customer.name}</Heading>
          <Caption>{customer.email}</Caption>
        </div>
        {customer.isVip && (
          <Highlight color="gold" bold>VIP</Highlight>
        )}
      </div>

      {/* 바디 */}
      <div className="mt-4 space-y-2">
        <Body size="sm">
          전화: {customer.phone}
        </Body>
        <Body size="sm">
          가입일: {new Date(customer.createdAt).toLocaleDateString("ko-KR")}
        </Body>
      </div>

      {/* 푸터 */}
      <div className="mt-6 pt-4 border-t flex gap-2">
        <Button size="sm" variant="outline" className="flex-1">
          수정
        </Button>
        <Button size="sm" className="flex-1">
          상세
        </Button>
      </div>
    </div>
  );
}
```

### 통계 카드

```tsx
import { Stat, Body, Caption } from "@/components/Typography";

export function MetricCard({ metric }) {
  return (
    <div className="p-6 bg-card rounded-lg border">
      <Stat
        label={metric.label}
        value={metric.value}
        unit={metric.unit}
        format={metric.format}
        change={metric.change}
      />
      <Body size="xs" muted className="mt-4">
        {metric.description}
      </Body>
    </div>
  );
}
```

---

## 테이블

### 기본 테이블 헤더

```tsx
import { Heading, Number, Caption } from "@/components/Typography";

export function SalesTable() {
  return (
    <table className="w-full">
      {/* 헤더 */}
      <thead className="border-b-2">
        <tr>
          <th className="text-left py-3 px-4">
            <Caption uppercase className="font-bold">고객명</Caption>
          </th>
          <th className="text-left py-3 px-4">
            <Caption uppercase className="font-bold">상품</Caption>
          </th>
          <th className="text-right py-3 px-4">
            <Caption uppercase className="font-bold">금액</Caption>
          </th>
          <th className="text-left py-3 px-4">
            <Caption uppercase className="font-bold">날짜</Caption>
          </th>
        </tr>
      </thead>

      {/* 바디 */}
      <tbody className="divide-y">
        {data.map((row) => (
          <tr key={row.id} className="hover:bg-muted">
            <td className="py-4 px-4">
              <Body size="sm">{row.customerName}</Body>
            </td>
            <td className="py-4 px-4">
              <Body size="sm">{row.product}</Body>
            </td>
            <td className="py-4 px-4 text-right">
              <Number
                value={row.amount}
                format="currency"
                locale="ko-KR"
              />
            </td>
            <td className="py-4 px-4">
              <Caption>{row.date}</Caption>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 모달

### 확인 모달

```tsx
import { Heading, Body, Button } from "@/components/Typography";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";

export function ConfirmModal({ isOpen, onConfirm, onCancel }) {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent>
        {/* 헤더 */}
        <DialogHeader>
          <Heading level="h2">정말 삭제하시겠어요?</Heading>
        </DialogHeader>

        {/* 본문 */}
        <Body size="sm" muted>
          이 작업은 취소할 수 없습니다. 계속하시겠어요?
        </Body>

        {/* 푸터 (버튼) */}
        <DialogFooter className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 정보 모달

```tsx
<Dialog>
  <DialogContent className="space-y-6">
    {/* 타이틀 */}
    <div className="space-y-1">
      <Heading level="h2">고객 상세 정보</Heading>
      <Caption>전체 고객 정보를 확인하세요</Caption>
    </div>

    {/* 정보 섹션 */}
    <div className="space-y-4 border-t pt-4">
      <div>
        <Caption uppercase className="text-muted-foreground">이름</Caption>
        <Body>{customer.name}</Body>
      </div>
      <div>
        <Caption uppercase className="text-muted-foreground">이메일</Caption>
        <Body>{customer.email}</Body>
      </div>
      <div>
        <Caption uppercase className="text-muted-foreground">전화</Caption>
        <Body>{customer.phone}</Body>
      </div>
    </div>

    {/* 닫기 버튼 */}
    <Button className="w-full">닫기</Button>
  </DialogContent>
</Dialog>
```

---

## 메시지

### 성공 알림

```tsx
import { Highlight } from "@/components/Typography";

export function SuccessMessage() {
  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <Body size="sm">
        <Highlight color="green" bold>성공!</Highlight>
        {" "}고객 정보가 저장되었습니다.
      </Body>
    </div>
  );
}
```

### 오류 알림

```tsx
import { Highlight, Body } from "@/components/Typography";

export function ErrorMessage({ error }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <Body size="sm">
        <Highlight color="red" bold>오류!</Highlight>
        {" "}{error}
      </Body>
    </div>
  );
}
```

### 경고 메시지

```tsx
import { Highlight, Body, Caption } from "@/components/Typography";

export function WarningMessage() {
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
      <Body size="sm">
        <Highlight color="yellow" bold>주의!</Highlight>
        {" "}이 작업은 되돌릴 수 없습니다.
      </Body>
      <Caption>계속하기 전에 한 번 더 확인해주세요.</Caption>
    </div>
  );
}
```

---

## 히어로 섹션

### 페이지 상단 히어로

```tsx
import { Hero, Button } from "@/components/Typography";

export function PageHero() {
  return (
    <section className="py-12 md:py-24 bg-gradient-to-br from-primary to-primary-800">
      <div className="max-w-4xl mx-auto px-6 space-y-6">
        <Hero
          subtitle="고객 관리 시스템"
          title="크루즈닷 파트너 CRM"
          description="모든 고객을 한 곳에서 관리하고 매출을 극대화하세요"
          align="center"
        />
        <div className="flex justify-center gap-4 pt-4">
          <Button variant="default">시작하기</Button>
          <Button variant="outline">자세히 보기</Button>
        </div>
      </div>
    </section>
  );
}
```

### 제품 소개 히어로

```tsx
<div className="space-y-12">
  {/* 히어로 */}
  <Hero
    title="고객관리, 더 이상 복잡하지 않습니다"
    description="직관적인 대시보드로 모든 고객 정보를 한눈에 파악하세요"
    align="center"
  />

  {/* 특징 섹션 */}
  <div className="grid grid-cols-3 gap-6">
    {features.map((feature) => (
      <div key={feature.id} className="text-center">
        <Heading level="h3">{feature.title}</Heading>
        <Body size="sm" muted className="mt-2">
          {feature.description}
        </Body>
      </div>
    ))}
  </div>
</div>
```

---

## 완전한 페이지 예제

```tsx
// app/(dashboard)/contacts/page.tsx
import { Heading, Body, Caption, Button } from "@/components/Typography";
import { Input } from "@/components/ui/input";

export default function ContactsPage() {
  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Heading level="h1">고객 관리</Heading>
          <Body size="sm" muted>
            전체 <Number value={524} />명의 고객을 관리하고 있습니다.
          </Body>
        </div>
        <Button>+ 고객 추가</Button>
      </div>

      {/* 검색 바 */}
      <div className="space-y-2">
        <Label htmlFor="search">검색</Label>
        <Input
          id="search"
          type="text"
          placeholder="고객명, 이메일 등으로 검색"
        />
      </div>

      {/* 고객 카드 모음 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => (
          <CustomerCard key={customer.id} customer={customer} />
        ))}
      </div>
    </div>
  );
}
```

---

**팁:** 위 예제를 복사해서 `src/components/` 또는 `src/app/` 폴더에 붙여넣으면 즉시 사용 가능합니다!
