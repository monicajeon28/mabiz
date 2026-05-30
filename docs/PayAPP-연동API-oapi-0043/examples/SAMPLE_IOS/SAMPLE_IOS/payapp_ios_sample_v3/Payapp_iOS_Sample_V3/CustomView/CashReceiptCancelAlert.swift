//
//  CashReceiptCancelAlert.swift
//  Payapp_iOS_Sample_V3
//
//  Created by 조상현 on 2023/08/23.
//

import UIKit

class CashReceiptCancelAlert: UIViewController {
    
    @IBOutlet weak var cashNoView: TextFieldView!
    
    var cancelCallback: (String) -> Void = { _ in }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        cashNoView.initUI(title: "cashstno", useStar: true, keyboardType: .numberPad)
    }
    
    func setCancelCallback(cancelCallback: @escaping (String) -> Void) {
        self.cancelCallback = cancelCallback
    }
    
    @IBAction func cancelAction(_ sender: Any) {
        cancelCallback(cashNoView.getText())
        dismiss(animated: false)
    }
    
}
