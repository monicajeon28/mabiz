export class SellerRegistData {
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
   * 판매자 회원 비밀번호 (영문,숫자 8자리)
   * 필수
   */
  userpwd?: String;

  /**
   * 판매자명
   * 필수
   */
  sellername?: String;

  /**
   * 판매자 휴대전화번호
   * 필수
   */
  phone?: String;

  /**
   * 이메일
   * 필수
   */
  email?: String;

  /**
   * 서비스 구분
   * 필수
   */
  bizkind?: String;

  /**
   * 판매자 구분 (개인?:1, 사업자?:2)
   * 필수
   */
  usertype?: String;

  /**
   * 대리점 또는 리셀러 아이디
   * 필수
   */
  resellerid?: String;

  /**
   * 가입형태 (유료?:0, 할인?:4), 리셀러 회원 가입은 유료형
   * 필수
   */
  join_type?: String;

  /**
   * 가입구분 (seller,reseller)
   * 필수
   */
  seller_type?: String;

  /**
   * (사업자 필수) 사업자등록번호
   */
  compregno?: String;

  /**
   * (사업자 필수) 상호명(법인명)
   */
  compname?: String;

  /**
   * (사업자 필수) 업태
   */
  biztype1?: String;

  /**
   * (사업자 필수) 업종
   */
  biztype2?: String;

  /**
   * 주소-우편번호
   */
  zipcode?: String;

  /**
   * 주소1
   */
  addr1?: String;

  /**
   * 주소2
   */
  addr2?: String;

  /**
   * 홈페이지
   */
  homepage?: String;

  /**
   * 정산은행
   */
  compbank?: String;

  /**
   * 정산은행 계좌번호
   */
  compbanknum?: String;

  /**
   * 정산은행 예금주
   */
  compbankname?: String;

  /**
   * (개인 필수) 이름
   */
  username?: String;

  /**
   * (사업자 필수) 대표자 성함
   */
  ceo_nm?: String;
  /**
   * 공통 통보 URL
   */
  common_feedbackurl?: String;

  /**
   * 사업자 구분 (1?:법인,2?:개인)
   */
  corp_type?: String;
}
