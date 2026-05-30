//
//  UniversalLinkTabViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by 조상현 on 2023/08/22.
//

import UIKit
import XLPagerTabStrip

class UniversalLinkTabViewController: ButtonBarPagerTabStripViewController {
      
    var reqType: PAReqType?
    
    override func viewDidLoad() {
        configureButtonBar()
        super.viewDidLoad()
        
        addHideKeyboardWhenTappedAround()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        NotificationCenter.default.addObserver(self, selector: #selector(resultDataCall),  name: NSNotification.Name(rawValue: ConstValue.NOTIFICATION_RESULT), object: nil)
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        NotificationCenter.default.removeObserver(self, name: NSNotification.Name(rawValue: ConstValue.NOTIFICATION_RESULT), object: nil)
    }
    
    @objc func resultDataCall(_ notification: NSNotification) {
        let resultData = notification.userInfo! as! [String : Any]
        showAlert("Result", "\(resultData)")
        
         if reqType == PAReqType.REMOTE {
             let data = PARemoteReqeustResponseData(resultData)
             print("REMOTE data : \(data.toString())")
         } else if reqType == PAReqType.CASH_RECEIPT {
             let data = PACashReceiptResponseData(resultData)
             print("CASH_RECEIPT data : \(data.toString())")
         } else if reqType == PAReqType.CASH_RECEIPT_CANCEL {
             let data = PACashReceiptCancelResponseData(resultData)
             print("CASH_RECEIPT_CANCEL data : \(data.toString())")
         } else {
             let data = PAPaymentResponseData(resultData)
             print("payment data : \(data.toString())")
         }
    }
    
    func showAlert(_ title: String, _ str: String) {
        let alert = UIAlertController(title: title, message: str, preferredStyle: UIAlertController.Style.alert)
        let close = UIAlertAction(title: "close", style: .cancel, handler : nil)
        alert.addAction(close)
        present(alert, animated: true, completion: nil)
    }

    override func viewControllers(for pagerTabStripController: PagerTabStripViewController) -> [UIViewController] {
        let child1 = PayRequestViewController()
        let child2 = CashReceiptViewController()
        return [child1, child2]
    }
    
    func configureButtonBar() {
        settings.style.buttonBarBackgroundColor = .white
        settings.style.buttonBarItemBackgroundColor = .white
        settings.style.buttonBarItemTitleColor = .gray
        changeCurrentIndexProgressive = { (oldCell: ButtonBarViewCell?, newCell: ButtonBarViewCell?, progressPercentage: CGFloat, changeCurrentIndex: Bool, animated: Bool) -> Void in
            guard changeCurrentIndex == true else { return }
            oldCell?.label.textColor = .gray
            
        }
    }
    
    @IBAction func closeAction(_ sender: Any) {
        self.dismiss(animated: true, completion: nil)
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
