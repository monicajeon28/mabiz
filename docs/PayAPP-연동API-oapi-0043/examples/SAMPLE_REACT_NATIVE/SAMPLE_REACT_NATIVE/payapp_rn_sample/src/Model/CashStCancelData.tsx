export class CashStCancelData {
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
   * 발행번호
   * 필수
   */
  cashstno?: String;
}
