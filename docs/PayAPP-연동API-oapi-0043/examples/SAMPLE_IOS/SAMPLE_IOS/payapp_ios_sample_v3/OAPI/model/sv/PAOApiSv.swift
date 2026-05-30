//
//  PAOApiSv.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import UIKit

class PAOApiSv: NSObject {
    
    let httpRequestManager = HttpRequestManager();
    
    // 결제 요청
    func payRequest(data:PAPayRequestData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_PAY_REQUEST
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 결제(요청, 승인) 취소
    func payCancel(data:PAPayCancelData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_PAY_CANCEL        
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 결제 취소 요청
    func paycancelreq(data:PAPayCancelReqData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_PAY_CANCEL_REQ
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 정기 결제 요청
    func rebillRegist(data:PARebillRegistData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_REBILL_REGIST
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 정기 결제 해지
    func rebillCancel(data:PARebillCancelData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_REBILL_CANCEL
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 정기 결제 일시 정지
    func rebillStop(data:PARebillStopData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_REBILL_STOP
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 정기 결제 승인
    func rebillStart(data:PARebillStartData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_REBILL_START
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 판매자 회원 가입
    func sellerRegist(data:PASellerRegistData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_SELLER_REGIST
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 판매자 아이디 중복 체크
    func useridCheck(data:PAUseridCheckData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_USER_ID_CHECK
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 부계정 등록
    func subidRegist(data:PASubidRegistData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_SUB_ID_REGIST
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 현금영수증 발행
    func cashStRegist(data:PACashStRegistData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_CASH_ST_REGIST
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 현금영수증 발행 취소
    func cashStCancel(data:PACashStCancelData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_CASH_ST_CANCEL
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 네이버페이 현금 영수증 발행 대상 금액 조회
    func checkNpayCashReceiptReq(data:PACheckNpayCashReceiptReqData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_CHECK_NPAY_CASH_RECEIPT_REQ
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 결제회원(BILL) 등록
    func billRegister(data:PABillRegisterData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_BILL_REGISTER
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 결제회원(BILL) 삭제
    func billDelete(data:PABillDeleteData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_BILL_DELETE
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
    
    // 결제회원(BILL) 결제
    func billPayment(data:PABillPaymentData, handler: @escaping (_ result:Any) -> Void) {
         
        data.cmd = ConstValue.CMD_BILL_PAYMENT
        httpRequestManager.WebRequest(params: data.toJSON() as [String : AnyObject], handler:handler)
    }
}
