package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 판매자 회원 아이디 중복체크
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PAUseridCheckData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 대리점 또는 리셀러 아이디
     * 필수
     */
    @NonNull
    String resellerid;

    private static PAUseridCheckDataBuilder builder() {
        return new PAUseridCheckDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param resellerid
     * @return
     */
    public static PAUseridCheckDataBuilder builder(String userid, String resellerid) {

        return PAUseridCheckData.builder().userid(userid).resellerid(resellerid);
    }

}
