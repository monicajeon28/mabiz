//
//  PARemoteReqeustResponseData.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/22.
//

import UIKit

class PARemoteReqeustResponseData: PACommonResponseData {
    
    /**
     * 페이앱 결제 번호
     */
    var mul_no: String?
    
    /**
     * 결제 URL
     */
    var payurl: String?
    
    /**
     임의 변수 1, 2
     */
    var var1:String?
    var var2:String?
    
    
    override init(_ data:[String:Any]) {
        super.init(data)
        
        mul_no          = data["mul_no"] as? String
        payurl          = data["payurl"] as? String
        var1            = data["var1"] as? String
        var2            = data["var2"] as? String
    }
    
    func toString() -> String {
        var str = "state:\(state ?? ""), "
        str += "mul_no:\(mul_no ?? ""), "
        str += "payurl:\(payurl ?? ""), "
        str += "var1:\(var1 ?? ""), "
        str += "var2:\(var2 ?? "")"
        return str
    }
}
