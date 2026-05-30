//
//  PAResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PAResponseData: Mappable {
    
    
    /**
     * 1 : 성공
     * 0 : 실패
     */
    var state:String?

    /**
     * 실패시 오류 문자열
     */
    var errorMessage:String?

    /**
     * returnData
     */
    var returnJsonData:String?
    
    
    required init?(map: Map){}
    init(){}
    
    func mapping(map: Map) {
        
        state                          <- map["state"]
        errorMessage                   <- map["errorMessage"]
        returnJsonData                 <- map["returnJsonData"]
        
    }
    
}
