package com.udid.applink.model;

import android.content.Intent;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;


/**
 * Create by 김진원
 */
@Setter
@Getter
@ToString
public class PACommonResponseData {

    /**
     * 결과(0:fail, 1:success)
     */
    String state;

    /**
     * 에러 메시지
     */
    String errorMessage;

    /**
     * 에러 코드
     */
    String errorCode;


    public PACommonResponseData(Intent data) {
        state = data.getData().getQueryParameter("state");
        errorMessage = data.getData().getQueryParameter("errorMessage");
        errorCode = data.getData().getQueryParameter("errorCode");
    }






}
