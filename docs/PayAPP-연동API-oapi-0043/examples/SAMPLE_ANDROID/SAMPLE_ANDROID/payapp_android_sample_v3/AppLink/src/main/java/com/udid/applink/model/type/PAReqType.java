package com.udid.applink.model.type;

/**
 * Create by 김진원
 */
public enum PAReqType {

    REMOTE("REMOTE"),                                   // 원격결제
    OCR("OCR"),                                         // 카메라결제
    MANUAL("MANUAL"),                                   // 수기결제
    NAVER_PAY("NAVER_PAY"),                             // 네이버페이
    KAKAO_PAY("KAKAO_PAY"),                             // 카카오페이
    SMILE_PAY("SMILE_PAY"),                             // 스마일페이
    APPLE_PAY("APPLE_PAY"),                             // 애플페이
    PAYCO("PAYCO"),                                     // 페이코
    WECHAT_PAY("WECHAT_PAY"),                           // 위챗페이
    MY_ACCOUNT("MY_ACCOUNT"),                           // 내통장결제
    TOSS_PAY("TOSS_PAY"),                               // 토스페이
    QR("QR"),                                           // QR
    NFC("NFC"),                                         // NFC
    SAMSUNG("SAMSUNG"),                                 // 삼성페이
    CASH_RECEIPT("CASH_RECEIPT"),                       // 현금영수증 발행
    CASH_RECEIPT_CANCEL("CASH_RECEIPT_CANCEL")          // 현금영수증 취소
    ;

    /**
     * 프로퍼티명
     */
    private String val;

    PAReqType(String val)
    {
        this.val = val;
    }

    public String getVal ()
    {
        return val;
    }
}
