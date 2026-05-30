package com.udid.applink.model;

import android.content.Intent;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * 영수증 취소 결과값
 * Create by 김진원
 */
@Getter
@Setter
@ToString(callSuper = true)
public class PACashReceiptCancelResponseData extends PACommonResponseData{


    /**
     * 승인 번호
     */
    String receiptno;


    /**
     * 임의 변수 1, 2
     */
    String var1;
    String var2;

    public PACashReceiptCancelResponseData(Intent data) {
        super(data);
        receiptno = data.getData().getQueryParameter("receiptno");
        var1 = data.getData().getQueryParameter("var1");
        var2 = data.getData().getQueryParameter("var2");
    }




}
