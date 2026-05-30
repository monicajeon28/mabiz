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
public class PABillDeleteData {

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

    private static PABillDeleteDataBuilder builder() {
        return new PABillDeleteDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param encBill
     * @return
     */
    public static PABillDeleteDataBuilder builder(String userid, String encBill) {
        return PABillDeleteData.builder().userid(userid).encBill(encBill);
    }

}