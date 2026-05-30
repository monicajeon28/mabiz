//
//  PARebillRegistData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PARebillRegistData: Mappable {

    /**
    * cmd
    * 필수
    */
    var cmd:String?
    
    /**
     * 판매자 회원 아이디
     * 필수
     */
    var userid:String?

    /**
     * 상품명
     * 필수
     */
    var goodname:String?

    /**
     * 정기 결제 요청 금액
     * 필수
     */
    var goodprice:String?

    /**
     * 수신 휴대전화 번호
     * 필수
     */
    var recvphone:String?

    /**
     * 정기결제 주기 구분(Month, Week, Day)
     * 필수
     */
    var rebillCycleType:String?

    /**
     * 정기결제 만료일 (yyyy-mm-dd)
     * 필수
     */
    var rebillExpire:String?

    /**
     * 수신 이메일
     */
    var recvemail:String?

    /**
     * 정기 결제 요청 메모
     */
    var memo:String?

    /**
     * 이용료 부담
     */
    var addcomm:String?

    /**
     * 월 정기결제 결제일 (1~31,90:말일)
     */
    var rebillCycleMonth:String?

    /**
     * 주 정기결제 결제요일 (1 ~ 7) 1:월요일 ~ 7:일요일
     */
    var rebillCycleWeek:String?

    /**
     * 결제완료 피드백 URL
     */
    var feedbackurl:String?

    /**
     * 정기결제요청 SMS발송여부 (n:발송안함)
     */
    var smsuse:String?

    /**
     * 결제완료 후 이동할 링크 URL (매출전표 페이지에서 “확인”버튼 클릭시 이동)
     */
    var returnurl:String?

    /**
     * 결제 가능 수단 (신용카드:card, 휴대전화:phone)
     */
    var openpaytype:String?
    
    required init?(map: Map){}
    init(userid:String, goodname:String, goodprice:String, recvphone:String, rebillCycleType:String, rebillExpire:String){
        self.userid = userid
        self.goodname = goodname
        self.goodprice = goodprice
        self.recvphone = recvphone
        self.rebillCycleType = rebillCycleType
        self.rebillExpire = rebillExpire
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        goodname                        <- map["goodname"]
        goodprice                       <- map["goodprice"]
        recvphone                       <- map["recvphone"]
        rebillCycleType                 <- map["rebillCycleType"]
        rebillExpire                    <- map["rebillExpire"]
        recvemail                       <- map["recvemail"]
        memo                            <- map["memo"]
        addcomm                         <- map["addcomm"]
        rebillCycleMonth                <- map["rebillCycleMonth"]
        rebillCycleWeek                 <- map["rebillCycleWeek"]
        feedbackurl                     <- map["feedbackurl"]
        smsuse                          <- map["smsuse"]
        returnurl                       <- map["returnurl"]
        openpaytype                     <- map["openpaytype"]
    }
    
}
