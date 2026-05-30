//
//  PASubidRegistData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PASubidRegistData: Mappable {

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
     * 부계정 아이디
     * 필수
     */
    var subuserid:String?

    /**
     * 부계정 비밀번호
     * 필수
     */
    var subpwd:String?

    /**
     * 부계정명
     * 필수
     */
    var subname:String?

    /**
     * 대분류
     */
    var subetc1:String?

    /**
     * 중분류
     */
    var subetc2:String?

    /**
     * 소분류
     */
    var subetc3:String?

    /**
     * 직급
     */
    var subjtype:String?

    /**
     * 권한
     */
    var state:String?

    required init?(map: Map){}
    init(userid:String, subuserid:String, subpwd:String, subname:String){
        
        self.userid = userid
        self.subuserid = subuserid
        self.subpwd = subpwd
        self.subname = subname
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        subuserid                       <- map["subuserid"]
        subpwd                          <- map["subpwd"]
        subname                         <- map["subname"]
        subetc1                         <- map["subetc1"]
        subetc2                         <- map["subetc2"]
        subetc3                         <- map["subetc3"]
        subjtype                        <- map["subjtype"]
        state                           <- map["state"]

    }
}
