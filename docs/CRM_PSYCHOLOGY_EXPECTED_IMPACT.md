# CRM 심리학 10렌즈: 성과 메트릭 및 예상 효과 (2026-05-26)

## 📊 목표: 각 렌즈별 성과 추적 및 비즈니스 임팩트 정량화

---

## 🎯 렌즈별 성과 메트릭 (Current → Target)

### L0: 부재고객 재활성화
```json
{
  "lensId": "L0",
  "lensName": "Reactivation (부재고객 복구)",
  "primaryProblem": "3개월 이상 연락 없는 고객",
  "metrics": {
    "reactivation_rate": {
      "current": "15%",
      "target": "62-97%",
      "improvement": "+314% to +547%",
      "formula": "(응답한_부재고객 / 전체_부재고객) × 100"
    },
    "reactivation_cpa": {
      "current": "$120",
      "target": "$45-65",
      "improvement": "-46% to -63%",
      "formula": "마케팅_비용 / 복구된_고객수"
    },
    "reactivated_customer_ltv": {
      "current": "$1,200",
      "target": "$3,600+",
      "improvement": "+200% to +300%",
      "formula": "재구매액 × 재구매횟수 × 평균수명"
    },
    "response_time": {
      "current": "72h",
      "target": "24h",
      "improvement": "-67%",
      "formula": "첫_SMS_발송 ↔ 응답_시간"
    }
  },
  "expectedMonthlyImpact": {
    "description": "부재고객 500명 기준",
    "reactivated_customers": "310-485명",
    "revenue": "$372K-$1.746M",
    "calculation": "재활성화고객 × 평균거래액 ₩2.2M × 환율"
  }
}
```

### L1: 가격이의 자동 대응
```json
{
  "lensId": "L1",
  "lensName": "Price Resistance (가격이의 처리)",
  "primaryProblem": "\"너무 비싼데\" 이의로 인한 거래 실패",
  "metrics": {
    "price_objection_resolution_rate": {
      "current": "25%",
      "target": "42-48%",
      "improvement": "+68% to +92%",
      "formula": "(이의_해결 → 구매 / 전체_가격이의) × 100"
    },
    "day0_3_response_rate": {
      "current": "18%",
      "target": "35-42%",
      "improvement": "+94% to +133%",
      "formula": "(클릭_+_응답 / SMS_발송) × 100"
    },
    "payment_option_selection_rate": {
      "current": "12%",
      "target": "28-35%",
      "improvement": "+133% to +192%",
      "formula": "(결제링크_클릭 / 이의_감지건) × 100"
    },
    "price_objection_to_sale": {
      "current": "8%",
      "target": "20-25%",
      "improvement": "+150% to +213%",
      "formula": "(최종_구매 / L1_조치건) × 100"
    }
  },
  "expectedMonthlyImpact": {
    "description": "월 가격이의 감지 200건 기준",
    "objections_resolved": "84-96건",
    "additional_revenue": "$184.8K-$211.2K",
    "calculation": "해결건수 × 평균거래액 ₩2.2M × 환율"
  }
}
```

### L2: 준비복잡 불안 해소
```json
{
  "lensId": "L2",
  "lensName": "Preparation Burden (준비복잡 불안)",
  "primaryProblem": "\"준비가 복잡할 것 같다\" 불안",
  "metrics": {
    "preparation_anxiety_resolution": {
      "current": "28%",
      "target": "45%",
      "improvement": "+61%"
    },
    "call_duration_reduction": {
      "current": "18분",
      "target": "8분",
      "improvement": "-56% (효율성 증대)",
      "benefit": "콜센터 비용 40% 절감"
    },
    "checklist_completion_rate": {
      "current": "22%",
      "target": "65-75%",
      "improvement": "+195% to +227%"
    },
    "preparation_confidence_score": {
      "current": "3.2/5",
      "target": "4.5-4.8/5",
      "improvement": "+41% to +50%",
      "nps_impact": "NPS +8 to +15 포인트"
    }
  },
  "expectedMonthlyImpact": {
    "description": "월 준비불안 신호 150건 기준",
    "anxieties_resolved": "68-113건",
    "conversion_improvement": "$149.6K-$248.6K",
    "cso_cost_savings": "$12K-$18K (콜센터 비용)"
  }
}
```

### L3: 차별성 강조 (경쟁사 구분)
```json
{
  "lensId": "L3",
  "lensName": "Differentiation (차별성 미인지)",
  "primaryProblem": "\"일반여행과 뭐가 다른데?\" 미인지",
  "metrics": {
    "differentiation_recognition": {
      "current": "32%",
      "target": "50%",
      "improvement": "+56%"
    },
    "boat_vs_hotel_clarity": {
      "current": "28%",
      "target": "72%",
      "improvement": "+157%"
    },
    "competitor_mention_recovery": {
      "current": "18%",
      "target": "40-50%",
      "improvement": "+122% to +178%",
      "formula": "경쟁사_언급 후 구매 / 전체_경쟁사_언급"
    },
    "differentiation_to_conversion": {
      "current": "40%",
      "target": "40-50%",
      "improvement": "+0% to +25%",
      "note": "L3는 의사결정보다는 객관적 이해에 초점"
    }
  },
  "expectedMonthlyImpact": {
    "description": "월 차별성 미인지 신호 120건 기준",
    "recognition_improved": "58-72건",
    "competitor_saved_deals": "24-35건",
    "revenue_protection": "$52.8K-$77K",
    "market_positioning": "경쟁사 대비 인지도 +25-35%"
  }
}
```

### L6: 타이밍 기반 긴박감
```json
{
  "lensId": "L6",
  "lensName": "Timing Urgency (타이밍 불안)",
  "primaryProblem": "\"언제 가야 할지 모름\" + 결정 미루기",
  "metrics": {
    "urgency_perception": {
      "current": "22%",
      "target": "52-71%",
      "improvement": "+136% to +223%"
    },
    "timing_decision_rate": {
      "current": "18%",
      "target": "40-52%",
      "improvement": "+122% to +189%"
    },
    "immediate_purchase_rate": {
      "current": "12%",
      "target": "28-35%",
      "improvement": "+133% to +192%"
    },
    "time_to_purchase": {
      "current": "4-5일",
      "target": "1-2시간",
      "improvement": "-96% to -99%",
      "benefit": "거래 주기 극단적 단축"
    },
    "countdown_timer_click_rate": {
      "current": "N/A",
      "target": "45-55%",
      "improvement": "신규 KPI"
    }
  },
  "expectedMonthlyImpact": {
    "description": "월 타이밍 신호 300건 기준",
    "urgency_perceived": "156-213건",
    "timing_decisions": "120-156건",
    "immediate_purchases": "84-109건",
    "revenue": "$184.8K-$239.8K",
    "pipeline_acceleration": "거래주기 -96시간"
  }
}
```

### L10: 즉시 구매 3중선택
```json
{
  "lensId": "L10",
  "lensName": "Immediate Purchase (즉시 구매 결정)",
  "primaryProblem": "\"이미 원하는데 마지막 고민\"",
  "metrics": {
    "l10_signal_detection": {
      "current": "35%",
      "target": "70-85%",
      "improvement": "+100% to +143%"
    },
    "triple_choice_selection": {
      "current": "48%",
      "target": "75-85%",
      "improvement": "+56% to +77%"
    },
    "immediate_purchase_conversion": {
      "current": "50%",
      "target": "70-95%",
      "improvement": "+40% to +90%"
    },
    "average_purchase_value": {
      "current": "₩2.0M",
      "target": "₩2.4M+",
      "improvement": "+20%",
      "reason": "프리미엄 선택지 유도"
    },
    "upsell_rate": {
      "current": "8%",
      "target": "20-30%",
      "improvement": "+150% to +275%"
    }
  },
  "expectedMonthlyImpact": {
    "description": "월 L10 신호 200건 기준",
    "detected_signals": "140-170건",
    "triple_choice_selections": "105-145건",
    "final_purchases": "74-138건",
    "revenue": "$162.8K-$303.6K",
    "average_order_value_increase": "+20% per customer"
  }
}
```

---

## 💰 통합 월별 예상 효과 (All 10 Lenses)

### 보수적 시나리오 (Conservative Estimate)

```json
{
  "scenario": "CONSERVATIVE",
  "assumptions": {
    "current_monthly_contacts": 5000,
    "current_conversion_rate": "12%",
    "current_monthly_sales": 600,
    "average_transaction_value": "₩2.2M (약 $1,650)",
    "current_monthly_revenue": "₩1.32B ($990K)"
  },
  "lens_breakdown": {
    "L0_reactivation": {
      "monthly_revenue_lift": "₩416M ($312K)",
      "calculation": "500명 부재 × 62% 복구율 × ₩1.3M"
    },
    "L1_price_objection": {
      "monthly_revenue_lift": "₩185M ($138.75K)",
      "calculation": "200건 이의 × 42% 해결율 × ₩2.2M"
    },
    "L2_preparation_anxiety": {
      "monthly_revenue_lift": "₩150M ($112.5K)",
      "calculation": "150건 불안 × 45% 해결율 × ₩2.2M"
    },
    "L3_differentiation": {
      "monthly_revenue_lift": "₩88M ($66K)",
      "calculation": "120건 미인지 × 33% 향상율 × ₩2.2M"
    },
    "L6_timing": {
      "monthly_revenue_lift": "₩266M ($199.5K)",
      "calculation": "300건 신호 × 40% 타이밍결정 × ₩2.2M"
    },
    "L10_immediate": {
      "monthly_revenue_lift": "₩243M ($182.25K)",
      "calculation": "200건 신호 × 55% 3중선택 × 70% 구매"
    },
    "cumulative_other_lenses": {
      "monthly_revenue_lift": "₩200M ($150K)",
      "note": "L4, L5, L7, L8, L9 통합"
    }
  },
  "total_monthly_impact": {
    "additional_revenue": "₩1.548B ($1.161M)",
    "revenue_growth": "+117%",
    "new_total_revenue": "₩2.868B ($2.151M)",
    "net_margin_assumption": "35% (기술 제외)",
    "new_monthly_profit": "₩1.004B ($753.6K)"
  }
}
```

### 공격적 시나리오 (Aggressive Estimate)

```json
{
  "scenario": "AGGRESSIVE",
  "assumptions": {
    "flawless_implementation": true,
    "team_adoption_rate": "95%+",
    "technical_uptime": "99.99%"
  },
  "total_monthly_impact": {
    "additional_revenue": "₩2.152B ($1.614M)",
    "revenue_growth": "+163%",
    "new_total_revenue": "₩3.472B ($2.604M)",
    "new_monthly_profit": "₩1.215B ($911.25K)"
  }
}
```

---

## 📈 재정적 임팩트 (6개월, 12개월)

### 6개월 누적 효과 (Conservative)
```
Initial Revenue (Month 0-1): ₩2.64B ($1.98M)
Added Revenue (Month 2-6): ₩7.74B ($5.805M)
===========================================
6-Month Total: ₩10.38B ($7.785M)
6-Month Profit (35% margin): ₩3.633B ($2.7248M)
```

### 12개월 누적 효과 (Conservative)
```
Year 1 Revenue (with ramp-up): ₩16.32B ($12.24M)
Year 1 Profit (35% margin): ₩5.712B ($4.284M)

비교:
- Before: ₩11.88B ($8.91M) revenue / ₩4.158B ($3.1185M) profit
- After: ₩16.32B ($12.24M) revenue / ₩5.712B ($4.284M) profit
- Growth: +37.4% revenue, +37.4% profit
```

---

## 🎯 KPI 대시보드 (Real-time Tracking)

### 일일 KPI 리포팅
```json
{
  "dailyMetrics": {
    "contacts_created": "현재 수 vs 목표",
    "conversion_rate": "현재 % vs 목표 %",
    "average_transaction_value": "현재 ₩ vs 목표 ₩",
    "daily_revenue": "현재 ₩ vs 목표 ₩",
    "l0_reactivation_rate": "현재 % vs 목표 62-97%",
    "l1_price_resolution": "현재 % vs 목표 42-48%",
    "l6_timing_urgency": "현재 % vs 목표 52-71%",
    "l10_readiness_score": "현재 점수 vs 목표"
  }
}
```

### 주간/월간 리포팅
```sql
-- Weekly Psychology Impact Report
SELECT 
  WEEK(created_at) as week,
  COUNT(*) as total_contacts,
  SUM(CASE WHEN purchased = 1 THEN 1 ELSE 0 END) as purchases,
  ROUND(100.0 * SUM(CASE WHEN purchased = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_pct,
  SUM(purchase_amount) as weekly_revenue,
  AVG(purchase_amount) as avg_transaction_value,
  SUM(CASE WHEN l0_signal = 1 AND purchased = 1 THEN 1 ELSE 0 END) as l0_conversions,
  SUM(CASE WHEN l1_signal = 1 AND purchased = 1 THEN 1 ELSE 0 END) as l1_conversions,
  SUM(CASE WHEN l6_signal = 1 AND purchased = 1 THEN 1 ELSE 0 END) as l6_conversions,
  SUM(CASE WHEN l10_signal = 1 AND purchased = 1 THEN 1 ELSE 0 END) as l10_conversions,
  ROUND(AVG(risk_score), 1) as avg_risk_score
FROM contacts
WHERE created_at > DATE_SUB(NOW(), INTERVAL 12 WEEK)
GROUP BY WEEK(created_at)
ORDER BY week DESC;
```

---

## 📊 성공 지표 (Success Metrics)

### Go/No-Go 기준 (Month 1)
```json
{
  "success_criteria": {
    "month_1_targets": {
      "conversion_rate_improvement": {
        "metric": "12% → 15%+",
        "status": "GO/NO-GO",
        "requirement": "Must achieve"
      },
      "l6_implementation": {
        "metric": "Real-time countdown 배포",
        "status": "CRITICAL",
        "requirement": "Must complete"
      },
      "l10_signal_detection": {
        "metric": "AI 모델 학습완료",
        "status": "CRITICAL",
        "requirement": "Must achieve 70%+ accuracy"
      }
    },
    "if_no_go": "심리학 기법 검토 및 재전략 (Week 2)"
  }
}
```

### Scale-up 기준 (Month 2-3)
```json
{
  "scale_up_targets": {
    "conversion_rate": "15% → 18%+",
    "l1_resolution": "25% → 35%+",
    "l6_urgency_perception": "22% → 40%+",
    "l10_purchase_rate": "50% → 65%+",
    "team_adoption": "80%+ use of psychology framework"
  }
}
```

---

## 🎯 체크리스트: 성과 메트릭 구현

- [ ] 렌즈별 baseline 메트릭 수집 (Current state)
- [ ] 목표 설정 (Target: 위 문서 기준)
- [ ] Daily KPI 대시보드 구축
- [ ] Weekly 렌즈별 성과 리포팅
- [ ] Monthly ROI 분석
- [ ] A/B 테스트 결과 추적
- [ ] Risk Score 개선 추이
- [ ] Customer NPS 추적
- [ ] Cost per Acquisition (CPA) 모니터링
- [ ] Customer Lifetime Value (LTV) 계산

---

## 💡 재정 시뮬레이션

```
보수적 추정 (Conservative):
- Month 0 Revenue: ₩1.32B
- Month 6 Average Revenue: ₩2.2B (+67%)
- Year 1 Revenue: ₩2.86B (+117%)
- Year 1 Profit: ₩1.0B (35% margin)
- 초기투자 회수: 2-3개월

공격적 추정 (Aggressive):
- Year 1 Revenue: ₩3.47B (+163%)
- Year 1 Profit: ₩1.215B (35% margin)
- NPV (5년, 10% discount): ₩4.2B+
```

---

**파일 참고**: [[psychology_theories_master]] / [[grant_cardone_deal_killer]] / [[phase3_track_d_ab_test_complete]]
