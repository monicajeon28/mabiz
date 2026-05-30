//
//  BillTableViewCell.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/27.
//

import UIKit

class BillTableViewCell: UITableViewCell {
    
    static let ID = "BillTableViewCell"
    
    var deleteClosure: (Int, PABillDeleteData) -> Void = { _, _ in }
    
    var paymentClosure: (PABillPaymentData) -> Void = { _ in }
    
    var index = 0
    var billData = PABillData()
    
    @IBOutlet weak var buyerNameLabel: UILabel!
    
    @IBOutlet weak var cardNoLabel: UILabel!
    
    func settingBillData(billData: PABillData) {
        self.billData = billData
        buyerNameLabel.text = billData.buyerName
        cardNoLabel.text = billData.billResponseData!.cardno
    }
    
    func setDeleteClosure(index: Int, closure: @escaping (Int, PABillDeleteData) -> Void) {
        self.index = index
        deleteClosure = closure
    }
    
    func setPaymentClosure(closure: @escaping (PABillPaymentData) -> Void) {
        paymentClosure = closure
    }
    
    @IBAction func deleteAction(_ sender: Any) {
        let billDeleteData = PABillDeleteData()
        billDeleteData.userid = billData.userId
        billDeleteData.encBill = billData.billResponseData!.encBill
        deleteClosure(index, billDeleteData)
    }
    
    @IBAction func payAction(_ sender: Any) {
        let billPaymentData = PABillPaymentData()
        billPaymentData.userid = billData.userId
        billPaymentData.encBill = billData.billResponseData!.encBill
        billPaymentData.recvphone = billData.recvPhone
        paymentClosure(billPaymentData)
    }
}
