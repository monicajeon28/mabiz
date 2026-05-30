export class RebillRegistData {

    /**
    * cmd
    * 필수
    */
      cmd?:String;
    
     /**
      * 판매자 회원 아이디
      * 필수
      */
      userid?:String;
 
     /**
      * 상품명
      * 필수
      */
      goodname?:String;
 
     /**
      * 정기 결제 요청 금액
      * 필수
      */
      goodprice?:String;
 
     /**
      * 수신 휴대전화 번호
      * 필수
      */
      recvphone?:String;
 
     /**
      * 정기결제 주기 구분(Month, Week, Day)
      * 필수
      */
      rebillCycleType?:String;
 
     /**
      * 정기결제 만료일 (yyyy-mm-dd)
      * 필수
      */
      rebillExpire?:String;
 
     /**
      * 수신 이메일
      */
      recvemail?:String;
 
     /**
      * 정기 결제 요청 메모
      */
      memo?:String;
 
     /**
      * 이용료 부담
      */
      addcomm?:String;
 
     /**
      * 월 정기결제 결제일 (1~31,90?:말일)
      */
      rebillCycleMonth?:String;
 
     /**
      * 주 정기결제 결제요일 (1 ~ 7) 1?:월요일 ~ 7?:일요일
      */
      rebillCycleWeek?:String;
 
     /**
      * 결제완료 피드백 URL
      */
      feedbackurl?:String;
 
     /**
      * 임의 변수1
      */
      var1?:String;
 
     /**
      * 임의 변수 2
      */
      var2?:String;
 
     /**
      * 정기결제요청 SMS발송여부 (n?:발송안함)
      */
      smsuse?:String;
 
     /**
      * 결제완료 후 이동할 링크 URL (매출전표 페이지에서 “확인”버튼 클릭시 이동)
      */
      returnurl?:String;
 
     /**
      * 결제 가능 수단 (신용카드?:card, 휴대전화?:phone)
      */
      openpaytype?:String;
}