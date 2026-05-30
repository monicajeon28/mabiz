export class BillPaymentData {
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
     * 결제회원 연동키
     * 필수
     */
    encBill?: String;

    /**
    * 상품명
    * 필수
    */
    goodname?: String;

    /**
    * 상품가격
    * 필수
    */
    price?: String;

    /**
    * 구매자 전화번호
    * 필수
    */
    recvphone?: String;

    /**
    * 공급가액
    */
    amount_taxable?: String;

    /**
    * 면세금액
    */
    amount_taxfree?: String;

    /**
    * 부가세
    */
    amount_vat?: String;

    /**
    * 결제완료 후 결과값을 리턴받을 고객사 URL 응답내용은 결제 요청 API Part1 참조
    */
    feedbackurl?: String;

    /**
    * 사용자 임의 변수 1
    */
    var1?: String;

    /**
    * 사용자 임의 변수 2
    */
    var2?: String;

    /**
    * feedbackurl 재시도 (y:재시도,n:재시도 안함) feedbackurl의 응답값이 SUCCESS 가 아니면 feedbackurl 호출을 재시도 합니다. (총 10회 재시도)
    */
    checkretry?: String;

    /**
    * 카드할부 개월 수 ('00','01','02'....) 50,000원 이상부터 할부 가능
    */
    cardinst?: String;
}
