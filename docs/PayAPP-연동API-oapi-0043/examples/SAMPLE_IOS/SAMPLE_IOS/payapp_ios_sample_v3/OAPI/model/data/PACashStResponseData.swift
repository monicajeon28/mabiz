//
//  PACashStResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PACashStResponseData: PAResponseData {
 

    /**
     * 발행번호
     */
    var cashstno:String?

    /**
     * 발행url
     */
    var cashsturl:String?
    
    
    required convenience init?(map: Map){
        self.init()
    }
    
    override init(){
        super.init()
    }
    
    override func mapping(map: Map) {
        super.mapping(map: map)
        cashstno                        <- map["cashstno"]
        cashsturl                       <- map["cashsturl"]
    }
    
}
