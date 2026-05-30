package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 정기결제 승인
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PARebillStartData {


    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 정기결제요청 등록번호
     * 필수
     */
    @NonNull
    String rebill_no;

    /**
     * 연동 KEY
     * 필수
     */
    @NonNull
    String linkkey;

    private static PARebillStartDataBuilder builder() {
        return new PARebillStartDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param rebill_no
     * @param linkkey
     * @return
     */
    public static PARebillStartDataBuilder builder(String userid, String rebill_no, String linkkey) {

        return PARebillStartData.builder().userid(userid).rebill_no(rebill_no).linkkey(linkkey);
    }
}
