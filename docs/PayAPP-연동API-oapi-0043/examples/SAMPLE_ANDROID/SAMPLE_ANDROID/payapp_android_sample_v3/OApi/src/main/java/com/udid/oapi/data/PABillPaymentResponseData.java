package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 */
@Getter
@Setter
@ToString(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PABillPaymentResponseData extends PAResponseData {

    /**
     * 영수증 url
     */
    String CSTURL;

    /**
     * 결제금액
     */
    String price;

    /**
     * 결제요청번호
     */
    int mul_no;

}