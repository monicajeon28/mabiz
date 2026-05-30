export class RebillStopData {
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
   * 정기결제요청 등록번호
   * 필수
   */
  rebill_no?: String;

  /**
   * 연동 KEY
   * 필수
   */
  linkkey?: String;
}
