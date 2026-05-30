//
//  BillListViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/27.
//

import UIKit
import ObjectMapper
import Toaster

class BillListViewController: UIViewController, UITableViewDelegate, UITableViewDataSource {
    
    let oApiSv = PAOApiSv()
    
    @IBOutlet weak var tableView: UITableView!
    
    var billDatas:[PABillData] = []
    
    var callBack:([PABillData]) -> Void = {_ in }
    
    public func setData(billDatas:[PABillData], callBack:@escaping(_ billDatas:[PABillData]) -> Void) {
        self.billDatas = billDatas;
        self.callBack = callBack;
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(UINib(nibName: BillTableViewCell.ID, bundle: nil), forCellReuseIdentifier: BillTableViewCell.ID)
        tableView.reloadData()
         
    }
        
        
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: BillTableViewCell.ID, for: indexPath) as? BillTableViewCell else {
            return UITableViewCell()
        }
        
        cell.settingBillData(billData: billDatas[indexPath.row])
        cell.setDeleteClosure(index: indexPath.row) { index, data in
            self.delete(index: index, data: data)
        }
        
        cell.setPaymentClosure { data in
            self.payment(data: data)
        }
        
        return cell
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        billDatas.count
    }
    
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        return 110
    }
    
    // 삭제
    func delete(index: Int, data: PABillDeleteData) {
        oApiSv.billDelete(data: data) { (result) in
            let data = Mapper<PABillDeleteResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                self.billDatas.remove(at: index)
                self.callBack(self.billDatas)
                self.tableView.reloadData()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    // 결제요청
    func payment(data: PABillPaymentData) {
        
        data.goodname = "BILL 테스트 상품"
        data.price = "1000"
        
        oApiSv.billPayment(data: data) {result in
            let data = Mapper<PABillPaymentResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                Toast(text: "결제되었습니다.").show()
            } else { 
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
     
    @IBAction func closeAction(_ sender: Any) {
        dismiss(animated: true, completion: nil)
    }

    
}
