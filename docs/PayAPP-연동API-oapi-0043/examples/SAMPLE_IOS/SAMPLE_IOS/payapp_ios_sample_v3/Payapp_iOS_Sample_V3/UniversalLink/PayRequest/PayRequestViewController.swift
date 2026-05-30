//
//  UniversalLinkViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/23.
//

import UIKit
import XLPagerTabStrip

class PayRequestViewController: UIViewController, IndicatorInfoProvider {
    
    @IBOutlet weak var scrollView: UIScrollView!
    
    @IBOutlet weak var phoneTxtF: UITextField!
    @IBOutlet weak var goodNameTxtF: UITextField!
    @IBOutlet weak var priceTxtF: UITextField!
    @IBOutlet weak var cardinstTxtF: UITextField!
    
    @IBOutlet weak var taxSC: UISegmentedControl!
    @IBOutlet weak var isAllPayReqTypeSch: UISwitch!
    @IBOutlet weak var var1TxtF: UITextField!
    @IBOutlet weak var var2TxtF: UITextField!
    
    @IBOutlet weak var buttonView: UIView!
    
    let FEEDBACK_URL = "http://iOS_feedbackurl.kr"
    
    var reqType:PAReqType?
     
    func indicatorInfo(for pagerTabStripController: PagerTabStripViewController) -> IndicatorInfo {
        return IndicatorInfo(title: "결제")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        isAllPayReqTypeSch.isOn = false
        scrollView.updateContentSize()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        scrollView.contentSize.height = buttonView.frame.maxY
    }

    /*
     * 원격 결제
     */
    @IBAction func payappRequestAction(_ sender: Any) {
        reqType = PAReqType.REMOTE
        openApp(reqType!)
    }

    /*
     * 카메라 결제
     */
    @IBAction func payappOcrPaymentAction(_ sender: Any) {
        reqType = PAReqType.OCR
        openApp(reqType!)
    }

    /*
     * 수기 결제
     */
    @IBAction func payappNotePaymentAction(_ sender: Any) {
        reqType = PAReqType.MANUAL
        openApp(reqType!)
    }
    
    /*
     * 네이버페이
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappNaverPaymentAction(_ sender: Any) {
        reqType = PAReqType.NAVER_PAY
        openApp(reqType!)
    }
    
    /*
     * 카카오페이
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappKakaoPaymentAction(_ sender: Any) {
        reqType = PAReqType.KAKAO_PAY
        openApp(reqType!)
    }
    
    /*
     * 스마일페이
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappSmilePaymentAction(_ sender: Any) {
        reqType = PAReqType.SMILE_PAY
        openApp(reqType!)
    }

    /*
     * 애플페이
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappApplePaymentAction(_ sender: Any) {
        reqType = PAReqType.APPLE_PAY
        openApp(reqType!)
    }

    /*
     * 페이코
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappPaycoPaymentAction(_ sender: Any) {
        reqType = PAReqType.PAYCO
        openApp(reqType!)
    }

    /*
     * 위챗페이
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappWechatPaymentAction(_ sender: Any) {
        reqType = PAReqType.WECHAT_PAY
        openApp(reqType!)
    }

    /*
     * 내통장결제
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)

     * ** 최소 결제 금액 10,000원 **
     */
    @IBAction func payappMyAccountPaymentAction(_ sender: Any) {
        reqType = PAReqType.MY_ACCOUNT
        openApp(reqType!)
    }

    /*
     * 토스페이
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappTossPymentAction(_ sender: Any) {
        reqType = PAReqType.TOSS_PAY
        openApp(reqType!)
    }

    /*
     * QR
     * 결제 완료 후 자동 전환이 안 될 결우 '결제확인' 버튼을 눌러 확인해주세요.
     * 자동 전환 및 "결제확인" 버튼을 안 누를 시 결제건이 누락 될 수 있습니다. (페이앱에선 확인 가능)
     */
    @IBAction func payappQRPaymentAction(_ sender: Any) {
        reqType = PAReqType.QR
        openApp(reqType!)
    }

    func openApp(_ reqType: PAReqType) {
        (parent as? UniversalLinkTabViewController)?.reqType = reqType
        
        let param = makeParam(reqType)
        print("param :: \(param)")
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
    
    /**
     * 원격결제 및 대면결제
     *
     * reqType : 원격결제 = REMOTE
     *        카메라 = OCR
     *        수기 = MANUAL
     *        네이버페이 = NAVER_PAY
     *        카카오페이 = KAKAO_PAY
     *        스마일페이 = SMILE_PAY
     *        애플페이 = APPLE_PAY
     *        페이코 = PAYCO
     *        위챗페이 = WECHAT_PAY
     *        내통장결제 = MY_ACCOUNT
     *        토스페이 = TOSS_PAY
     *        QR = QR
     *
     * returnUri : 리턴받을 고객사 앱 URI
     * phoneNumber : 수신 전화번호 (* 원격결제 필수, * 대면결제 10만원 이상 시 필수)
     * goodName : 상품명
     * goodPrice : 상품 가격 (* 1,000원이상 부터 가능, 내통장결제는 10,000원 부터 가능)
     * cardinst : 할부 [1~12] * 5만원 이상부터 가능 (카메라, 수기) 미입력 시 일시불
     * hasTax : 과세/면세 [과세:1, 면세:0] * 개인인 경우 면세
     * isAllPayReqType : 모든 대면결제 타입 사용 [사용:1, 미사용:0]
     * feedbackurl : 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다. 공통 통보 URL 등록 시 중복 호출되니, 중복처리 되지 않도록 mul_no를 이용하여 중복 방지.)
     * checkretry : feedbackurl 재시도 [y:재시도,n:재시도 안함]
     * var1, var2 : 임의 사용 변수 1, 2
     */
    func makeParam(_ reqType: PAReqType) -> String {
        var param: String = ConstValue.PAYAPP_UNIVERSAL_LINK

        param += "?reqType=" + reqType.rawValue
        param += "&returnUri=" + ConstValue.RETURN_URI.encodeSpecialChar()
        param += "&phoneNumber=" + phoneTxtF.text!.encodeSpecialChar()
        param += "&goodName=" + goodNameTxtF.text!.encodeSpecialChar()
        param += "&goodPrice=" + priceTxtF.text!.encodeSpecialChar()
        param += cardinstCheck(reqType)
        param += "&hasTax=" + String(taxSC.selectedSegmentIndex == 0 ? ConstValue.TRUE_STR : ConstValue.FALSE_STR)
        param += isAllPayReqTypeSchCheck(reqType)
        param += "&feedbackurl=" + FEEDBACK_URL.encodeSpecialChar()
        param += "&checkretry=" + "y"
        param += "&var1=" + var1TxtF.text!.encodeSpecialChar()
        param += "&var2=" + var2TxtF.text!.encodeSpecialChar()

        return param
    }
    
    /**
     * 할부 [1~12 개월] (5만원 이상부터 가능) 카메라, 수기  사용
     */
    func cardinstCheck(_ reqType: PAReqType) -> String {
        var param = ""
        
        if reqType == .OCR || reqType == .MANUAL {
            param = "&cardinst=" + cardinstTxtF.text!
        }
        
        return param
    }
    
    /**
     * 모튼 결제 선택 가능 처리
     * - 페이앱 이동 후 결제 선택이 가능해 집니다.
     */
    func isAllPayReqTypeSchCheck(_ reqType: PAReqType) -> String {
        var param = ""
        
        if reqType == .OCR ||
            reqType == .MANUAL ||
            reqType == .NAVER_PAY ||
            reqType == .KAKAO_PAY ||
            reqType == .SMILE_PAY ||
            reqType == .APPLE_PAY ||
            reqType == .PAYCO ||
            reqType == .WECHAT_PAY ||
            reqType == .MY_ACCOUNT ||
            reqType == .TOSS_PAY ||
            reqType == .QR {
            param =  "&isAllPayReqType=" + (isAllPayReqTypeSch.isOn ? ConstValue.TRUE_STR : ConstValue.FALSE_STR)
        }
        
        return param
    }  
       
}
