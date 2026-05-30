//
//  PAPaymentResponseData.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/22.
//

import UIKit

class PAPaymentResponseData: PACommonResponseData {
    /**
     * 페이앱 영수증 URL
     */
    var csturl:String?
 
    /**
     * 페이앱 결제 번호
     */
    var mul_no:String?

    /**
     * 카드사 이름
     */
    var cardName:String?

    /**
     * 카드 번호
     */
    var cardNum:String?

    /**
     * 결제 일시
     */
    var date:String?

    /**
     * 할부개월
     */
    var installment:String?

    /**
     * 상품명
     */
    var goodName:String?

    /**
     * 카드승인번호
     */
    var cardAuthNumber:String?

    /**
     * 상품 금액
     */
    var goodPrice:String?
    
    /**
     임의 변수 1, 2
     */
    var var1:String?
    var var2:String?
    
    override init(_ data:[String:Any]) {
        super.init(data)
        
        csturl              = data["csturl"] as? String
        mul_no              = data["mul_no"] as? String
        cardName            = data["cardName"] as? String
        cardNum             = data["cardNum"] as? String
        date                = data["date"] as? String
        installment         = data["installment"] as? String
        goodName            = data["goodName"] as? String
        cardAuthNumber      = data["cardAuthNumber"] as? String
        goodPrice           = data["goodPrice"] as? String
        var1                = data["var1"] as? String
        var2                = data["var2"] as? String
    }
    
    
    func toString() -> String {
        var str = "csturl:\(csturl ?? ""), "
        str += "state:\(state ?? ""), "
        str += "errorMessage:\(errorMessage ?? ""), "
        str += "errorCode:\(errorCode ?? ""), "
        str += "mul_no:\(mul_no ?? ""), "
        str += "cardName:\(cardName ?? ""), "
        str += "cardNum:\(cardNum ?? ""), "
        str += "date:\(date ?? ""), "
        str += "installment:\(installment ?? ""), "
        str += "goodName:\(goodName ?? ""), "
        str += "cardAuthNumber:\(cardAuthNumber ?? ""), "
        str += "goodPrice:\(goodPrice ?? ""), "
        str += "var1:\(var1 ?? ""), "
        str += "var2:\(var2 ?? "")"
        return str
    }
}
