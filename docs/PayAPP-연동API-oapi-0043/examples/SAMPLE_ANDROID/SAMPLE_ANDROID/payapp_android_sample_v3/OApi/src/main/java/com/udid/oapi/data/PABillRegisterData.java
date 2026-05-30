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
public class PABillRegisterData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 카드번호
     * 필수
     */
    @NonNull
    String cardNo;

    /**
     * 카드 유효기간(월)
     * 필수
     */
    @NonNull
    String expMonth;

    /**
     * 카드 유효기간(년)
     * 필수
     */
    @NonNull
    String expYear;

    /**
     * 구매자확인 개인:생년월일(YYMMDD) 6자리 , 사업자번호
     * 필수
     */
    @NonNull
    String buyerAuthNo;

    /**
     * 카드 비밀번호 앞 두자리
     * 필수
     */
    @NonNull
    String cardPw;

    /**
     * 구매자 전화번호
     * 필수
     */
    @NonNull
    String buyerPhone;

    /**
     * 구매자 성함
     * 필수
     */
    @NonNull
    String buyerName;

    /**
     * 구매자 아이디
     */
    String buyerId;

    private static PABillRegisterDataBuilder builder() {
        return new PABillRegisterDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param cardNo
     * @param expMonth
     * @param expYear
     * @param buyerAuthNo
     * @param cardPw
     * @param buyerPhone
     * @param buyerName
     * @return
     */
    public static PABillRegisterDataBuilder builder(String userid, String cardNo, String expMonth, String expYear, String buyerAuthNo, String cardPw, String buyerPhone, String buyerName) {
        return PABillRegisterData.builder().userid(userid).cardNo(cardNo).expMonth(expMonth).expYear(expYear).buyerAuthNo(buyerAuthNo).cardPw(cardPw).buyerPhone(buyerPhone).buyerName(buyerName);
    }

}