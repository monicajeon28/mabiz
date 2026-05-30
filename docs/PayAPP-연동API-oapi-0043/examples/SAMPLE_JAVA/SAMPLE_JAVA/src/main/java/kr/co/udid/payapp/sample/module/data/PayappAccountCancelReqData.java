package kr.co.udid.payapp.sample.module.data;

/**
 * Created by kimjinwon on 2016. 11. 14..
 */
public class PayappAccountCancelReqData {

    /**
     * 연동 KEY (필수)
     */
    private String linkkey;

    /**
     * 결제요청번호 (필수)
     */
    private String mul_no;

    /**
     * 정기 결제 요청 번호
     */
    private String rebill_no;

    /**
     * 결제요청취소 메모 (필수)
     */
    private String cancelmemo;

    public PayappAccountCancelReqData(String linkkey, String mul_no, String cancelmemo) {
        this.linkkey = linkkey;
        this.mul_no = mul_no;
        this.cancelmemo = cancelmemo;
    }

    public PayappAccountCancelReqData(String linkkey, String rebill_no, String cancelmemo, String type) {
        this.linkkey = linkkey;
        this.rebill_no = rebill_no;
        this.cancelmemo = cancelmemo;
    }

    public String getLinkkey() {
        return linkkey;
    }

    public String getMul_no() {
        return mul_no;
    }

    public String getCancelmemo() {
        return cancelmemo;
    }

    public void setLinkkey(String linkkey) {
        this.linkkey = linkkey;
    }

    public void setMul_no(String mul_no) {
        this.mul_no = mul_no;
    }

    public String getRebill_no() {
        return rebill_no;
    }

    public void setRebill_no(String rebill_no) {
        this.rebill_no = rebill_no;
    }

    public void setCancelmemo(String cancelmemo) {
        this.cancelmemo = cancelmemo;
    }

    @Override
    public String toString() {
        return "PayappAccountCancelReqData{" +
                "linkkey='" + linkkey + '\'' +
                ", mul_no='" + mul_no + '\'' +
                ", rebill_no='" + rebill_no + '\'' +
                ", cancelmemo='" + cancelmemo + '\'' +
                '}';
    }
}
