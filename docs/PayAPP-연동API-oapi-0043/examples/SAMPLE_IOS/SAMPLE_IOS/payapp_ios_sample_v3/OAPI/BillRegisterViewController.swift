//
//  BillRegisterViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/27.
//

import UIKit
import ObjectMapper
import Toaster

class BillRegisterViewController: UIViewController {
    
    let oApiSv = PAOApiSv()
    
    var userId = ""
    
    @IBOutlet weak var userIdTextField: UITextField!
    @IBOutlet weak var cardNoTextField: UITextField!
    @IBOutlet weak var expMonthTextField: UITextField!
    @IBOutlet weak var expYearTextField: UITextField!
    @IBOutlet weak var buyerAuthNoTextField: UITextField!
    @IBOutlet weak var cardPwTextField: UITextField!
    @IBOutlet weak var buyerPhoneTextField: UITextField!
    @IBOutlet weak var buyerName: UITextField!
    
    var callBack:(PABillData) -> Void = {_ in }
     
    override func viewDidLoad() {
        super.viewDidLoad()
        addHideKeyboardWhenTappedAround()
        userIdTextField.text = userId
    }
    
    func setUserId(userId: String, callBack: @escaping (_ billData: PABillData) -> Void) {
        self.userId = userId
        self.callBack = callBack
    }
    
    @IBAction func closeAction(_ sender: Any) {
        dismiss(animated: true, completion: nil)
    }
 
    
    @IBAction func billRegister(_ sender: Any) {
        
        if userIdTextField.text!.isEmpty {
            Toast(text: "유저 아이디를 입력해주세요.").show()
            return
        }
        
        if cardNoTextField.text!.isEmpty {
            Toast(text: "카드번호를 입력해주세요.").show()
            return
        }
        
        if expMonthTextField.text!.isEmpty {
            Toast(text: "유효기간(월)을 입력해주세요.").show()
            return
        }
        
        if expYearTextField.text!.isEmpty {
            Toast(text: "유효기간(년)을 입력해주세요.").show()
            return
        }
        
        if buyerAuthNoTextField.text!.isEmpty {
            Toast(text: "인증번호를 입력해주세요.").show()
            return
        }
        
        if cardPwTextField.text!.isEmpty {
            Toast(text: "카드 비밀번호를 입력해주세요.").show()
            return
        }
        
        if buyerPhoneTextField.text!.isEmpty {
            Toast(text: "구매자 전화번호를 입력해주세요.").show()
            return
        }
        
        if buyerName.text!.isEmpty {
            Toast(text: "구매자 성함를 입력해주세요.").show()
            return
        }
        
        let billRegisterData = PABillRegisterData()
        billRegisterData.userid = userIdTextField.text
        billRegisterData.cardNo = cardNoTextField.text
        billRegisterData.expMonth = expMonthTextField.text
        billRegisterData.expYear = expYearTextField.text
        billRegisterData.buyerAuthNo = buyerAuthNoTextField.text
        billRegisterData.cardPw = cardPwTextField.text
        billRegisterData.buyerPhone = buyerPhoneTextField.text
        billRegisterData.buyerName = buyerName.text
         
        oApiSv.billRegister(data: billRegisterData) { (result) in
            let data = Mapper<PABillRegisterResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                let billData = PABillData()
                billData.userId = self.userIdTextField.text!
                billData.buyerName = self.buyerName.text!
                billData.recvPhone = self.buyerPhoneTextField.text!

                let billResponseData = PABillResponseData()
                billResponseData.encBill = String(describing: data.encBill!)
                billResponseData.billAuthNo = String(describing: data.billAuthNo!)
                billResponseData.cardno = String(describing: data.cardno!)
                billResponseData.cardname = String(describing: data.cardname!)
                billData.billResponseData = billResponseData
                self.callBack(billData)
                Toast(text: "추가되었습니다.").show()
                self.dismiss(animated: true, completion: nil)
            } else {
                Toast(text: data.errorMessage!).show()
            }
        }
    }
    func addHideKeyboardWhenTappedAround() {
        let tap: UITapGestureRecognizer = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
    }
    
    @objc func dismissKeyboard() {
        view.endEditing(true)
    }
    
}
