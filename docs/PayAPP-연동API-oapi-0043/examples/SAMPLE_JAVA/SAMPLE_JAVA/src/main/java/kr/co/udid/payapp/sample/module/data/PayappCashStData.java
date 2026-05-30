package kr.co.udid.payapp.sample.module.data;

/**
 * Created by kimjinwon on 2016. 11. 14..
 */
public class PayappCashStData {

    /**
     * 상품명 (필수)
     */
    private String good_name;

    /**
     * 구매자명 (필수)
     */
    private String buyr_name;

    /**
     * 구매자 휴대폰
     */
    private String buyr_tel1 = null;

    /**
     * 구매자 이메일
     */
    private String buyr_mail = null;

    /**
     * 휴대폰번호 또는 사업자번호 (필수)
     */
    private String id_info;

    /**
     * 원거래시각 (필수)
     */
    private String trad_time;

    /**
     * 발행용도(0:소득공제용, 1:지출증빙용) (필수)
     */
    private String tr_code;

    /**
     * 거래금액 (필수)
     */
    private String amt_tot;

    /**
     * 공급가액 (필수)
     */
    private String amt_sup;

    /**
     * 봉사료 (필수)
     */
    private String amt_svc;

    /**
     * 부가가치세 (필수)
     */
    private String amt_tax;

    /**
     * 과세:TG01, 면세:TG02 (필수)
     */
    private String corp_tax_type;

    public PayappCashStData(String good_name, String buyr_name, String id_info, String trad_time, String tr_code, String amt_tot, String amt_sup, String amt_svc, String amt_tax, String corp_tax_type) {
        this.good_name = good_name;
        this.buyr_name = buyr_name;
        this.id_info = id_info;
        this.trad_time = trad_time;
        this.tr_code = tr_code;
        this.amt_tot = amt_tot;
        this.amt_sup = amt_sup;
        this.amt_svc = amt_svc;
        this.amt_tax = amt_tax;
        this.corp_tax_type = corp_tax_type;
    }

    public String getGood_name() {
        return good_name;
    }

    public String getBuyr_name() {
        return buyr_name;
    }

    public String getBuyr_tel1() {
        return buyr_tel1;
    }

    public String getBuyr_mail() {
        return buyr_mail;
    }

    public String getId_info() {
        return id_info;
    }

    public String getTrad_time() {
        return trad_time;
    }

    public String getTr_code() {
        return tr_code;
    }

    public String getAmt_tot() {
        return amt_tot;
    }

    public String getAmt_sup() {
        return amt_sup;
    }

    public String getAmt_svc() {
        return amt_svc;
    }

    public String getAmt_tax() {
        return amt_tax;
    }

    public String getCorp_tax_type() {
        return corp_tax_type;
    }

    public void setBuyr_tel1(String buyr_tel1) {
        this.buyr_tel1 = buyr_tel1;
    }

    public void setBuyr_mail(String buyr_mail) {
        this.buyr_mail = buyr_mail;
    }


    @Override
    public String toString() {
        return "PayappCashStData{" +
                "good_name='" + good_name + '\'' +
                ", buyr_name='" + buyr_name + '\'' +
                ", buyr_tel1='" + buyr_tel1 + '\'' +
                ", buyr_mail='" + buyr_mail + '\'' +
                ", id_info='" + id_info + '\'' +
                ", trad_time='" + trad_time + '\'' +
                ", tr_code='" + tr_code + '\'' +
                ", amt_tot='" + amt_tot + '\'' +
                ", amt_sup='" + amt_sup + '\'' +
                ", amt_svc='" + amt_svc + '\'' +
                ", amt_tax='" + amt_tax + '\'' +
                ", corp_tax_type='" + corp_tax_type + '\'' +
                '}';
    }
}
