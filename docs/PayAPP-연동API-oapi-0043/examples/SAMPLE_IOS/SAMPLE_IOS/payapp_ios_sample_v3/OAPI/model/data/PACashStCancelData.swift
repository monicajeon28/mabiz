//
//  PACashStCnData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PACashStCancelData: Mappable {

    
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
     * 발행번호
     * 필수
     */
    var cashstno:String?
    required init?(map: Map){}
    init(userid: String, linkkey: String, cashstno: String) {
        self.userid = userid
        self.linkkey = linkkey
        self.cashstno = cashstno
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        linkkey                         <- map["linkkey"]
        cashstno                        <- map["cashstno"]
    }
    
    
}
