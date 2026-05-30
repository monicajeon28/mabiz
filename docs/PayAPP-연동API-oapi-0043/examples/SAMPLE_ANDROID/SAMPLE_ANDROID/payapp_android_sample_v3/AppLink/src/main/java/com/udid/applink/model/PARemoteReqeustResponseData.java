package com.udid.applink.model;

import android.content.Intent;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 */
@Getter
@Setter
@ToString(callSuper = true)
public class PARemoteReqeustResponseData extends PACommonResponseData {

    /**
     * 페이앱 결제 번호
     */
    String mul_no;
    /**
     * 결제 URL
     */
    String payurl;

    /**
     * 임의 변수 1, 2
     */
    String var1;
    String var2;


    public PARemoteReqeustResponseData(Intent data) {
        super(data);
        mul_no = data.getData().getQueryParameter("mul_no");
        payurl = data.getData().getQueryParameter("payurl");
        var1 = data.getData().getQueryParameter("var1");
        var2 = data.getData().getQueryParameter("var2");
    }
}
