package com.udid.oapi;

/**
 * Create by 김진원
 */
public class PAOAPIConstValue {

    // TAG
    public final static String TAG = "PayappOAPI";

    // 페이앱 앱 링크 주소
    public final static String PAYAPP_APP_LINK = "https://payapp.kr/sdk-app";

    // 링크 키
    public final static String LINK_KEY_URL = "https://seller.payapp.kr/c/apiconnect_info";

    // 호출  URL
    public final static String BASE_URL = "https://api.payapp.kr/oapi/apiLoad.html";

    // 결제 요청
    public final static String CMD_PAY_REQUEST = "payrequest";

    // 결제 취소
    public final static String CMD_PAY_CANCEL = "paycancel";

    // 결제 취소 요청(결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우)
    public final static String CMD_PAY_CANCEL_REQ = "paycancelreq";

    // 정기 결제 요청
    public final static String CMD_REBILL_REGIST = "rebillRegist";

    // 정기 결제 해지
    public final static String CMD_REBILL_CANCEL = "rebillCancel";

    // 정기 결제 일시 정지
    public final static String CMD_REBILL_STOP = "rebillStop";

    // 정기 결제 승인
    public final static String CMD_REBILL_START = "rebillStart";

    // 판매자 회원가입
    public final static String CMD_SELLER_REGIST = "sellerRegist";

    // 판매자 아이디 중복 체크
    public final static String CMD_USER_ID_CHECK = "useridCheck";

    // 부계정 등록
    public final static String CMD_SUB_ID_REGIST = "subidregist";

    // 현금영수증 발행
    public final static String CMD_CASH_ST_REGIST = "cashStRegist";

    // 현금영수증 발행 취소
    public final static String CMD_CASH_ST_CANCEL = "cashStCancel";

    // 네이버페이 현금 영수증 발행 대상 금액 조회
    public final static String CMD_CHECK_NPAY_CASH_RECEIPT_REQ = "checkNpayCashReceiptReq";

    // 등록결제(BILL) 등록
    public final static String CMD_BILL_REGISTER = "billRegist";

    // 등록결제(BILL) 삭제
    public final static String CMD_BILL_DELETE = "billDelete";

    // 등록결제(BILL) 결제
    public final static String CMD_BILL_PAYMENT = "billPay";

}
