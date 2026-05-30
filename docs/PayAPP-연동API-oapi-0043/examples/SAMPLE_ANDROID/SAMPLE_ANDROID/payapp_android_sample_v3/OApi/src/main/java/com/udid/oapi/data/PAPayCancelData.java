package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 결제 (요청, 승인) 취소 데이터
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PAPayCancelData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 연동 KEY
     * 필수
     */
    @NonNull
    String linkkey;

    /**
     * 결제요청번호
     * 필수
     */
    @NonNull
    String mul_no;

    /**
     * 결제요청취소 메모
     */
    String cancelmemo;

    /**
     * 결제요청취소 모드
     * (값이 ready 인 경우 결제요청 상태만 취소 가능)
     */
    String cancelmode;

    /**
     * 결제요청취소 구분 (0:전취소, 1:부분취소)
     */
    String partcancel;

    /**
     * 결제요청취소 금액 (부분취소인 경우 필수)
     */
    String cancelprice;

    /**
     * 결제요청취소 과세 공급가액
     * (cancelprice = cancel_taxable + cancel_taxfree + cancel_vat)
     */
    String cancel_taxable;

    /**
     * 결제요청취소 면세 공급가액
     */
    String cancel_taxfree;

    /**
     * 결제요청취소 부가세
     */
    String cancel_vat;

    private static PAPayCancelDataBuilder builder() {
        return new PAPayCancelDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param linkkey
     * @param mul_no
     * @return
     */
    public static PAPayCancelDataBuilder builder(String userid, String linkkey, String mul_no) {

        return PAPayCancelData.builder().userid(userid).linkkey(linkkey).mul_no(mul_no);
    }

}
