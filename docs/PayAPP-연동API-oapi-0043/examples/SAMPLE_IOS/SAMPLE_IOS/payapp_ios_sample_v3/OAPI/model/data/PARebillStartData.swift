//
//  PARebillStartData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PARebillStartData: Mappable {
    
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
     * 정기결제요청 등록번호
     * 필수
     */
    var rebill_no:String?

    /**
     * 연동 KEY
     * 필수
     */
    var linkkey:String?
    
    required init?(map: Map){}
    init(userid:String, rebill_no:String, linkkey:String){
        self.userid = userid
        self.rebill_no = rebill_no
        self.linkkey = linkkey
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        rebill_no                       <- map["rebill_no"]
        linkkey                         <- map["linkkey"]
    }
    
}
