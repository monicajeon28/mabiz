export class SubidRegistData {
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
   * 부계정 아이디
   * 필수
   */
  subuserid?: String;

  /**
   * 부계정 비밀번호
   * 필수
   */
  subpwd?: String;

  /**
   * 부계정명
   * 필수
   */
  subname?: String;

  /**
   * 대분류
   */
  subetc1?: String;

  /**
   * 중분류
   */
  subetc2?: String;

  /**
   * 소분류
   */
  subetc3?: String;

  /**
   * 직급
   */
  subjtype?: String;

  /**
   * 권한
   */
  state?: String;
}
