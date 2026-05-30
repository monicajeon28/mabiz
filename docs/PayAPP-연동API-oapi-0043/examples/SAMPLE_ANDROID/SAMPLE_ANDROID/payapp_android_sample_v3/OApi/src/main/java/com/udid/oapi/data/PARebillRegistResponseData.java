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
public class PARebillRegistResponseData extends PAResponseData {

    /**
     * 정기결제 등록번호
     */
    String rebill_no;

    /**
     * 정기결제URL
     */
    String payurl;
}
