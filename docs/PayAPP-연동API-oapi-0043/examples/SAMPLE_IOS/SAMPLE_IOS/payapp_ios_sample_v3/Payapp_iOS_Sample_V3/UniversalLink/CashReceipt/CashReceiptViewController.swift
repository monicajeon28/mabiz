//
//  CashReceiptViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by 조상현 on 2023/08/22.
//

import UIKit
import XLPagerTabStrip

class CashReceiptViewController: UIViewController, IndicatorInfoProvider {
    
    @IBOutlet weak var scrollView: UIScrollView!
    @IBOutlet weak var buttonView: UIView!
      
    var reqType: PAReqType?
    @IBOutlet weak var trCodeSch: UISegmentedControl!
    @IBOutlet weak var tradeTimeView: TextFieldView!
    @IBOutlet weak var idInfoView: TextFieldView!
    @IBOutlet weak var nameView: TextFieldView!
    @IBOutlet weak var goodNameView: TextFieldView!
    @IBOutlet weak var goodPriceView: TextFieldView!
    @IBOutlet weak var hasTaxSch: UISegmentedControl!
    @IBOutlet weak var svcView: TextFieldView!
    @IBOutlet weak var emailView: TextFieldView!
    @IBOutlet weak var var1View: TextFieldView!
    @IBOutlet weak var var2View: TextFieldView!
     
    var cashReceiptList: [PACashReceiptResponseData] = []
    
    func indicatorInfo(for pagerTabStripController: PagerTabStripViewController) -> IndicatorInfo {
        return IndicatorInfo(title: "현금영수증")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let dateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "ko_kr")
        dateFormatter.timeZone = TimeZone.autoupdatingCurrent
        dateFormatter.dateFormat = "yyyyMMddHHmmss"
        tradeTimeView.initUI(title: "원 거래시간", body: dateFormatter.string(from: Date()), useStar: true)
        
        idInfoView.initUI(title: "휴대폰번호", useStar: true, keyboardType: .numberPad)
        nameView.initUI(title: "구매자명", useStar: true)
        goodNameView.initUI(title: "상품명", useStar: true)
        goodPriceView.initUI(title: "거래금액", useStar: true, keyboardType: .numberPad)
        emailView.initUI(title: "구매자 Email")
        svcView.initUI(title: "봉사료", keyboardType: .numberPad)
        var1View.initUI(title: "var1")
        var2View.initUI(title: "var2")
    }
    
    override func viewDidAppear(_ animated: Bool) {
        scrollView.contentSize.height = buttonView.frame.maxY
    }
    
    /** 사업자만 현금영수증 발행이 가능하며, 개인은 불가능합니다.
     * 현금영수증 발행
     * reqType : 발행 = CASH_RECEIPT
     * returnUri : 리턴받을 고객사 앱 URI
     * trCode : 소득공제용: 0, 지출증빙용: 1
     * tradeTime : 원거래시각 [YYYYMMDDHHMMSS]
     * idInfo : 소득공제용 발행 시: 휴대폰번호 / 지출증빙용 발행 시: 사업자번호
     * name : 구매자 또는 사업자 명
     * goodName : 상품명
     * goodPrice : 발행 요청 금액
     * svc : 봉사료
     * email : 주문자 이메일
     * hasTax : 과세/면세 [과세:1, 면세:0]
     * var1, var2 : 임의 사용 변수 1, 2
     * @return
     */
    @IBAction func cashReceiptAction(_ sender: Any) {
        reqType = .CASH_RECEIPT
        
        var param: String = ConstValue.PAYAPP_UNIVERSAL_LINK
        param += "?reqType=" + reqType!.rawValue.encodeSpecialChar()
        param += "&returnUri=" + ConstValue.RETURN_URI.encodeSpecialChar()
        param += "&trCode=" + String(trCodeSch.selectedSegmentIndex == 0 ? ConstValue.FALSE_STR : ConstValue.TRUE_STR).encodeSpecialChar()
        param += "&tradeTime=" + tradeTimeView.getText().encodeSpecialChar()
        param += "&idInfo=" + idInfoView.getText().encodeSpecialChar()
        param += "&name=" + nameView.getText().encodeSpecialChar()
        param += "&goodName=" + goodNameView.getText().encodeSpecialChar()
        param += "&goodPrice=" + goodPriceView.getText().encodeSpecialChar()
        param += "&svc=" + svcView.getText().encodeSpecialChar()
        param += "&email=" + emailView.getText().encodeSpecialChar()
        param += "&hasTax=" + String(hasTaxSch.selectedSegmentIndex == 0 ? ConstValue.TRUE_STR : ConstValue.FALSE_STR).encodeSpecialChar()
        param += "&var1=" + var1View.getText().encodeSpecialChar()
        param += "&var2=" + var2View.getText().encodeSpecialChar()

        openApp(param: param)
    }
    
    /**
     * 현금영수증 발행 취소
     * reqType : 취소 = CASH_RECEIPT_CANCEL
     * returnUri : 리턴받을 고객사 앱 URI
     * cashstno : 현금영수증 발행 번호
     * var1, var2 : 임의 사용 변수 1, 2
     * @return
     */
    @IBAction func cancelAction(_ sender: Any) {
        reqType = .CASH_RECEIPT_CANCEL
        
        let cashReceiptCancelAlert = CashReceiptCancelAlert()
        cashReceiptCancelAlert.setCancelCallback { [self] cashStNo in
            var param: String = ConstValue.PAYAPP_UNIVERSAL_LINK
            param += "?reqType=" + reqType!.rawValue.encodeSpecialChar()
            param += "&returnUri=" + ConstValue.RETURN_URI.encodeSpecialChar()
            param += "&cashstno=" + cashStNo.encodeSpecialChar()
            param += "&var1=" + var1View.getText().encodeSpecialChar()
            param += "&var2=" + var2View.getText().encodeSpecialChar()
            
            openApp(param: param)
        }
        
        present(cashReceiptCancelAlert, animated: false)
    }
    
    @IBAction func typeChanged(_ sender: UISegmentedControl) {
        // 소득공제용
        if sender.selectedSegmentIndex == 0 {
            idInfoView.changedTitle(title: "휴대폰번호")
            nameView.changedTitle(title: "구매자명")
        }
        // 지출증빙용
        else {
            idInfoView.changedTitle(title: "사업자번호")
            nameView.changedTitle(title: "사업자명")
        }
    }
    
    func openApp(param: String) {
        (parent as? UniversalLinkTabViewController)?.reqType = reqType
        
        if let appUrl = URL(string: param) {
            UIApplication.shared.open(appUrl) { success in
                if success {
                    print("The URL was delivered successfully.")
                } else {
                    print("The URL failed to open.")
                }
            }
        }
    }
      
}
