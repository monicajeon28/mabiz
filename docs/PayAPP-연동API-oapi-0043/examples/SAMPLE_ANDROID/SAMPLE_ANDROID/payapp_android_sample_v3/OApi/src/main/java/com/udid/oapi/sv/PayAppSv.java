package com.udid.oapi.sv;


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
import com.udid.oapi.sv.handler.PAResultHandler;

/**
 * Create by 김진원
 */
public interface PayAppSv {

    // 결제 요청
    void payRequest(PAPayRequestData data, PAResultHandler<PAPayRequestResponseData> PAResultHandler);

    // 결제(요청,승인)취소
    void payCancel(PAPayCancelData data, PAResultHandler<PAPayCancelResponseData> paResultHandler);

    // 결제요청취소
    void payCancelReq(PAPayCancelReqData data, PAResultHandler<PAPayCancelReqResponseData> paResultHandler);

    // 정기 결제 요청
    void rebillRegist(PARebillRegistData data, PAResultHandler<PARebillRegistResponseData> paResultHandler);

    // 정기 결제 해지
    void rebillCancel(PARebillCancelData data, PAResultHandler<PARebillCancelResponseData> paResultHandler);

    // 정기 결제 일시정지
    void rebillStop(PARebillStopData data, PAResultHandler<PARebillStopResponseData> paResultHandler);

    // 정기 결제 승인
    void rebillStart(PARebillStartData data, PAResultHandler<PARebillStartResponseData> paResultHandler);

    // 판매자 회원 가입
    void sellerRegist(PASellerRegistData data, PAResultHandler<PASellerRegistResponseData> paResultHandler);

    // 판매자 회원 아이디 중복 체크
    void useridCheck(PAUseridCheckData data, PAResultHandler<PAUseridCheckResponseData> paResultHandler);

    // 부계정 등록
    void subidRegist(PASubidRegistData data, PAResultHandler<PASubidRegistResponseData> paResultHandler);

    // 현금영수증 발행
    void cashStRegist(PACashStRegistData data, PAResultHandler<PACashStResponseData> paResultHandler);

    // 현금영수증 발행 취소
    void cashStCancel(PACashStCancelData data, PAResultHandler<PACashStCnResponseData> paResultHandler);

    // 네이버페이 현금영수증 발행대상 금액조회
    void checkNpayCashReceiptReq(PACheckNpayCashReceiptReqData data, PAResultHandler<PACheckNpayCashReceiptReqResponseData> paResultHandler);

    // 등록결제(BILL) 등록
    void billRegister(PABillRegisterData data, PAResultHandler<PABillRegisterResponseData> paResultHandler);

    // 등록결제(BILL) 삭제
    void billDelete(PABillDeleteData data, PAResultHandler<PABillDeleteResponseData> paResultHandler);

    // 등록결제(BILL) 결제
    void billPayment(PABillPaymentData data, PAResultHandler<PABillPaymentResponseData> paResultHandler);

}
