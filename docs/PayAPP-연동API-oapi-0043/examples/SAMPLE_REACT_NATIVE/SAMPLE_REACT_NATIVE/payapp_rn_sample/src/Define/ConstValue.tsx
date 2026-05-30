export const ConstValue = {
  // PAYAPP Store 
  PAYAPP_iOS_STORE: 'itms-apps://itunes.apple.com/app/538328034',
  PAYAPP_AOS_STORE: 'https://play.google.com/store/apps/details?id=com.udid.payapp',

  // 통신 성공 실패
  FAIL: '0',
  SUCCESS: '1',

  TRUE: '1',
  FALSE: '0',


  //**** AppToApp **** 
  /**
      1. ios -> SAMPLE_RN -> Info.plist -> URL Types에 등록
      2. AppDelegate  확인.
    */

  /**
   * AOS : App Link
   * iOS : Universal Link
   */
  DEEP_LINK: 'https://payapp.kr/sdk-app', 

  /**
   * 결과값을 리턴 받을 앱 스킴 
   */
  RETURN_URI: 'payappSampleRN://result',

  /**
   * 결과값을 리턴 받을 웹 주소 
   */
  FEEDBACK_URL: 'https://feedbackUrl.kr',
  
  // 원격 결제
  PAYAPP_REQUEST: 'payappRequest',

  // 카메라 결제
  PAYAPP_OCR_PAYMENT: 'payappOcrPayment',

  // 애플페이
  PAYAPP_APPLE_PAY_PAYMENT: 'payappApplePayPayment',

  // 수기 결제
  PAYAPP_NOTE_PAYMENT: 'payappNotePayment',

  // NFC 결제 (Android)
  PAYAPP_NFC_PAYMENT: 'payappNfcPayment',

  // 삼성 결제 (Android)
  PAYAPP_SAMSUNG_PAYMENT: 'payappSamsungPayment',

  // 정기 결제
  PAYAPP_FIXED_PERIOD_PAYMENT: 'payappFixedPeriodPayment',

  // 현금영수증
  PAYAPP_CASH_RECEIPT_PAYMENT: 'payappCashReceiptPayment',
  //**** AppToApp end **** 
 






  
  //**** OApi **** 
  MY_OAPI_SCHEME: 'payappOApiSampleRN',

  BASE_URL: 'https://api.payapp.kr/oapi/apiLoad.html',

  // 결제 요청
  CMD_PAY_REQUEST: 'payrequest',

  // 결제 취소
  CMD_PAY_CANCEL: 'paycancel',

  // 결제 취소 요청(결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우)
  CMD_PAY_CANCEL_REQ: 'paycancelreq',

  // 정기 결제 요청
  CMD_REBILL_REGIST: 'rebillRegist',

  // 정기 결제 해지
  CMD_REBILL_CANCEL: 'rebillCancel',

  // 정기 결제 일시 정지
  CMD_REBILL_STOP: 'rebillStop',

  // 정기 결제 승인
  CMD_REBILL_START: 'rebillStart',

  // 판매자 회원가입
  CMD_SELLER_REGIST: 'sellerRegist',

  // 판매자 아이디 중복 체크
  CMD_USER_ID_CHECK: 'useridCheck',

  // 부계정 등록
  CMD_SUB_ID_REGIST: 'subidregist',

  // 현금영수증 발행
  CMD_CASH_ST_REGIST: 'cashStRegist',

  // 현금영수증 발행 취소
  CMD_CASH_ST_CANCEL: 'cashStCancel',

  // 네이버페이 현금 영수증 발행 대상 금액 조회
  CMD_CHECK_NPAY_CASH_RECEIPT_REQ: 'checkNpayCashReceiptReq',

  // 결제회원(BILL) 등록
  CMD_BILL_REGISTER: 'billRegist',

  // 결제회원(BILL) 삭제
  CMD_BILL_DELETE: 'billDelete',

  // 결제회원(BILL) 결제
  CMD_BILL_PAYMENT: 'billPay',

  //**** OApi end **** 
};
