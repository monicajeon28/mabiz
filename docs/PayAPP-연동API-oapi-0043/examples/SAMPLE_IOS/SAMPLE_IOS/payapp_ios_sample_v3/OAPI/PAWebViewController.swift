//
//  PAWebViewController.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import UIKit
import WebKit

class PAWebViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {

    /**
     * WebView 샘플입니다.
     * 앱제작사의 용도에 맞게 WebView를 새로 만들어 커스텀하세요.
     */
    
    @IBOutlet weak var containerView: UIView!
    
    var wkWebView: WKWebView?
    
    var url:String?
    
    public func setUrl(url:String) {
        self.url = url
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
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
        
        let request = URLRequest(url: URL(string: url!)!)
        wkWebView.load(request)
                
       
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, url.scheme != "http" && url.scheme != "https" {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }
   
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alertController = UIAlertController(title: "알림", message: message, preferredStyle: .alert)
        let cancelAction = UIAlertAction(title: "확인", style: .cancel) { _ in
            completionHandler()
        }
        alertController.addAction(cancelAction)
        DispatchQueue.main.async {
            self.present(alertController, animated: true, completion: nil)
        }
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alertController = UIAlertController(title: "알림", message: message, preferredStyle: .alert)
        let cancelAction = UIAlertAction(title: "취소", style: .cancel) { _ in
            completionHandler(false)
        }
        let okAction = UIAlertAction(title: "확인", style: .default) { _ in
            completionHandler(true)
        }
        alertController.addAction(cancelAction)
        alertController.addAction(okAction)
        DispatchQueue.main.async {
            self.present(alertController, animated: true, completion: nil)
        }
    }
    
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
                
        
        // target="blank"
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
            return nil
        }
     
        return webView
    }
    
        
    @IBAction func closeAction(_ sender: Any) {
        self.dismiss(animated: true, completion: nil)
    }
    
}
