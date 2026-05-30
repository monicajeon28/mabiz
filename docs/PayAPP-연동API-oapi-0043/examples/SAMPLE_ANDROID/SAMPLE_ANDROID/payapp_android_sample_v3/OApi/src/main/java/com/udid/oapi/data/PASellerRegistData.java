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
public class PASellerRegistData {

    /**
     * 판매자 회원 아이디
     * 필수
     */
    @NonNull
    String userid;

    /**
     * 판매자 회원 비밀번호 (영문,숫자 8자리)
     * 필수
     */
    @NonNull
    String userpwd;

    /**
     * 판매자명
     * 필수
     */
    @NonNull
    String sellername;

    /**
     * 판매자 휴대전화번호
     * 필수
     */
    @NonNull
    String phone;

    /**
     * 이메일
     * 필수
     */
    @NonNull
    String email;

    /**
     * 서비스 구분
     * 필수
     */
    @NonNull
    String bizkind;

    /**
     * 판매자 구분 (개인:1, 사업자:2)
     * 필수
     */
    @NonNull
    String usertype;

    /**
     * 대리점 또는 리셀러 아이디
     * 필수
     */
    @NonNull
    String resellerid;

    /**
     * 가입형태 (유료:0, 할인:4), 리셀러 회원 가입은 유료형
     * 필수
     */
    @NonNull
    String join_type;

    /**
     * 가입구분 (seller,reseller)
     * 필수
     */
    @NonNull
    String seller_type;

    /**
     * (사업자 필수) 사업자등록번호
     */
    String compregno;

    /**
     * (사업자 필수) 상호명(법인명)
     */
    String compname;

    /**
     * (사업자 필수) 업태
     */
    String biztype1;

    /**
     * (사업자 필수) 업종
     */
    String biztype2;

    /**
     * 주소-우편번호
     */
    String zipcode;

    /**
     * 주소1
     */
    String addr1;

    /**
     * 주소2
     */
    String addr2;

    /**
     * 홈페이지
     */
    String homepage;

    /**
     * 정산은행
     */
    String compbank;

    /**
     * 정산은행 계좌번호
     */
    String compbanknum;

    /**
     * 정산은행 예금주
     */
    String compbankname;

    /**
     * (개인 필수) 이름
     */
    String username;


    /**
     * (사업자 필수) 대표자 성함
     */
    String ceo_nm;

    /**
     * 공통 통보 URL
     */
    String common_feedbackurl;

    /**
     * 사업자 구분 (1:법인,2:개인)
     */
    String corp_type;


    private static PASellerRegistDataBuilder builder() {
        return new PASellerRegistDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param userpwd
     * @param sellername
     * @param phone
     * @param email
     * @param bizkind
     * @param resellerid
     * @param join_type
     * @param seller_type
     * @return
     */
    public static PASellerRegistDataBuilder builder(String userid, String userpwd, String sellername, String phone, String email, String bizkind, String usertype, String resellerid, String join_type, String seller_type) {

        return PASellerRegistData.builder().userid(userid).userpwd(userpwd).sellername(sellername).phone(phone).email(email).bizkind(bizkind).usertype(usertype).resellerid(resellerid).join_type(join_type).seller_type(seller_type);
    }

}
