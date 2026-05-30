package com.udid.oapi.data.embed;

import com.udid.oapi.data.PABillResoponseData;

import lombok.Getter;
import lombok.Setter;

/**
 * Create by 김진원
 */
@Getter
@Setter
public class PABillData {

    /**
     * 판매자 회원 아이디
     */
    String userId = "";

    /**
     * 구매자 성함
     */
    String buyerName = "";

    /**
     * 구매자 전화번호
     */
    String recvPhone = "";


    /**
     * Bill 데이터
     */
    PABillResoponseData billResoponseData = new PABillResoponseData();
}
