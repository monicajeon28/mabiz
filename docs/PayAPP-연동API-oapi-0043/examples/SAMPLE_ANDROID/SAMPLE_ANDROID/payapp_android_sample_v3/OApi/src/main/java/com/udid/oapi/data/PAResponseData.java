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
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class PAResponseData {

    /**
     * 1 : 성공
     * 0 : 실패
     */
    String state;

    /**
     * 실패시 오류 문자열
     */
    String errorMessage;

    /**
     * returnData
     */
    String returnJsonData = "";

}
