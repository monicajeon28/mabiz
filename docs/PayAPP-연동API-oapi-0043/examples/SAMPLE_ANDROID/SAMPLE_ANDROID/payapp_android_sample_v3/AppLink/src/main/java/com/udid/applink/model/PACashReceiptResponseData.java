package com.udid.applink.model;

import android.content.Intent;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * 영수증 발행 결과값
 * Create by 김진원
 */
@Getter
@Setter
@ToString(callSuper = true)
public class PACashReceiptResponseData extends PACommonResponseData{

    /**
     * 현금영수증 발행 번호
     */
    String cashstno;

    /**
     * 승인 번호
     */
    String receiptno;

    /**
     * 영수증 url
     */
    String cashsturl;

    /**
     * 금액
     */
    String price;

    /**
     * 임의 변수 1, 2
     */
    String var1;
    String var2;

    public PACashReceiptResponseData(Intent data) {
        super(data);
        cashstno = data.getData().getQueryParameter("cashstno");
        receiptno = data.getData().getQueryParameter("receiptno");
        cashsturl = data.getData().getQueryParameter("cashsturl");
        price = data.getData().getQueryParameter("price");
        var1 = data.getData().getQueryParameter("var1");
        var2 = data.getData().getQueryParameter("var2");
    }




}
