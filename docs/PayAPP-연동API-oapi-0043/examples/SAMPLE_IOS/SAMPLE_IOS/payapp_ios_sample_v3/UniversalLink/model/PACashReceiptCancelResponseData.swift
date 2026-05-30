//
//  PACashReceiptCancelResponseData.swift
//  Payapp_iOS_Sample_V3
//
//  Created by 조상현 on 2023/08/28.
//

class PACashReceiptCancelResponseData: PACommonResponseData {
     
    /**
     영수증번호
     */
    var receiptno: String?
    /**
     임의 변수 1, 2
     */
    var var1: String?
    var var2: String?
    
    
    override init(_ data:[String:Any]) {
        super.init(data)
        
        receiptno               = data["receiptno"] as? String
        var1                    = data["var1"] as? String
        var2                    = data["var2"] as? String
    }
    
    func toString() -> String {
        var str = "state:\(state ?? ""), "
        str += "errorMessage:\(errorMessage ?? ""), "
        str += "receiptno:\(receiptno ?? ""), "
        str += "var1:\(var1 ?? ""), "
        str += "var2:\(var2 ?? "")"
        return str
    }
}
