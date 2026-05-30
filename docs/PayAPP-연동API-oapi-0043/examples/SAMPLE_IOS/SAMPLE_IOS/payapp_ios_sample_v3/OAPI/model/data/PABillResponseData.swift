//
//  PABillResponseData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2022/09/29.
//

import UIKit

class PABillResponseData: NSObject {
    /**
     결제회원 연동키
     */
    var encBill: String?
    
    /**
     결제회원 키
     */
    var billAuthNo: String?
    
    /**
     카드번호
     */
    var cardno: String?
    
    /**
     카드사명
     */
    var cardname: String?
}
