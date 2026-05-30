//
//  PACashReceiptResponseData.swift
//  Payapp_iOS_Sample_V3
//
//  Created by 조상현 on 2023/08/22.
//
 
class PACashReceiptResponseData: PACommonResponseData {
     
    /**
     발행번호
     */
    var cashstno: String?
    /**
     영수증번호
     */
    var receiptno: String?
    /**
     영수증 url
     */
    var cashsturl: String?
    /**
     금액
     */
    var price: String?
    /**
     임의 변수 1, 2
     */
    var var1: String?
    var var2: String?
    
    
    override init(_ data:[String:Any]) {
        super.init(data)
        
        cashstno                = data["cashstno"] as? String
        receiptno               = data["receiptno"] as? String
        cashsturl               = data["cashsturl"] as? String
        price                   = data["price"] as? String
        var1                    = data["var1"] as? String
        var2                    = data["var2"] as? String
    }
    
    func toString() -> String {
        var str = "state:\(state ?? ""), "
        str += "errorMessage:\(errorMessage ?? ""), "
        str += "cashstno:\(cashstno ?? ""), "
        str += "receiptno:\(receiptno ?? ""), "
        str += "cashsturl:\(cashsturl ?? ""), "
        str += "price:\(price ?? ""), "
        str += "var1:\(var1 ?? ""), "
        str += "var2:\(var2 ?? "")"
        return str
    }
}
