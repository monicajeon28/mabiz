package kr.co.udid.payapp.sample.module.data.Result;

/**
 * Created by kimjinwon on 2016. 11. 14..
 */
public class PayappCashStResult {
    /**
     * 성공 실패 여부
     */
    boolean success;

    /**
     * 실패시 오류 메시지
     */
    String errorMessage;


    /**
     * 발행번호
     */
    String cashstno;

    /**
     * 발행URL
     */
    String cashsturl;


    public PayappCashStResult(boolean success, String errorMessage, String cashstno, String cashsturl) {
        this.success = success;
        this.errorMessage = errorMessage;
        this.cashstno = cashstno;
        this.cashsturl = cashsturl;
    }

    public boolean isSuccess() {
        return success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public String getCashstno() {
        return cashstno;
    }

    public String getCashsturl() {
        return cashsturl;
    }

    @Override
    public String toString() {
        return "PayappCashStResult{" +
                "success=" + success +
                ", errorMessage='" + errorMessage + '\'' +
                ", cashstno='" + cashstno + '\'' +
                ", cashsturl='" + cashsturl + '\'' +
                '}';
    }
}
