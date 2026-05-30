export class CheckNpayCashReceiptReqData {
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
   * 결제요청번호
   * 필수
   */
  mul_no?: String;
}
