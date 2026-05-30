export class CashStRegistData {
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
   * 상품명
   * 필수
   */
  good_name?: String;

  /**
   * 구매자명
   * 필수
   */
  buyr_name?: String;

  /**
   * 휴대폰번호 또는 사업자번호
   * 필수
   */
  id_info?: String;

  /**
   * 원거래시각
   * 필수
   */
  trad_time?: String;

  /**
   * 발행용도(0?:소득공제용, 1?:지출증빙용)
   * 필수
   */
  tr_code?: String;

  /**
   * 거래금액
   * 필수
   */
  amt_tot?: String;

  /**
   * 공급가액
   * 필수
   */
  amt_sup?: String;

  /**
   * 봉사료
   * 필수
   */
  amt_svc?: String;

  /**
   * 부가가치세
   * 필수
   */
  amt_tax?: String;

  /**
   * 과세?:TG01, 면세?:TG02
   * 필수
   */
  corp_tax_type?: String;

  /**
   * 구매자 휴대폰
   */
  buyr_tel1?: String;

  /**
   * 구매자 이메일
   */
  buyr_mail?: String;
}
