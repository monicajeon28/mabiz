//
//  ViewController.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/22.
//

import UIKit

class ViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
    }
    
    /**
     * 페이앱을 연동한 Universal Link 결제
     */
    @IBAction func universalLinkAction(_ sender: Any) {
        let vc = UniversalLinkTabViewController()
        
        vc.modalPresentationStyle = .fullScreen
        present(vc, animated: true, completion: nil)
    }
    
    /**
     * Open Api 연동
     */
    @IBAction func oapiAction(_ sender: Any) {
        let vc = OAPIViewController()
        
        vc.modalPresentationStyle = .fullScreen
        present(vc, animated: true, completion: nil)
    }
    
    /**
     * Web To App 결제
     */
    @IBAction func webToAppAction(_ sender: Any) {
        let vc = WebToAppViewController()
        
        vc.modalPresentationStyle = .fullScreen
        present(vc, animated: true, completion: nil)
    }
}

