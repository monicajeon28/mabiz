//
//  WebToAppViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/27.
//

import UIKit
import WebKit

class WebToAppViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {

    
    @IBOutlet weak var containerView: UIView!
    var wkWebView: WKWebView?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        guard let localHTMLFilePath = Bundle.main.path(forResource: "index", ofType: "html") else {
            print("no html")
            return
        }
        wkWebView = WKWebView(frame: containerView.frame)
        guard let wkWebView = wkWebView else {
            return
        }
        
        containerView.addSubview(wkWebView)
        wkWebView.translatesAutoresizingMaskIntoConstraints = false
        wkWebView.topAnchor.constraint(equalTo: containerView.topAnchor).isActive = true
        wkWebView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor).isActive = true
        wkWebView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor).isActive = true
        wkWebView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor).isActive = true
        
        wkWebView.uiDelegate = self
        wkWebView.navigationDelegate = self
        wkWebView.configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        let myRequest = URLRequest(url: URL(fileURLWithPath: localHTMLFilePath))
        
        wkWebView.load(myRequest)
    }
    
    
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        var urlString = navigationAction.request.url?.absoluteString ?? ""
        
        if urlString.starts(with: ConstValue.PAYAPP_UNIVERSAL_LINK) {
            urlString = urlString.replacingOccurrences(of:"returnUri=https://my_returnUrl.kr" , with: "returnUri=payappSampleV3://")
            openApp(urlString)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }
    
    func openApp(_ param:String) {
          
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
    
    
    
    
    
    
    override func viewWillAppear(_ animated: Bool) {
        addObserver()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        removeObserver()
    }
    
    func addObserver() {
        NotificationCenter.default.addObserver(self, selector: #selector(resultDataCall), name: NSNotification.Name(rawValue: ConstValue.NOTIFICATION_RESULT), object: nil)
    }
    
    func removeObserver() {
        NotificationCenter.default.removeObserver(self, name: NSNotification.Name(rawValue: ConstValue.NOTIFICATION_RESULT), object: nil)
    }
    
    @objc func resultDataCall(_ notification: NSNotification) {
        
        let resultData = notification.userInfo! as! [String : Any]
        print("WTA origine data : \(resultData)")
        
        let alert = UIAlertController(title: "WTA origine data", message: "\(resultData)", preferredStyle: UIAlertController.Style.alert)
        let close = UIAlertAction(title: "close", style: .cancel, handler : nil)
        alert.addAction(close)
        present(alert, animated: true, completion: nil)
        
    }
    
    @IBAction func closeAction(_ sender: Any) {
        self.dismiss(animated: true, completion: nil)
    }

}
