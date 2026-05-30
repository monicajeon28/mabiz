//
//  PABillRegisterData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by 조상현 on 2022/09/26.
//

import ObjectMapper

class PABillRegisterData: Mappable {
 
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
     * 카드번호
     * 필수
     */
    var cardNo:String?

    /**
     * 카드 유효기간(월)
     * 필수
     */
    var expMonth:String?
    
    /**
     * 카드 유효기간(년)
     * 필수
     */
    var expYear:String?

    /**
     * 구매자확인 개인:생년월일(YYMMDD) 6자리 , 사업자번호
     * 필수
     */
    var buyerAuthNo:String?
    
    /**
     * 카드 비밀번호 앞 두자리
     * 필수
     */
    var cardPw:String?

    /**
     * 구매자 전화번호
     * 필수
     */
    var buyerPhone:String?
    
    /**
     * 구매자 성함
     * 필수
     */
    var buyerName:String?

    /**
     * 구매자 아이디
     */
    var buyerId:String?
    
    required init?(map: Map){}
    init() {
    }
    
    func mapping(map: Map) {
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        cardNo                          <- map["cardNo"]
        expMonth                        <- map["expMonth"]
        expYear                         <- map["expYear"]
        buyerAuthNo                     <- map["buyerAuthNo"]
        cardPw                          <- map["cardPw"]
        buyerPhone                      <- map["buyerPhone"]
        buyerName                       <- map["buyerName"]
        buyerId                         <- map["buyerId"]
    }
    
}
