//
//  PASellerRegistResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PASellerRegistResponseData: PAResponseData {

    /**
     * 가입 성공시 판매자 아이디
     */
    var userid:String?

    /**
     * 가입 성공시 연동KEY
     */
    var linkkey:String?

    /**
     * 가입 성공시 연동VALUE
     */
    var linkval:String?
    
    
    required convenience init?(map: Map){
        self.init()
    }
    
    override init(){
        super.init()
    }
    
    override func mapping(map: Map) {
        super.mapping(map: map)
        userid                          <- map["userid"]
        linkkey                         <- map["linkkey"]
        linkval                         <- map["linkval"]
        
    }
    
}
