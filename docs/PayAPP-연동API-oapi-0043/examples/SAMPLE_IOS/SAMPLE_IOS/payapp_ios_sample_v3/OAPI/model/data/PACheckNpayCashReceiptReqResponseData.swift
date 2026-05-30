//
//  PACheckNpayCashReceiptReqResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PACheckNpayCashReceiptReqResponseData: PAResponseData {
    
    /**
     * 현금영수증 발행 대상 총 금액
     */
    var totalCashAmount:String?

    /**
     * 현금성 총 공급가
     */
    var supplyCashAmount:String?

    /**
     * 현금성 총 부가세
     */
    var vatCashAmount:String?
    
    required convenience init?(map: Map){
        self.init()
    }
    
    override init(){
        super.init()
    }
    
    override func mapping(map: Map) {
        super.mapping(map: map)
        totalCashAmount                 <- map["totalCashAmount"]
        supplyCashAmount                <- map["supplyCashAmount"]
        vatCashAmount                   <- map["vatCashAmount"]
        
    }
}
