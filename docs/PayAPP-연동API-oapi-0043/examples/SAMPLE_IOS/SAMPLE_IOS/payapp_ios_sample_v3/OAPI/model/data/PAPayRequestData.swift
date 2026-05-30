//
//  PAPayRequestData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PAPayRequestData: Mappable {
 
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
     * 결제요청 금액
     * 필수
     */
    var price:String?

    /**
     * 수신 휴대폰번호
     * 필수
     */
    var recvphone:String?

    /**
     * 메모
     */
    var memo:String?

    /**
     * 주소요청 (1:요청, 0:요청안함)
     */
    var reqaddr:String?

    /**
     * 결제완료 피드백 URL
     */
    var feedbackurl:String?

    /**
     * 결제요청 SMS 발송여부 (n: SMS발송 안 함)
     */
    var smsuse:String?

    /**
     * 결제요청구분 (krw:원화결제,usd:달러결제)
     * ReqmodeType
     */
    var reqmode:String?

    /**
     * 국제전화 국가번호 (reqmode가 usd일 경우 필수)
     */
    var vccode:String?

    /**
     * 결제완료 후 이동할 링크 URL (매출전표 페이지에서 “확인” 버튼 클릭시 이동)
     */
    var returnurl:String?

    /**
     * 과세 공급가액
     * (price = amount_taxable + amount_taxfree + amount_vat)
     */
    var amount_taxable:String?

    /**
     * 면세 공급가액
     */
    var amount_taxfree:String?

    /**
     * 부가세
     */
    var amount_vat:String?

    /**
     * 결제수단 선택
     * 신용카드:card
     * 휴대전화:phone
     * 계좌이체:rbank
     * 가상계좌:vbank
     * 네이버페이:naverpay
     * 카카오페이:kakaopay
     * 스마일페이:smilepay
     * 애플페이:applepay
     * 페이코:payco
     * 위챗페이:wechat
     * 내통장결제:myaccount
     * 토스페이:tosspay
     *
     * 콤마(,) 구분으로 결제수단 선택이 가능합니다.
     * ex) phone,card 인 경우 휴대전화,신용카드 결제만 가능합니다."
     */
    var openpaytype:String?

    /**
     * feedbackurl 재시도 (y:재시도,n:재시도 안함)
     * feedbackurl의 응답값이 SUCCESS 가 아니면 feedbackurl 호출을 재시도 합니다. (총 10회 재시도)
     */
    var checkretry:String?

    /**
     * 수신 이메일 주소
     */
    var recvemail:String?

    /**
     * 매출전표 페이지 이동 여부 (y:매출전표 페이지 이동 안함)
     * returnurl 페이지로 페이지 이동 및 결제값 POST로 전달합니다.
     * ( 보안을 위해 결제완료 처리는 feedbackurl 페이지 에서 하셔야 합니다. )
     */
    var skip_cstpage:String?

    /**
     * 앱스키마
     */
    var appurl:String?

    /**
     * 부계정 아이디
     */
    var subuserid:String?

    /**
     * 구매자 아이디
     */
    var buyerid:String?
    
    required init?(map: Map){}
    init(userid:String, goodname:String, price:String, recvphone:String){
        
        self.userid = userid
        self.goodname = goodname
        self.price = price
        self.recvphone = recvphone
        
    }
    
    func mapping(map: Map) {        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        goodname                        <- map["goodname"]
        price                           <- map["price"]
        recvphone                       <- map["recvphone"]
        memo                            <- map["memo"]
        reqaddr                         <- map["reqaddr"]
        feedbackurl                     <- map["feedbackurl"]
        smsuse                          <- map["smsuse"]
        reqmode                         <- map["reqmode"]
        vccode                          <- map["vccode"]
        returnurl                       <- map["returnurl"]
        amount_taxable                  <- map["amount_taxable"]
        amount_taxfree                  <- map["amount_taxfree"]
        amount_vat                      <- map["amount_vat"]
        openpaytype                     <- map["openpaytype"]
        checkretry                      <- map["checkretry"]
        recvemail                       <- map["recvemail"]
        skip_cstpage                    <- map["skip_cstpage"]
        appurl                          <- map["appurl"]
        subuserid                       <- map["subuserid"]
        buyerid                         <- map["buyerid"]
    }
    
}
