export class PayCancelReqData {
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
   * 연동 KEY
   * 필수
   */
  linkkey?: String;

  /**
   * 결제요청번호
   * 필수
   */
  mul_no?: String;

  /**
   * 결제요청취소 메모
   * 필수
   */
  cancelmemo?: String;

  /**
   * 입금자명
   */
  dpname?: String;

  /**
   * 결제요청취소 구분 (0?:전체취소,1?:부분취소)
   */
  partcancel?: String;

  /**
   * 결제요청취소 금액 (부분취소인 경우 필수)
   */
  cancelprice?: String;

  /**
   * 결제요청취소 과세 공급가액
   * ( partcancel = cancel_taxable + cancel_taxfree + cancel_vat )
   */
  cancel_taxable?: String;

  /**
   * 결제요청취소 면세 공급가액
   */
  cancel_taxfree?: String;

  /**
   * 결제요청취소 부가세
   */
  cancel_vat?: String;
}
