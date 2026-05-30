package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 판매자 회원 가입
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PASubidRegistData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 부계정 아이디
     * 필수
     */
    @NonNull
    String subuserid;

    /**
     * 부계정 비밀번호
     * 필수
     */
    @NonNull
    String subpwd;

    /**
     * 부계정명
     * 필수
     */
    @NonNull
    String subname;

    /**
     * 대분류
     */
    String subetc1;

    /**
     * 중분류
     */
    String subetc2;

    /**
     * 소분류
     */
    String subetc3;

    /**
     * 직급
     */
    String subjtype;

    /**
     * 권한
     */
    String state;


    private static PASubidRegistDataBuilder builder() {
        return new PASubidRegistDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param subuserid
     * @param subpwd
     * @param subname
     * @return
     */
    public static PASubidRegistDataBuilder builder(String userid, String subuserid, String subpwd, String subname) {

        return PASubidRegistData.builder().userid(userid).subuserid(subuserid).subpwd(subpwd).subname(subname);
    }
}
