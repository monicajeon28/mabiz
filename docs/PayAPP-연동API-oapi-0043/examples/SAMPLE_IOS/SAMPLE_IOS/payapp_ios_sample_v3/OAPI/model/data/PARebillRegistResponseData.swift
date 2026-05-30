//
//  PARebillRegistResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PARebillRegistResponseData: PAResponseData {

    
    /**
     * 정기결제 등록번호
     */
    var rebill_no:String?

    /**
     * 정기결제URL
     */
    var payurl:String?
    
    
    required convenience init?(map: Map){
        self.init()
    }
    
    override init(){
        super.init()
    }
    
    override func mapping(map: Map) {
        super.mapping(map: map)
        rebill_no                   <- map["rebill_no"]
        payurl                      <- map["payurl"]
    }
    
}
