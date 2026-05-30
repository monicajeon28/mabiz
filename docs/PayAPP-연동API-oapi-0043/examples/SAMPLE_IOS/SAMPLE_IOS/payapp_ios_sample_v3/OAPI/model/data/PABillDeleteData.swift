//
//  PABillDeleteData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by 조상현 on 2022/09/26.
//

import ObjectMapper

class PABillDeleteData: Mappable {
 
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
    
    required init?(map: Map){}
    init() {
    }
    
    func mapping(map: Map) {
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        encBill                         <- map["encBill"]
    }
    
}
