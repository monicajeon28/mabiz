package com.udid.oapi.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.ToString;

/**
 * Create by 김진원
 * 현금영수증 발행
 */
@Getter
@Setter
@ToString
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PACashStRegistData {

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
     * 상품명
     * 필수
     */
    @NonNull
    String good_name;

    /**
     * 구매자명
     * 필수
     */
    @NonNull
    String buyr_name;

    /**
     * 휴대폰번호 또는 사업자번호
     * 필수
     */
    @NonNull
    String id_info;

    /**
     * 원거래시각
     * 필수
     */
    @NonNull
    String trad_time;

    /**
     * 발행용도(0:소득공제용, 1:지출증빙용)
     * 필수
     */
    @NonNull
    String tr_code;

    /**
     * 거래금액
     * 필수
     */
    @NonNull
    String amt_tot;

    /**
     * 공급가액
     * 필수
     */
    @NonNull
    String amt_sup;

    /**
     * 봉사료
     * 필수
     */
    @NonNull
    String amt_svc;

    /**
     * 부가가치세
     * 필수
     */
    @NonNull
    String amt_tax;

    /**
     * 과세:TG01, 면세:TG02
     * 필수
     */
    @NonNull
    String corp_tax_type;

    /**
     * 구매자 휴대폰
     */
    String buyr_tel1;

    /**
     * 구매자 이메일
     */
    String buyr_mail;


    private static PACashStRegistDataBuilder builder() {
        return new PACashStRegistDataBuilder();
    }

    /**
     * 필수 값
     * @param userid
     * @param good_name
     * @param buyr_name
     * @param id_info
     * @param trad_time
     * @param tr_code
     * @param amt_tot
     * @param amt_sup
     * @param amt_svc
     * @param amt_tax
     * @param corp_tax_type
     * @return
     */
    public static PACashStRegistDataBuilder builder(String userid, String linkkey, String good_name, String buyr_name, String id_info, String trad_time, String tr_code, String amt_tot, String amt_sup, String amt_svc, String amt_tax, String corp_tax_type) {

        return PACashStRegistData.builder().userid(userid).linkkey(linkkey).good_name(good_name).buyr_name(buyr_name).id_info(id_info).trad_time(trad_time).tr_code(tr_code).amt_tot(amt_tot).amt_sup(amt_sup).amt_svc(amt_svc).amt_tax(amt_tax).corp_tax_type(corp_tax_type);
    }

}
