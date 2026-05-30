package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 현금영수증 발행 취소
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PACashStCancelData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 연동 KEY
     * 필수
     */
    @NonNull
    String linkkey;

    /**
     * 발행번호
     * 필수
     */
    @NonNull
    String cashstno;

    private static PACashStCancelDataBuilder builder() {
        return new PACashStCancelDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param cashstno
     * @return
     */
    public static PACashStCancelDataBuilder builder(String userid, String linkkey, String cashstno) {

        return PACashStCancelData.builder().userid(userid).linkkey(linkkey).cashstno(cashstno);
    }
}
