//
//  s2.swift
//  Payapp_iOS_Sample_V2
//
//  Created by 조상현 on 2022/09/26.
//

import ObjectMapper

class PABillPaymentResponseData: PAResponseData {

    
    /**
     * 영수증 url
     */
    var CSTURL:String?

    /**
     * 결제 금액
     */
    var price:String?
    
    /**
     * 결제요청번호
     */
    var mul_no:String?
 
    required convenience init?(map: Map){
        self.init()
    }
    
    override init(){
        super.init()
    }
    
    override func mapping(map: Map) {
        super.mapping(map: map)
        CSTURL                      <- map["CSTURL"]
        price                       <- map["price"]
        mul_no                      <- map["mul_no"]
    }
    
}
