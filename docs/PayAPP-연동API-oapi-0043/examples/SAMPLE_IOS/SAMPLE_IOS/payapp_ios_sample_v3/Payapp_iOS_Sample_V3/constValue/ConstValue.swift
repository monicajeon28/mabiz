//
//  ConstValue.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/23.
//

import UIKit

class ConstValue: NSObject {
    
    static let FALSE_STR = "0"
    static let TRUE_STR = "1"
    
    static let PAYAPP_UNIVERSAL_LINK = "https://payapp.kr/sdk-app"
    
    static let RETURN_URI = "payappSampleV3://payment.result"
    
    static let NOTIFICATION_RESULT = "NOTIFICATION_RESULT"
    
    // MARK:- OApi
    static let OAPI_SCHEME: String = "payappOApiSampleV3"
    
    static let BASE_URL = "https://api.payapp.kr/oapi/apiLoad.html"
     
    // 결제 요청
    static let CMD_PAY_REQUEST = "payrequest"

    // 결제 취소
    static let CMD_PAY_CANCEL = "paycancel"

    // 결제 취소 요청(결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우)
    static let CMD_PAY_CANCEL_REQ = "paycancelreq"

    // 정기 결제 요청
    static let CMD_REBILL_REGIST = "rebillRegist"

    // 정기 결제 해지
    static let CMD_REBILL_CANCEL = "rebillCancel"

    // 정기 결제 일시 정지
    static let CMD_REBILL_STOP = "rebillStop"

    // 정기 결제 승인
    static let CMD_REBILL_START = "rebillStart"

    // 판매자 회원가입
    static let CMD_SELLER_REGIST = "sellerRegist"

    // 판매자 아이디 중복 체크
    static let CMD_USER_ID_CHECK = "useridCheck"

    // 부계정 등록
    static let CMD_SUB_ID_REGIST = "subidregist"

    // 현금영수증 발행
    static let CMD_CASH_ST_REGIST = "cashStRegist"

    // 현금영수증 발행 취소
    static let CMD_CASH_ST_CANCEL = "cashStCancel"

    // 네이버페이 현금 영수증 발행 대상 금액 조회
    static let CMD_CHECK_NPAY_CASH_RECEIPT_REQ = "checkNpayCashReceiptReq"
    
    // 결제회원(BILL) 등록
    static let CMD_BILL_REGISTER = "billRegist"
    
    // 결제회원(BILL) 삭제
    static let CMD_BILL_DELETE = "billDelete"
    
    // 결제회원(BILL) 결제
    static let CMD_BILL_PAYMENT = "billPay"
}
