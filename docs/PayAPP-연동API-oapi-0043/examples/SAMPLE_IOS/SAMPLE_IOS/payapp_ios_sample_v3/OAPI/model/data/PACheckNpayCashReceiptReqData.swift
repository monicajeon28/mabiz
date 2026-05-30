//
//  PACheckNpayCashReceiptReqData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PACheckNpayCashReceiptReqData: Mappable {
    
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
     * 결제요청번호
     * 필수
     */
    var mul_no:String?
    
    required init?(map: Map){}
    init(userid:String, mul_no:String){
        
        self.userid = userid
        self.mul_no = mul_no
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        mul_no                          <- map["mul_no"]

    }
    
}
