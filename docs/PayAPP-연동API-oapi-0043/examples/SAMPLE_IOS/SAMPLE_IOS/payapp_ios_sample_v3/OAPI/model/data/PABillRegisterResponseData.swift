//
//  PABillRegisterResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by 조상현 on 2022/09/26.
//

import ObjectMapper

class PABillRegisterResponseData: PAResponseData {

    
    /**
     * 결제회원 연동키
     */
    var encBill:String?

    /**
     * 결제회원 키
     */
    var billAuthNo:String?
    
    /**
     * 카드번호
     */
    var cardno:String?
    
    /**
     * 카드사명
     */
    var cardname:String?
    
    required convenience init?(map: Map){
        self.init()
    }
    
    override init(){
        super.init()
    }
    
    override func mapping(map: Map) {
        super.mapping(map: map)
        encBill                     <- map["encBill"]
        billAuthNo                  <- map["billAuthNo"]
        cardno                      <- map["cardno"]
        cardname                    <- map["cardname"]
    }
    
}
