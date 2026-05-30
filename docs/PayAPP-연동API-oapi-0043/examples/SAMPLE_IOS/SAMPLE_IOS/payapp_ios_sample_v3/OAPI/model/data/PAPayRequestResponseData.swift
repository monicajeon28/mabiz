//
//  PAPayRequestResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PAPayRequestResponseData: PAResponseData {

    
    /**
     * 성공시 결제요청 번호
     */
    var mul_no:String?

    /**
     * 결제창 URL
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
        
        mul_no                          <- map["mul_no"]
        payurl                          <- map["payurl"]
    }
    
    
}
