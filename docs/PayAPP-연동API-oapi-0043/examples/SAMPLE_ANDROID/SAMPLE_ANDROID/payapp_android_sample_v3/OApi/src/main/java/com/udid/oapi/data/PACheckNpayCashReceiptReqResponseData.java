package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 네이버페이 현금영수증 발행대상 금액조회
 */
@Getter
@Setter
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class PACheckNpayCashReceiptReqResponseData extends PAResponseData {

    /**
     * 현금영수증 발행 대상 총 금액
     */
    String totalCashAmount;

    /**
     * 현금성 총 공급가
     */
    String supplyCashAmount;

    /**
     * 현금성 총 부가세
     */
    String vatCashAmount;

}
