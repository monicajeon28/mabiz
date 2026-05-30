package com.udid.oapi;

import com.udid.oapi.data.PABillDeleteData;
import com.udid.oapi.data.PABillDeleteResponseData;
import com.udid.oapi.data.PABillPaymentData;
import com.udid.oapi.data.PABillPaymentResponseData;
import com.udid.oapi.data.PABillRegisterData;
import com.udid.oapi.data.PABillRegisterResponseData;
import com.udid.oapi.data.PACashStCancelData;
import com.udid.oapi.data.PACashStCnResponseData;
import com.udid.oapi.data.PACashStRegistData;
import com.udid.oapi.data.PACashStResponseData;
import com.udid.oapi.data.PACheckNpayCashReceiptReqData;
import com.udid.oapi.data.PACheckNpayCashReceiptReqResponseData;
import com.udid.oapi.data.PAPayCancelData;
import com.udid.oapi.data.PAPayCancelReqData;
import com.udid.oapi.data.PAPayCancelReqResponseData;
import com.udid.oapi.data.PAPayCancelResponseData;
import com.udid.oapi.data.PAPayRequestData;
import com.udid.oapi.data.PAPayRequestResponseData;
import com.udid.oapi.data.PARebillCancelData;
import com.udid.oapi.data.PARebillCancelResponseData;
import com.udid.oapi.data.PARebillRegistData;
import com.udid.oapi.data.PARebillRegistResponseData;
import com.udid.oapi.data.PARebillStartData;
import com.udid.oapi.data.PARebillStartResponseData;
import com.udid.oapi.data.PARebillStopData;
import com.udid.oapi.data.PARebillStopResponseData;
import com.udid.oapi.data.PASellerRegistData;
import com.udid.oapi.data.PASellerRegistResponseData;
import com.udid.oapi.data.PASubidRegistData;
import com.udid.oapi.data.PASubidRegistResponseData;
import com.udid.oapi.data.PAUseridCheckData;
import com.udid.oapi.data.PAUseridCheckResponseData;
import com.udid.oapi.sv.PayAppSv;
import com.udid.oapi.sv.PayAppSvImp;
import com.udid.oapi.sv.handler.PAResultHandler;

/**
 * Create by 김진원
 */
public class PayAppOAPI {

    private PayAppSv payAppSv = new PayAppSvImp();

    static public PayAppOAPI create() {
        return new PayAppOAPI();
    }

    /**
     * 결제 요청
     *
     * 호출 파라메터 중 userid,goodname,price,recvphone 값은 필수 입니다.
     * feedbackurl 의 값은 “http://” 가 포함된 url 주소 값입니다.
     * 구매자가 결제완료시 feedbackurl로 아래 “feedbackurl 전달” 파라메터가 POST방식으로 전달 됩니다.
     * 결제요청 구분 (reqmode)가 usd (달러결제) 인 경우 openpaytype은 무시됩니다. (신용카드 결제만 가능)
     * 결제완료에 대한 처리는 feedbackurl에서 처리 하셔야 합니다.
     *
     * @param data
     * @param paResultHandler
     */
    public void payRequest(PAPayRequestData data, PAResultHandler<PAPayRequestResponseData> paResultHandler)  {
        payAppSv.payRequest(data, paResultHandler);
    }


    /**
     * 결제(요청,승인)취소
     *
     * 호출 파라메터 중 userid, linkkey, mul_no 값은 필수 입니다.
     * “2.1. 결제 요청” 연동 에서 feedbackurl을 입력된 결제요청 건 경우에는 결제 요청 취소 성공시 “2.1.6 Feedbackurl 전달” 으로 자료가 전송됩니다.
     * 부분 승인취소인 경우 “2.4 FeedbackURL”로 전달되는 mul_no(결제요청번호)는 변경 됩니다
     *
     * @param data
     * @param paResultHandler
     */
    public void payCancel(PAPayCancelData data, PAResultHandler<PAPayCancelResponseData> paResultHandler)  {
        payAppSv.payCancel(data, paResultHandler);
    }

    /**
     * 결제요청취소
     *
     * 구매자가 결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우 “2.3. 결제(요청,승인) 취소” 연동으로 취소 되지 않습니다.
     * 이 경우 결제 취소 요청 연동 후 정산금액을 반환하셔야(판매자 정산이 완료된 경우) 취소가 가능합니다.
     * @param data
     * @param paResultHandler
     */
    public void payCancelReq(PAPayCancelReqData data, PAResultHandler<PAPayCancelReqResponseData> paResultHandler)  {
        payAppSv.payCancelReq(data, paResultHandler);
    }

    /**
     * 정기 결제 요청
     *
     * 정기 결제를 위한 정기 결제 요청을 등록하는 API입니다.
     * 정기 결제 요청 등록 후 payurl로 구매자가 최초 1회 결제 승인이 성공하면 다음 결제 주기에 정기 결제가 발생됩니다.
     * 휴대전화 정기 결제는 월 정기 결제만 이용이 가능합니다.
     *
     * @param data
     * @param paResultHandler
     */
    public void rebillRegist(PARebillRegistData data, PAResultHandler<PARebillRegistResponseData> paResultHandler)  {
        payAppSv.rebillRegist(data, paResultHandler);
    }

    /**
     * 정기 결제 해지
     *
     * 해지된 정기 결제 건은 복구가 불가능 합니다.
     * @param data
     * @param paResultHandler
     */
    public void rebillCancel(PARebillCancelData data, PAResultHandler<PARebillCancelResponseData> paResultHandler)  {
        payAppSv.rebillCancel(data, paResultHandler);
    }

    /**
     * 정기 결제 일시정지
     *
     * 정기 결제 요청 건의 상태가 “승인”인 경우 일시정지가 가능합니다.
     * 일시정지된 정기 결제 건은 다음 결제 주기에 정기 결제가 발생되지 않습니다.
     * 일시정지된 정기 결제 건은 “승인” 상태로 변경이 가능합니다.
     * @param data
     * @param paResultHandler
     */
    public void rebillStop(PARebillStopData data, PAResultHandler<PARebillStopResponseData> paResultHandler)  {
        payAppSv.rebillStop(data, paResultHandler);
    }

    /**
     * 정기 결제 승인
     *
     * 정기 결제 요청 건의 상태가 “일시정지”인 경우 승인 상태로 변경이 가능합니다.
     * 승인 상태인 정기 결제 건은 다음 결제 주기에 정기 결제가 발생합니다.
     * @param data
     * @param paResultHandler
     */
    public void rebillStart(PARebillStartData data, PAResultHandler<PARebillStartResponseData> paResultHandler)  {
        payAppSv.rebillStart(data, paResultHandler);
    }

    /**
     * 판매자 회원 가입
     *
     * 대리점이 리셀러를, 리셀러가 판매자를 가입하는 연동입니다.
     * resellerid는 대리점 또는 리셀러 아이디를 입력하셔야 합니다.
     * @param data
     * @param paResultHandler
     */
    public void sellerRegist(PASellerRegistData data, PAResultHandler<PASellerRegistResponseData> paResultHandler)  {
        payAppSv.sellerRegist(data, paResultHandler);
    }

    /**
     * 판매자 회원 아이디 중복 체크
     *
     * resellerid는 대리점 또는 리셀러 아이디를 입력하셔야 합니다.
     * @param data
     * @param paResultHandler
     */
    public void useridCheck(PAUseridCheckData data, PAResultHandler<PAUseridCheckResponseData> paResultHandler)  {
        payAppSv.useridCheck(data, paResultHandler);
    }

    /**
     * 부계정 등록
     *
     * 직원별로 카드 결제 및 매출 현황관리를 가능하도록 부계정을 등록하는 연동입니다.
     * @param data
     * @param paResultHandler
     */
    public void subidRegist(PASubidRegistData data, PAResultHandler<PASubidRegistResponseData> paResultHandler)  {
        payAppSv.subidRegist(data, paResultHandler);
    }

    /**
     * 현금영수증 발행
     *
     * 현금영수증 발행 연동입니다.
     * @param data
     * @param paResultHandler
     */
    public void cashSt(PACashStRegistData data, PAResultHandler<PACashStResponseData> paResultHandler)  {
        payAppSv.cashStRegist(data, paResultHandler);
    }


    /**
     * 현금영수증 발행 취소
     *
     * 현금영수증 발행 취소 연동입니다.
     * @param data
     * @param paResultHandler
     */
    public void cashStCn(PACashStCancelData data, PAResultHandler<PACashStCnResponseData> paResultHandler)  {
        payAppSv.cashStCancel(data, paResultHandler);
    }


    /**
     * 네이버페이 현금영수증 발행대상 금액조회
     *
     * 네이버페이 현금영수증 발행대상 금액조회입니다.
     * @param data
     * @param paResultHandler
     */
    public void checkNpayCashReceiptReq(PACheckNpayCashReceiptReqData data, PAResultHandler<PACheckNpayCashReceiptReqResponseData> paResultHandler)  {
        payAppSv.checkNpayCashReceiptReq(data, paResultHandler);
    }

    /**
     * 등록결제(BILL) 등록
     **
     * @param data
     * @param paResultHandler
     */
    public void billRegister(PABillRegisterData data, PAResultHandler<PABillRegisterResponseData> paResultHandler) {
        payAppSv.billRegister(data, paResultHandler);
    }

    /**
     * 등록결제(BILL) 삭제
     **
     * @param data
     * @param paResultHandler
     */
    public void billDelete(PABillDeleteData data, PAResultHandler<PABillDeleteResponseData> paResultHandler) {
        payAppSv.billDelete(data, paResultHandler);
    }

    /**
     * 등록결제(BILL) 결제
     **
     * @param data
     * @param paResultHandler
     */
    public void billPayment(PABillPaymentData data, PAResultHandler<PABillPaymentResponseData> paResultHandler) {
        payAppSv.billPayment(data, paResultHandler);
    }

}
