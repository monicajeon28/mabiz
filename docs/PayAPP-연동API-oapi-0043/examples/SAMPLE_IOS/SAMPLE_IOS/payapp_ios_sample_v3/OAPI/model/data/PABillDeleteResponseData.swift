//
//  s.swift
//  Payapp_iOS_Sample_V2
//
//  Created by 조상현 on 2022/09/26.
//

import ObjectMapper

class PABillDeleteResponseData: PAResponseData {

    required convenience init?(map: Map){
        self.init()
    }
    
    override init(){
        super.init()
    }
    
    override func mapping(map: Map) {
        super.mapping(map: map)
    }
    
}
