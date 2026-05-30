package kr.co.udid.payapp.sample.module.data;

/**
 * Created by kimjinwon on 2016. 11. 11..
 */
public class PayappAccountCancelData {

    /**
     * 연동 KEY (필수)
     */
    private String linkkey;

    /**
     * 결제요청번호 (필수)
     */
    private String mul_no;

    /**
     * 결제요청취소 메모
     */
    private String cancelmemo;

    /**
     * 결제요청취소 모드
     * (값이 ready 인 경우 결제요청 상태만 취소 가능)
     */
    private String cancelmode;

    public PayappAccountCancelData( String linkkey, String mul_no, String cancelmemo) {
        this.linkkey = linkkey;
        this.mul_no = mul_no;
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

    public String getCancelmode() {
        return cancelmode;
    }

    public void setCancelmode(String cancelmode) {
        this.cancelmode = cancelmode;
    }

    @Override
    public String toString() {
        return "PayappAccountCancelData{" +
                "linkkey='" + linkkey + '\'' +
                ", mul_no='" + mul_no + '\'' +
                ", cancelmemo='" + cancelmemo + '\'' +
                ", cancelmode='" + cancelmode + '\'' +
                '}';
    }
}
