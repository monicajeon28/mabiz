export class BillRegisterData {
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
     * 카드번호
     * 필수
     */
    cardNo?: String;

    /**
    * 카드 유효기간(월)
    * 필수
    */
    expMonth?: String;
    
    /**
    * 카드 유효기간(년)
    * 필수
    */
    expYear?: String;

    /**
    * 구매자확인 개인:생년월일(YYMMDD) 6자리 , 사업자번호
    * 필수
    */
    buyerAuthNo?: String;

    /**
    * 카드 비밀번호 앞 두자리
    * 필수
    */
    cardPw?: String;

    /**
    * 구매자 전화번호
    * 필수
    */
    buyerPhone?: String;

    /**
    * 구매자 성함
    * 필수
    */
    buyerName?: String;

    /**
    * 구매자 아이디 
    */
    buyerId?: String;
}
