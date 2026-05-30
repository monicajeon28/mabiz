package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 결제 요청 데이터
 */
@Getter
@Setter
@ToString(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PAPayRequestResponseData extends PAResponseData {

    /**
     * 성공시 결제요청 번호
     */
    String mul_no;

    /**
     * 결제창 URL
     */
    String payurl;

}
