#!/usr/bin/env python3
"""
A/B Test Statistical Analysis Module
Phase 3 Track D: Cold Call Opening Script Analysis
Author: CRM Analytics Team
Date: 2026-05-22
"""

import math
from typing import Dict, Tuple, NamedTuple
from dataclasses import dataclass
from datetime import datetime


class ContingencyTable(NamedTuple):
    """2x2 contingency table for chi-square test"""
    a_converted: int    # A group conversions
    a_not_converted: int  # A group non-conversions
    b_converted: int    # B group conversions
    b_not_converted: int  # B group non-conversions


@dataclass
class ABTestResult:
    """A/B test analysis result"""
    test_week: int
    total_calls_a: int
    total_calls_b: int
    conversions_a: int
    conversions_b: int
    conversion_rate_a: float  # 0.45 = 45%
    conversion_rate_b: float  # 0.55 = 55%
    difference: float  # rate_b - rate_a
    chi_square: float
    p_value: float
    z_score: float
    ci_lower: float  # 95% CI lower bound
    ci_upper: float  # 95% CI upper bound
    relative_risk: float
    statistical_significance: bool  # p < 0.05
    interpretation: str


def calculate_sample_size(
    alpha: float = 0.05,
    beta: float = 0.20,
    p_a: float = 0.45,
    p_b: float = 0.55
) -> int:
    """
    Calculate required sample size for two-proportion Z-test

    Args:
        alpha: Significance level (default 0.05 for two-sided 95% CI)
        beta: Type II error rate (default 0.20 for 80% power)
        p_a: Expected conversion rate for group A
        p_b: Expected conversion rate for group B

    Returns:
        Sample size per group (n)

    Formula:
        n = 2 × (z_{α/2} + z_β)² × p̄(1-p̄) / (p_B - p_A)²
    """
    z_alpha = 1.96  # two-sided α/2 = 0.025
    z_beta = 0.84   # power = 0.80, so β = 0.20

    p_bar = (p_a + p_b) / 2
    delta = p_b - p_a

    numerator = 2 * (z_alpha + z_beta) ** 2 * p_bar * (1 - p_bar)
    denominator = delta ** 2

    n = numerator / denominator
    return int(math.ceil(n))


def chi_square_test(contingency_table: ContingencyTable) -> Tuple[float, float]:
    """
    Perform chi-square test on 2x2 contingency table

    Args:
        contingency_table: 2x2 table with A/B conversion/non-conversion counts

    Returns:
        Tuple of (chi_square_statistic, p_value)

    Formula:
        χ² = n(ad - bc)² / [(a+b)(c+d)(a+c)(b+d)]

    where:
        a = conversions in A
        b = non-conversions in A
        c = conversions in B
        d = non-conversions in B
    """
    a = contingency_table.a_converted
    b = contingency_table.a_not_converted
    c = contingency_table.b_converted
    d = contingency_table.b_not_converted

    n = a + b + c + d

    if n == 0:
        return 0.0, 1.0

    numerator = n * (a*d - b*c) ** 2
    denominator = (a + b) * (c + d) * (a + c) * (b + d)

    if denominator == 0:
        return 0.0, 1.0

    chi_square = numerator / denominator

    # Convert chi-square to p-value using approximation
    # For df=1, chi-square ≈ z²
    z_score = math.sqrt(chi_square)

    # P-value from standard normal distribution (two-sided)
    # P(Z > z) = 1 - Φ(z)
    from scipy.stats import norm
    p_value = 2 * (1 - norm.cdf(z_score))

    return chi_square, p_value


def two_proportion_z_test(
    conversions_a: int,
    total_a: int,
    conversions_b: int,
    total_b: int
) -> Tuple[float, float, float]:
    """
    Perform two-proportion Z-test

    Args:
        conversions_a: Number of conversions in group A
        total_a: Total calls in group A
        conversions_b: Number of conversions in group B
        total_b: Total calls in group B

    Returns:
        Tuple of (z_score, p_value, difference)
    """
    if total_a == 0 or total_b == 0:
        return 0.0, 1.0, 0.0

    p_a = conversions_a / total_a
    p_b = conversions_b / total_b
    difference = p_b - p_a

    # Pooled proportion
    p_pool = (conversions_a + conversions_b) / (total_a + total_b)

    # Standard error
    se = math.sqrt(p_pool * (1 - p_pool) * (1/total_a + 1/total_b))

    if se == 0:
        return 0.0, 1.0, difference

    # Z-score
    z_score = difference / se

    # P-value (two-sided)
    from scipy.stats import norm
    p_value = 2 * (1 - norm.cdf(abs(z_score)))

    return z_score, p_value, difference


def confidence_interval_95(conversions: int, total: int) -> Tuple[float, float]:
    """
    Calculate 95% confidence interval for proportion

    Args:
        conversions: Number of successes
        total: Total sample size

    Returns:
        Tuple of (lower_bound, upper_bound) as proportions

    Formula (Normal approximation):
        p ± z_{α/2} × √[p(1-p)/n]
    """
    if total == 0:
        return 0.0, 1.0

    p = conversions / total
    z = 1.96  # 95% CI
    se = math.sqrt(p * (1 - p) / total)

    lower = max(0.0, p - z * se)
    upper = min(1.0, p + z * se)

    return lower, upper


def relative_risk(conversion_rate_b: float, conversion_rate_a: float) -> float:
    """
    Calculate relative risk (RR)

    Args:
        conversion_rate_b: Conversion rate for group B
        conversion_rate_a: Conversion rate for group A

    Returns:
        RR as float (e.g., 1.22 = 22% improvement)
    """
    if conversion_rate_a == 0:
        return 0.0

    return conversion_rate_b / conversion_rate_a


def analyze_ab_test(contingency_table: ContingencyTable, test_week: int) -> ABTestResult:
    """
    Comprehensive A/B test analysis

    Args:
        contingency_table: 2x2 contingency table
        test_week: Week number (1-12) for context

    Returns:
        Detailed ABTestResult with all statistics
    """
    a = contingency_table.a_converted
    b = contingency_table.a_not_converted
    c = contingency_table.b_converted
    d = contingency_table.b_not_converted

    total_a = a + b
    total_b = c + d
    total = total_a + total_b

    # Conversion rates
    rate_a = a / total_a if total_a > 0 else 0.0
    rate_b = c / total_b if total_b > 0 else 0.0
    difference = rate_b - rate_a

    # Chi-square test
    chi_square, p_value = chi_square_test(contingency_table)

    # Two-proportion Z-test
    z_score, p_value_z, _ = two_proportion_z_test(a, total_a, c, total_b)

    # Confidence intervals
    ci_a_lower, ci_a_upper = confidence_interval_95(a, total_a)
    ci_b_lower, ci_b_upper = confidence_interval_95(c, total_b)

    # Relative risk
    rr = relative_risk(rate_b, rate_a)

    # Statistical significance (p < 0.05)
    is_significant = p_value < 0.05

    # Interpretation
    if is_significant and rate_b > rate_a:
        interpretation = f"✅ B is significantly better (p={p_value:.4f})"
    elif is_significant and rate_b < rate_a:
        interpretation = f"❌ B is significantly worse (p={p_value:.4f})"
    elif difference > 0.10:
        interpretation = f"⚠️  B shows trend of improvement but not significant (p={p_value:.4f})"
    elif difference < -0.10:
        interpretation = f"⚠️  B shows trend of decline but not significant (p={p_value:.4f})"
    else:
        interpretation = f"➡️  No meaningful difference (p={p_value:.4f})"

    # Obrien-Fleming adjusted p-value thresholds (Week 4, 8, 12)
    of_thresholds = {
        4: 0.001,   # Very stringent
        8: 0.013,   # Moderate
        12: 0.048   # Original alpha
    }

    if test_week in of_thresholds:
        adjusted_threshold = of_thresholds[test_week]
        if p_value < adjusted_threshold:
            interpretation += f" [OBF-adjusted significant at Week {test_week}]"
        else:
            interpretation += f" [OBF-adjusted threshold: p < {adjusted_threshold}]"

    return ABTestResult(
        test_week=test_week,
        total_calls_a=total_a,
        total_calls_b=total_b,
        conversions_a=a,
        conversions_b=c,
        conversion_rate_a=rate_a,
        conversion_rate_b=rate_b,
        difference=difference,
        chi_square=chi_square,
        p_value=p_value,
        z_score=z_score,
        ci_lower=ci_b_lower - ci_a_lower,  # Difference in CI
        ci_upper=ci_b_upper - ci_a_upper,
        relative_risk=rr,
        statistical_significance=is_significant,
        interpretation=interpretation
    )


def print_ab_test_report(result: ABTestResult) -> None:
    """Pretty print A/B test result"""
    print(f"\n{'='*60}")
    print(f"Week {result.test_week} A/B Test Analysis")
    print(f"{'='*60}\n")

    print(f"GROUP A (Standard):")
    print(f"  Total calls: {result.total_calls_a}")
    print(f"  Conversions: {result.conversions_a}")
    print(f"  Conversion rate: {result.conversion_rate_a:.2%}")

    print(f"\nGROUP B (Enhanced):")
    print(f"  Total calls: {result.total_calls_b}")
    print(f"  Conversions: {result.conversions_b}")
    print(f"  Conversion rate: {result.conversion_rate_b:.2%}")

    print(f"\nDIFFERENCE:")
    print(f"  Rate difference: {result.difference:+.2%}")
    print(f"  Relative risk (RR): {result.relative_risk:.2f}x")

    print(f"\nSTATISTICAL TESTS:")
    print(f"  Chi-square: χ² = {result.chi_square:.4f}")
    print(f"  Z-score: z = {result.z_score:.4f}")
    print(f"  p-value (two-sided): {result.p_value:.6f}")
    print(f"  Significant (α=0.05): {result.statistical_significance}")

    print(f"\nCONFIDENCE INTERVALS (95%):")
    print(f"  Difference CI: [{result.ci_lower:.4f}, {result.ci_upper:.4f}]")

    print(f"\nINTERPRETATION:")
    print(f"  {result.interpretation}")

    print(f"\n{'='*60}\n")


# Example usage
if __name__ == "__main__":
    # Week 4 mid-analysis example
    table_w4 = ContingencyTable(
        a_converted=55,
        a_not_converted=145,
        b_converted=75,
        b_not_converted=125
    )

    result_w4 = analyze_ab_test(table_w4, test_week=4)
    print_ab_test_report(result_w4)

    # Sample size calculation
    required_n = calculate_sample_size(p_a=0.45, p_b=0.55)
    print(f"Required sample size per group: {required_n}")
    print(f"Total sample size (both groups): {required_n * 2}")
