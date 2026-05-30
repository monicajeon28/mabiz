package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 현금영수증 발행
 */
@Getter
@Setter
@ToString(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PACashStResponseData extends PAResponseData {

    /**
     * 실패시 오류 문자열
     */
    String errorMessage;

    /**
     * 발행번호
     */
    String cashstno;

    /**
     * 발행url
     */
    String cashsturl;
}
