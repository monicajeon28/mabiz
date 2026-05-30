//
//  PABillRegister.swift
//  Payapp_iOS_Sample_V2
//
//  Created by 조상현 on 2022/09/26.
//

import ObjectMapper

class PABillPaymentData: Mappable {
 
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
     * 결제회원 연동키
     * 필수
     */
    var encBill:String?

    /**
     * 상품명
     * 필수
     */
    var goodname:String?
    
    /**
     * 상품가격
     * 필수
     */
    var price:String?

    /**
     * 수신 휴대폰번호
     * 필수
     */
    var recvphone:String?

    
    /**
     * 공급가액
     */
    var amount_taxable:String?

    /**
     * 면세금액
     */
    var amount_taxfree:String?
    
    /**
     * 부가세
     */
    var amount_vat:String?

    /**
     * 결제완료 후 결과값을 리턴받을 고객사 URL 응답내용은 결제 요청 API Part1 참조
     */
    var feedbackurl:String?

    /**
     * feedbackurl 재시도 (y:재시도,n:재시도 안함 feedbackurl의 응답값이 SUCCESS 가 아니면
     * feedbackurl 호출을 재시도 합니다. (총 10회 재시도)
     */
    var checkretry:String?

    /**
     * 카드할부 개월 수 ('00','01','02'....) 50,000원 이상부터 할부 가능
     */
    var cardinst:String?
    
    required init?(map: Map){}
    init() {
    }
    
    func mapping(map: Map) {
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        encBill                         <- map["encBill"]
        goodname                        <- map["goodname"]
        price                           <- map["price"]
        recvphone                       <- map["recvphone"]
        feedbackurl                     <- map["feedbackurl"]
        amount_taxable                  <- map["amount_taxable"]
        amount_taxfree                  <- map["amount_taxfree"]
        amount_vat                      <- map["amount_vat"]
        checkretry                      <- map["checkretry"]
        cardinst                        <- map["cardinst"]
    }
    
}
