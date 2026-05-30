package com.udid.oapi.data;

import lombok.Getter;
import lombok.Setter;

/**
 * Create by 김진원
 */
@Getter
@Setter
public class PABillResoponseData {

    /**
     * 등록결제 연동키
     */
    String encBill = "";

    /**
     * 등록결제 키
     */
    String billAuthNo = "";

    /**
     * 카드번호
     */
    String cardno = "";

    /**
     * 카드사명
     */
    String cardname = "";
}
