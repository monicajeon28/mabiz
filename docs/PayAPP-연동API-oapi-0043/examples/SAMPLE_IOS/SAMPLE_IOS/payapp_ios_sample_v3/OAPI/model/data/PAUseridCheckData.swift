//
//  PAUseridCheckData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PAUseridCheckData: Mappable {

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
     * 대리점 또는 리셀러 아이디
     * 필수
     */
    var resellerid:String?
    
    required init?(map: Map){}
    
    init(userid:String, resellerid:String){
        self.userid = userid
        self.resellerid = resellerid
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        resellerid                      <- map["resellerid"]
       
    }
}
