package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;


/**
 * Create by 김진원
 * 정기결제 요청 데이터
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PARebillRegistData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 상품명
     * 필수
     */
    @NonNull
    String goodname;

    /**
     * 정기 결제 요청 금액
     * 필수
     */
    @NonNull
    String goodprice;

    /**
     * 수신 휴대전화 번호
     * 필수
     */
    @NonNull
    String recvphone;

    /**
     * 정기결제 주기 구분(Month, Week, Day)
     * 필수
     */
    @NonNull
    String rebillCycleType;

    /**
     * 정기결제 만료일 (yyyy-mm-dd)
     * 필수
     */
    @NonNull
    String rebillExpire;

    /**
     * 수신 이메일
     */
    String recvemail;

    /**
     * 정기 결제 요청 메모
     */
    String memo;

    /**
     * 이용료 부담
     */
    String addcomm;

    /**
     * 월 정기결제 결제일 (1~31,90:말일)
     */
    String rebillCycleMonth;

    /**
     * 주 정기결제 결제요일 (1 ~ 7) 1:월요일 ~ 7:일요일
     */
    String rebillCycleWeek;

    /**
     * 결제완료 피드백 URL
     */
    String feedbackurl;

    /**
     * 정기결제요청 SMS발송여부 (n:발송안함)
     */
    String smsuse;

    /**
     * 결제완료 후 이동할 링크 URL (매출전표 페이지에서 “확인”버튼 클릭시 이동)
     */
    String returnurl;

    /**
     * 결제 가능 수단 (신용카드:card, 휴대전화:phone)
     */
    String openpaytype;

    private static PARebillRegistDataBuilder builder() {
        return new PARebillRegistDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param goodname
     * @param goodprice
     * @param recvphone
     * @param rebillCycleType
     * @param rebillExpire
     * @return
     */
    public static PARebillRegistDataBuilder builder(String userid, String goodname, String goodprice, String recvphone, String rebillCycleType, String rebillExpire) {

        return PARebillRegistData.builder().userid(userid).goodname(goodname).goodprice(goodprice).recvphone(recvphone).rebillCycleType(rebillCycleType).rebillExpire(rebillExpire);
    }

}
