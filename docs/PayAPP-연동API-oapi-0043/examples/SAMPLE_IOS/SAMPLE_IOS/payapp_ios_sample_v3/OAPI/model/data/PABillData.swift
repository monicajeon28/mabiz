//
//  PABillData.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/27.
//

import UIKit

class PABillData: NSObject {

    /**
     판매자 회원 아이디
     */
    var userId: String?
    
    /**
     구매자 성함
     */
    var buyerName: String?
    
    /**
     구매자 전화번호
     */
    var recvPhone: String?
    
    var billResponseData:PABillResponseData?
    
    
    
}
