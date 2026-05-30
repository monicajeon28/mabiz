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
public class PABillRegisterResponseData extends PAResponseData {

    /**
     * 등록결제 연동키
     */
    String encBill;

    /**
     * 등록결제 키
     */
    String billAuthNo;

    /**
     * 카드번호
     */
    String cardno;

    /**
     * 카드사명
     */
    String cardname;

}
