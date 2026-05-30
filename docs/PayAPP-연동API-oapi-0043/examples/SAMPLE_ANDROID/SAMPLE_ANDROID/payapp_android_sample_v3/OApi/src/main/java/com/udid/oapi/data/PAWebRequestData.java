package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.HashMap;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 */
@Getter
@Setter
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class PAWebRequestData {

    /**
     * 커맨드
     */
    private String command;

    /**
     * 응답 데이터
     */
    private String returnData;

    /**
     * 추가 데이터 1
     */
    private String extData1;

    /**
     * 추가 데이터 2
     */
    private String extData2;

    /**
     * 추가 데이터 3
     */
    private String extData3;

    /**
     * 데이터 맵
     */
    private HashMap<String, String> dataList = null;

    public PAWebRequestData(String command, HashMap<String, String> dataList) {
        this.command = command;
        this.dataList = dataList;
    }
}
