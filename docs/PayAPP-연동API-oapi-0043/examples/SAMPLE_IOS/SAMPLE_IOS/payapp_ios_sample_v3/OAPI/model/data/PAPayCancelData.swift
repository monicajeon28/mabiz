//
//  PAPayCancelData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PAPayCancelData: Mappable {
    
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
     * 연동 KEY
     * 필수
     */
    var linkkey:String?

    /**
     * 결제요청번호
     * 필수
     */
    var mul_no:String?

    /**
     * 결제요청취소 메모
     */
    var cancelmemo:String?

    /**
     * 결제요청취소 모드
     * (값이 ready 인 경우 결제요청 상태만 취소 가능)
     */
    var cancelmode:String?

    /**
     * 결제요청취소 구분 (0:전취소, 1:부분취소)
     */
    var partcancel:String?

    /**
     * 결제요청취소 금액 (부분취소인 경우 필수)
     */
    var cancelprice:String?

    /**
     * 결제요청취소 과세 공급가액
     * (cancelprice = cancel_taxable + cancel_taxfree + cancel_vat)
     */
    var cancel_taxable:String?

    /**
     * 결제요청취소 면세 공급가액
     */
    var cancel_taxfree:String?

    /**
     * 결제요청취소 부가세
     */
    var cancel_vat:String?
    
    required init?(map: Map){}
    init(userid: String, linkkey: String, mul_no: String, cancelmemo: String) {
        
        self.userid = userid
        self.linkkey = linkkey
        self.mul_no = mul_no
        self.cancelmemo = cancelmemo
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        linkkey                         <- map["linkkey"]
        mul_no                          <- map["mul_no"]
        cancelmemo                      <- map["cancelmemo"]
        cancelmode                      <- map["cancelmode"]
        partcancel                      <- map["partcancel"]
        cancelprice                     <- map["cancelprice"]
        cancel_taxable                  <- map["cancel_taxable"]
        cancel_taxfree                  <- map["cancel_taxfree"]
        cancel_vat                      <- map["cancel_vat"]
        
    }
}
