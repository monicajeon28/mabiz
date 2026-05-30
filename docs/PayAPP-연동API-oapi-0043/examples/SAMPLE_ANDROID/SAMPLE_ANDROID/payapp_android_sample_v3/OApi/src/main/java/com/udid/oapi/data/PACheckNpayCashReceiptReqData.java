package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 네이버페이 현금영수증 발행대상 금액조회
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PACheckNpayCashReceiptReqData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 결제요청번호
     * 필수
     */
    @NonNull
    String mul_no;

    private static PACheckNpayCashReceiptReqDataBuilder builder() {
        return new PACheckNpayCashReceiptReqDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param mul_no
     * @return
     */
    public static PACheckNpayCashReceiptReqDataBuilder builder(String userid, String mul_no) {

        return PACheckNpayCashReceiptReqData.builder().userid(userid).mul_no(mul_no);
    }

}
