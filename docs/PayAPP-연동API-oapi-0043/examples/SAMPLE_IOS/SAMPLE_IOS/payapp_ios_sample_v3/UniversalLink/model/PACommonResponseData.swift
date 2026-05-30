//
//  PACommonResponseData.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/22.
//

import Foundation

class PACommonResponseData: NSObject {
    

    /**
     * 결과
     */
    var state:String?

    /**
     * 에러 메시지
     */
    var errorMessage:String?

    /**
     * 에러 코드
     */
    var errorCode:String?
 
    
    init(_ data:[String:Any]) {
        state               = data["state"] as? String
        errorMessage        = data["errorMessage"] as? String
        errorCode           = data["errorCode"] as? String
     
    }
    
}
