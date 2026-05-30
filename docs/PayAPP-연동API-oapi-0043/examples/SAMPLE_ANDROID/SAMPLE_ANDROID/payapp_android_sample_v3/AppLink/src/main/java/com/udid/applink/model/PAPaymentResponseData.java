package com.udid.applink.model;

import android.content.Intent;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * 결제 요청 결과값
 * Create by 김진원
 */
@Getter
@Setter
@ToString(callSuper = true)
public class PAPaymentResponseData extends PACommonResponseData{

    /**
     * 페이앱 영수증 URL
     */
    String csturl;

    /**
     * 페이앱 결제 번호
     */
    String mul_no;

    /**
     * 카드사 이름
     */
    String cardName;

    /**
     * 카드 번호
     */
    String cardNum;

    /**
     * 결제 일시
     */
    String date;

    /**
     * 할부개월
     */
    String installment;

    /**
     * 상품명
     */
    String goodName;

    /**
     * 카드승인번호
     */
    String cardAuthNumber;

    /**
     * 상품 금액
     */
    String goodPrice;

    /**
     * 임의 변수 1, 2
     */
    String var1;
    String var2;

    public PAPaymentResponseData(Intent data) {
        super(data);
        csturl = data.getData().getQueryParameter("csturl");
        mul_no = data.getData().getQueryParameter("mul_no");
        cardName = data.getData().getQueryParameter("cardName");
        cardNum = data.getData().getQueryParameter("cardNum");
        date = data.getData().getQueryParameter("date");
        installment = data.getData().getQueryParameter("installment");
        goodName = data.getData().getQueryParameter("goodName");
        cardAuthNumber = data.getData().getQueryParameter("cardAuthNumber");
        goodPrice = data.getData().getQueryParameter("goodPrice");
        var1 = data.getData().getQueryParameter("var1");
        var2 = data.getData().getQueryParameter("var2");
    }




}
