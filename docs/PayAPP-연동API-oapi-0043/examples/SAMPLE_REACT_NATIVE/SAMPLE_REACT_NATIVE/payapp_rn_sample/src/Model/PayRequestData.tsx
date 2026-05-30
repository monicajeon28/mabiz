export class PayRequestData {
  /**
   * cmd
   * 필수
   */
  cmd?: String;

  /**
   * 판매자 회원 아이디
   * 필수
   */
  userid?: String;

  /**
   * 상품명
   * 필수
   */
  goodname?: String;

  /**
   * 결제요청 금액
   * 필수
   */
  price?: String;

  /**
   * 수신 휴대폰번호
   * 필수
   */
  recvphone?: String;

  /**
   * 메모
   */
  memo?: String;

  /**
   * 주소요청 (1?:요청, 0?:요청안함)
   */
  reqaddr?: String;

  /**
   * 결제완료 피드백 URL
   */
  feedbackurl?: String;

  /**
   * 임의 사용 변수 1
   */
  var1?: String;

  /**
   * 임의 사용 변수 2
   */
  var2?: String;

  /**
   * 결제요청 SMS 발송여부 (n?: SMS발송 안 함)
   */
  smsuse?: String;

  /**
   * 결제요청구분 (krw?:원화결제,usd?:달러결제)
   * ReqmodeType
   */
  reqmode?: String;

  /**
   * 국제전화 국가번호 (reqmode가 usd일 경우 필수)
   */
  vccode?: String;

  /**
   * 결제완료 후 이동할 링크 URL (매출전표 페이지에서 “확인” 버튼 클릭시 이동)
   */
  returnurl?: String;

  /**
   * 과세 공급가액
   * (price = amount_taxable + amount_taxfree + amount_vat)
   */
  amount_taxable?: String;

  /**
   * 면세 공급가액
   */
  amount_taxfree?: String;

  /**
   * 부가세
   */
  amount_vat?: String;

  /**
   * 결제수단 선택
   * 신용카드:card
   * 휴대전화:phone
   * 계좌이체:rbank
   * 가상계좌:vbank
   * 네이버페이:naverpay
   * 카카오페이:kakaopay
   * 스마일페이:smilepay
   * 애플페이:applepay
   * 페이코:payco
   * 위챗페이:wechat
   * 내통장결제:myaccount
   * 토스페이:tosspay
   *
   * 콤마(,) 구분으로 결제수단 선택이 가능합니다.
   * ex) phone,card 인 경우 휴대전화,신용카드 결제만 가능합니다.
   */
  openpaytype?: String;

  /**
   * feedbackurl 재시도 (y:재시도,n:재시도 안함)
   * feedbackurl의 응답값이 SUCCESS 가 아니면 feedbackurl 호출을 재시도 합니다. (총 10회 재시도)
   */
  checkretry?: String;

  /**
   * 수신 이메일 주소
   */
  recvemail?: String;

  /**
   * 매출전표 페이지 이동 여부 (y:매출전표 페이지 이동 안함)
   * returnurl 페이지로 페이지 이동 및 결제값 POST로 전달합니다.
   * ( 보안을 위해 결제완료 처리는 feedbackurl 페이지 에서 하셔야 합니다.)
   */
  skip_cstpage?: String;

  /**
   * 앱스키마
   */
  appurl?: String;

  /**
   * 부계정 아이디
   */
  subuserid?: String;

  /**
   * 구매자 아이디
   */
  buyerid?: String;
}
