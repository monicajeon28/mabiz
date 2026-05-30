package kr.co.udid.payapp.sample.module.data;

/**
 * Created by kimjinwon on 2016. 11. 14..
 */
public class PayappCashStCnData {

    /**
     * 발행번호 (필수)
     */
    private String cashstno;

    public PayappCashStCnData(String cashstno) {
        this.cashstno = cashstno;
    }

    public String getCashstno() {
        return cashstno;
    }

    @Override
    public String toString() {
        return "PayappCashStCnData{" +
                "cashstno='" + cashstno + '\'' +
                '}';
    }
}
