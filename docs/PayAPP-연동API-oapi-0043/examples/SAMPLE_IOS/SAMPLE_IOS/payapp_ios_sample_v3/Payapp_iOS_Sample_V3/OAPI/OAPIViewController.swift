//
//  OAPIViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/27.
//

import UIKit
import ObjectMapper
import SwiftUI
import Toaster

class OAPIViewController: UIViewController {
    
    let oApiSv = PAOApiSv()
    
    @IBOutlet weak var userIdTextField: UITextField!
    @IBOutlet weak var linkKeyTextField: UITextField!
    @IBOutlet weak var recvPhoneTextField: UITextField!
    @IBOutlet weak var emailTextField: UITextField!
    @IBOutlet weak var rebillExpireDP: UIDatePicker!
    
    /** 페이앱 아이디 */
    var userId = ""

    /** 연동 KEY, 해당 링크에서 가져오세요. [https://seller.payapp.kr/c/apiconnect_info] */
    var linkKey = ""

    /**전화번호 */
    var recvPhone = ""

    /** 이메일 */
    var email = ""

    /** 정기결제 요청 날짜(*오늘 이후 날짜) 0000-00-00 */
    var rebillExpire = ""


    /** mul_no, rebill_no, cashstno는 샘플앱을 원활하게 구동을 위한 변수입니다. */
    // 결제요청번호
    var mul_no: String? = nil
    
    // 정기결제 등록번호
    var rebill_no: String? = nil
    
    // 현금영수증 발행번호
    var cashstno: String? = nil
    
    var billDatas:[PABillData] = []
    
    let datePicker = DatePicker()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        addHideKeyboardWhenTappedAround() 
        
        userIdTextField.text = userId
        linkKeyTextField.text = linkKey
        recvPhoneTextField.text = recvPhone
        emailTextField.text = email
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        rebillExpire = formatter.string(from: Date())
        
        rebillExpireDP.setDate(Date(), animated: false)
    }
 
    // MARK: - 결제 Fucntion
    /**
     * 결제 요청
     * 시나리오 1 (구매자 핸드폰으로 결제 URL을 보내 결제를 요청한다.)
     * payRequest() 함수로 결제 링크 생성 및 구매자 핸드폰으로 결제 링크 전송 -> 구매자 결제
     *
     * data.setSmsuse("y");         - 구매자에게 결제 문자를 보낸다.
     * data.setFeedbackurl("");     - 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다.)
     **************************************************************************************************************************************

     * 시나리오 2 (결제 URL을 앱 내 WebView에 띄워 결제를 유도한다.)
     * payRequest() 함수로 결제 링크 생성 -> WebView로 링크 실행 -> 결제 진행 -> 결제앱으로 이동하여 인증 -> WebView로 돌아와 내부적으로 결제 처리 -> Skip_cstpage에 따라 '결제 전표' 이동 또는 'Returnurl' 이동
     *
     * data.setSmsuse("n");         - 구매자에게 결제 문자를 보내지 않는다.
     * data.setFeedbackurl("");     - 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다. 공통 통보 URL 등록 시 중복 호출되니, 중복처리 되지 않도록 mul_no를 이용하여 중복 방지.)
     * data.setSkip_cstpage("y");   - 'y' : 매출 전표 이동 없이 바로 Returnurl로 이동 (결제 데이터를 POST로 전송, 보안을 위해 결제완료 DB처리는 feedbackurl 페이지에서 한다.)
     *                       'n' : 매출 전표로 이동 (결제 데이터 전송 안 함, 확인 버튼 클릭시 Returnurl로 이동)
     * data.setReturnurl("");       - 결제 완료 후 이동 할 화면 URL. ex)앱제작사의 커스텀 매출전표, 결제 완료 화면
     *                    페이앱 연동은 끝났습니다. 해당 페이지에서 Javascript 또는 네이티브로 앱을 컨트롤 하세요.
     **************************************************************************************************************************************
     */
    @IBAction func payRequestAction(_ sender: Any) {
        
        let payRequestData = PAPayRequestData(userid: userId, goodname: "테스트 상품", price: "1000", recvphone: recvPhone)
        payRequestData.smsuse = "n"
        
        // 앱카드에서 인증 후 해당 앱을 호출 할때 사용.(앱카드 정책에 따라 정상 작동 안 할 수 있음)
        payRequestData.appurl = "\(ConstValue.OAPI_SCHEME)://"
        
        /**
         payRequestData.feedbackurl = ""
         payRequestData.returnurl = ""
         payRequestData.skip_cstpage = "n"
         */
        
        /**
         * currency가 usd일 경우 필수
         */
//        data.vccode = "국제전화 국가번호"
    
        oApiSv.payRequest(data:payRequestData) { (result) in
            let data = Mapper<PAPayRequestResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                self.mul_no = data.mul_no
                print("결제 요청 : \(String(describing: data.toJSONString()))")
                 
                /**
                 앱카드 결제 이용시 "inpo.plist -> LSApplicationQueriesSchemes" 를 확인해주세요.
                 */
                self.success()
                self.goWebView(data.payurl!)
         
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
            
        }
    }
    
    /*
     결제(요청, 승인) 취소
     */
    @IBAction func payCancelAction(_ sender: Any) {

        if self.mul_no == nil {
            Toast(text: "mul_no를 확인하세요.").show()
            return
        }
        
        let payCancelData = PAPayCancelData(userid:userId, linkkey:linkKey, mul_no:mul_no!, cancelmemo: "")

        /**
         * 부분취소인 경우 필수(partcancel (0:전취소, 1:부분취소))
         */
//        payCancelData.cancelprice = "결제요청취소 금액"
        
        oApiSv.payCancel(data:payCancelData){ [self] (result) in
            let data = Mapper<PAPayCancelResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                self.mul_no = nil
                print("결제(요청, 승인) 취소 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /*
     결제 취소 요청 (결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우)
     */
    @IBAction func paycancelReqAction(_ sender: Any) {
        if self.mul_no == nil {
            Toast(text: "mul_no를 확인하세요.").show()
            return
        }
        
        let payCancelReqData = PAPayCancelReqData(userid:userId, linkkey:linkKey, mul_no:mul_no!, cancelmemo:"취소 메모")
        
        /**
         * 부분취소인 경우 필수(partcancel (0:전취소, 1:부분취소))
         */
//        data.cancelprice = 결제요청취소 금액"
        
        oApiSv.paycancelreq(data:payCancelReqData){ (result) in
            let data = Mapper<PAPayCancelReqResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                self.mul_no = nil
                print("결제 취소 요청 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    // MARK: - 정기 결제 Fucntion
    /*
     정기 결제 요청
     */
    @IBAction func rebillRegistAction(_ sender: Any) {
        
        let rebillRegistData = PARebillRegistData(userid:userId, goodname:"정기결제 상품명", goodprice:"1000", recvphone:recvPhone, rebillCycleType:"Month", rebillExpire:rebillExpire)

        oApiSv.rebillRegist(data:rebillRegistData){ (result) in
            let data = Mapper<PARebillRegistResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                self.rebill_no = data.rebill_no
                print("정기 결제 요청 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /*
     정기 결제 해지
     */
    @IBAction func rebillCancelAction(_ sender: Any) {
        
        if self.rebill_no == nil {
            Toast(text: "rebill_no를 확인하세요.").show()
            return
        }
        
        let rebillCancelData = PARebillCancelData(userid:userId, rebill_no:rebill_no!, linkkey:linkKey)
        
        oApiSv.rebillCancel(data:rebillCancelData){ (result) in
            let data = Mapper<PARebillCancelResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                self.rebill_no = nil
                print("정기 결제 해지 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
        
    }
    
    /*
     정기 결제 일시 정지
     */
    @IBAction func rebillStopAction(_ sender: Any) {
        
        if self.rebill_no == nil {
            Toast(text: "rebill_no를 확인하세요.").show()
            return
        }
        
        let rebillStopData = PARebillStopData(userid:userId, rebill_no:rebill_no!, linkkey:linkKey)
        
        oApiSv.rebillStop(data:rebillStopData){ (result) in
            let data = Mapper<PARebillStopResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                print("정기 결제 일시 정지 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /*
     정기 결제 승인
     */
    @IBAction func rebillStartAction(_ sender: Any) {
        
        if self.rebill_no == nil {
            Toast(text: "rebill_no를 확인하세요.").show()
            return
        }
        
        let rebillStartData = PARebillStartData(userid:userId, rebill_no:rebill_no!, linkkey:linkKey)
        oApiSv.rebillStart(data:rebillStartData){ (result) in
            let data = Mapper<PARebillStartResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                print("정기 결제 승인 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    // MARK: - 회원 가입 Fucntion
    /*
     판매자 회원 가입
     */
    @IBAction func sellerRegistAction(_ sender: Any) {

        let sellerRegistData = PASellerRegistData(userid:userId, userpwd:"asdf1234", sellername:"newUserName", phone:recvPhone, email:email, bizkind:"서비스구분", usertype:"1", resellerid:"리셀러 아이디", join_type:"0", seller_type:"seller")
        
        
        
        /**
         * usertype : 판매자 구분 (개인:1, 사업자:2)
         */
        // 개인 필수
        sellerRegistData.username = "이름"

        // 사업자 필수
//        sellerRegistData.compregno = "사업자등록번호"
//        sellerRegistData.compname = "상호명"
//        sellerRegistData.biztype1 = "업태"
//        sellerRegistData.biztype2 = "업종"
//        sellerRegistData.ceo_nm = "대표자 성함"
        
        
        oApiSv.sellerRegist(data:sellerRegistData){ (result) in
            let data = Mapper<PASellerRegistResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                print("판매자 회원 가입 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /*
     판매자 아이디 중복 체크
     */
    @IBAction func useridCheckAction(_ sender: Any) {
        
        let useridCheckData = PAUseridCheckData(userid:userId, resellerid:"resllerid")
        
        oApiSv.useridCheck(data:useridCheckData){ (result) in
            let data = Mapper<PAUseridCheckResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                print("판매자 아이디 중복 체크 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /*
     부계정 등록
     */
    @IBAction func subidRegistAction(_ sender: Any) {

        let subidRegistData = PASubidRegistData(userid:userId, subuserid:"subuserid", subpwd:"asdf1234", subname:"부계정이름")
        
        oApiSv.subidRegist(data:subidRegistData){ (result) in
            let data = Mapper<PASubidRegistResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                print("부계정 등록 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    // MARK: - 현금영수증 Fucntion
    /*
     현금영수증 발행
     */
    @IBAction func cashStRegistAction(_ sender: Any) {

        let cashStRegistData = PACashStRegistData(userid: userId, linkkey: linkKey, good_name:"상품명", buyr_name:"구매자명", id_info:recvPhone, trad_time:getCurrentDateTime(), tr_code:"0", amt_tot:"1000", amt_sup:"910", amt_svc:"0", amt_tax:"90", corp_tax_type:"TG01")

        oApiSv.cashStRegist(data: cashStRegistData) { (result) in
            let data = Mapper<PACashStResponseData>().map(JSON: result as! [String : Any])!
            if data.state == ConstValue.TRUE_STR {
                self.cashstno = data.cashstno
                print("현금영수증 발행 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /*
     현금영수증 발행 취소
     */
    @IBAction func cashStCancelAction(_ sender: Any) {

        guard let cashstno = cashstno else {
            Toast(text: "cashstno를 확인하세요.").show()
            return
        }
        
        let cashStCancelData = PACashStCancelData(userid: userId, linkkey: linkKey, cashstno: cashstno)

        oApiSv.cashStCancel(data: cashStCancelData) { [self] (result) in
            let data = Mapper<PACashStCnResponseData>().map(JSON: result as! [String : Any])!
            
            if data.state == ConstValue.TRUE_STR {
                self.cashstno = nil
                print("현금영수증 발행 취소 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /*
     네이버페이 현금 영수증 발행 대상 금액 조회
        - 네이버페이로 결제된 주문건만 조회 가능합니다.
     */
    @IBAction func checkNpayCashReceiptReqAction(_ sender: Any) {
        
        if self.mul_no == nil {
            Toast(text: "mul_no를 확인하세요.").show()
            return
        }
        
        let checkNpayCashReceiptReqData = PACheckNpayCashReceiptReqData(userid:userId, mul_no:mul_no!)
        
        oApiSv.checkNpayCashReceiptReq(data:checkNpayCashReceiptReqData){ (result) in
            let data = Mapper<PACheckNpayCashReceiptReqResponseData>().map(JSON: result as! [String : Any])!
            
            if data.state == ConstValue.TRUE_STR {
                print("네이버페이 현금 영수증 발행 대상 금액 조회 : \(String(describing: data.toJSONString()))")
                self.success()
            } else {
                Toast(text: "\(String(describing: data.errorMessage!))").show()
            }
        }
    }
    
    /**
        Bill 결제 등록
     */
    @IBAction func billRegisterAction(_ sender: Any) {

        let billRegisterViewController = BillRegisterViewController()
        
        billRegisterViewController.modalPresentationStyle = .overCurrentContext
        billRegisterViewController.setUserId(userId: userId) { billData in
            
            print("billData :: \(billData)")
            self.billDatas.append(billData)
        }
        present(billRegisterViewController, animated: true, completion: nil)
    }
    
    /*
        Bill 리스트
     */
    @IBAction func billListAction(_ sender: Any) {
//
        let billListViewController = BillListViewController()
        billListViewController.setData(billDatas: billDatas) { billDatas in
            self.billDatas = billDatas
        }
        billListViewController.modalPresentationStyle = .overCurrentContext
        present(billListViewController, animated: true, completion: nil)
    }
    
    @IBAction func closeAction(_ sender: Any) {
        self.dismiss(animated: true, completion: nil)
    }

    func goWebView(_ url:String){
        let vc = PAWebViewController()
        vc.setUrl(url: url)
        vc.modalPresentationStyle = .fullScreen
        self.present(vc, animated:true, completion:nil)
    }
    
    // linkKey 가져오기 버튼
    @IBAction func linkKeyBtnAction(_ sender: Any) {
        goWebView("https://seller.payapp.kr/c/apiconnect_info")
    }
    
        
    // MARK: - TextFieldChanged
    @IBAction func userIdChanged(_ sender: Any) {
        userId = userIdTextField.text!
    }
        
    @IBAction func linkKeyChanged(_ sender: Any) {
        linkKey = linkKeyTextField.text!
    }
    
    
    @IBAction func recvPhoneChanged(_ sender: Any) {
        recvPhone = recvPhoneTextField.text!
    }
    
    
    @IBAction func emailChanged(_ sender: Any) {
        email = emailTextField.text!
    }
    
    @IBAction func dateChanged(_ sender: UIDatePicker) {
        let dp = sender
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        rebillExpire = formatter.string(from: dp.date)
    }
    
    
    // MARK: - TextFieldChanged End
    func addHideKeyboardWhenTappedAround() {
        let tap: UITapGestureRecognizer = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
    }
    
    @objc func dismissKeyboard() {
        view.endEditing(true)
    }
    
    
    // 성공 후 호출
    func success() {
        Toast(text: "success").show()
    }
    
    func getCurrentDateTime() -> String {
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        dateFormatter.locale = Locale(identifier: "ko_kr")
        dateFormatter.timeZone = NSTimeZone(name: "KST") as TimeZone?
        
        return dateFormatter.string(from: (Date())).replacingOccurrences(of: "[-: ]", with: "",options: .regularExpression)
    }
}
