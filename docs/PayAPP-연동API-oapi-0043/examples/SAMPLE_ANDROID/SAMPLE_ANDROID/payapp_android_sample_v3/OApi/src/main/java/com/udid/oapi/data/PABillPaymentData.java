package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PABillPaymentData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 등록결제 연동키
     * 필수
     */
    @NonNull
    String encBill;

    /**
     * 상품명
     * 필수
     */
    @NonNull
    String goodname;

    /**
     * 상품가격
     * 필수
     */
    @NonNull
    String price;

    /**
     * 구매자 전화번호
     * 필수
     */
    @NonNull
    String recvphone;

    /**
     * 공급가액
     */
    String amount_taxable;

    /**
     * 면세금액
     */
    String amount_taxfree;

    /**
     * 부가세
     */
    String amount_vat;

    /**
     * 결제완료 후 결과값을 리턴받을 고객사 URL 응답내용은 결제 요청 API Part1 참조
     */
    String feedbackurl;

    /**
     * feedbackurl 재시도 (y:재시도,n:재시도 안함)
     * feedbackurl의 응답값이 SUCCESS 가 아니면 feedbackurl 호출을 재시도 합니다. (총 10회 재시도)
     */
    String checkretry;

    /**
     * 카드할부 개월 수 ('00','01','02'....)
     * 50,000원 이상부터 할부 가능
     */
    String cardinst;


    private static PABillPaymentDataBuilder builder() {
        return new PABillPaymentDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param encBill
     * @param goodname
     * @param price
     * @param recvphone
     * @return
     */
    public static PABillPaymentDataBuilder builder(String userid, String encBill, String goodname, String price, String recvphone) {
        return PABillPaymentData.builder().userid(userid).encBill(encBill).goodname(goodname).price(price).recvphone(recvphone);
    }

}