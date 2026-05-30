//
//  PAReqType.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/22.
//

import UIKit

enum PAReqType: String {

    case REMOTE = "REMOTE"                                      // 원격결제
    case OCR = "OCR"                                            // 카메라결제
    case MANUAL = "MANUAL"                                      // 수기결제

    case NAVER_PAY = "NAVER_PAY"                                // 네이버페이
    case KAKAO_PAY = "KAKAO_PAY"                                // 카카오페이
    case SMILE_PAY = "SMILE_PAY"                                // 스마일페이

    case APPLE_PAY = "APPLE_PAY"                                // 애플페이
    case PAYCO = "PAYCO"                                        // 페이코
    case WECHAT_PAY = "WECHAT_PAY"                              // 위챗페이

    case MY_ACCOUNT = "MY_ACCOUNT"                              // 내통장결제
    case TOSS_PAY = "TOSS_PAY"                                  // 토스페이
    case QR = "QR"                                              // QR

    case CASH_RECEIPT = "CASH_RECEIPT"                          // 현금 영수증
    case CASH_RECEIPT_CANCEL = "CASH_RECEIPT_CANCEL"            // 현금 영수증 취소
    
}
