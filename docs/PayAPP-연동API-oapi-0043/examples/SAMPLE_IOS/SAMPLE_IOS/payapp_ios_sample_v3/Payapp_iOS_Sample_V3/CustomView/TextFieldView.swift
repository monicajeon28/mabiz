//
//  TextFieldView.swift
//  Payapp_iOS_Sample_V3
//
//  Created by 조상현 on 2023/08/22.
//
 
import UIKit

class TextFieldView: UIView {
    
    @IBOutlet weak var titleLabel: UILabel!
    @IBOutlet weak var starLabel: UILabel!
    @IBOutlet weak var textField: UITextField!
    
    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        let nibName = String(describing: type(of: self))
        let nibs = Bundle.main.loadNibNamed(nibName, owner: self, options: nil)
        guard let customView = nibs?.first as? UIView else { return }
        customView.frame = self.bounds
        customView.autoresizingMask = [UIView.AutoresizingMask.flexibleWidth, UIView.AutoresizingMask.flexibleHeight]
        addSubview(customView)
    }
      
    func initUI(title: String, body: String = "", useStar: Bool = false, keyboardType: UIKeyboardType = .default) {
        titleLabel.text = title
        starLabel.isHidden = !useStar
        textField.text = body
         
        textField.keyboardType = keyboardType
        
        updateUI()
    }
    
    func changedTitle(title: String) {
        titleLabel.text = title
        
        updateUI()
    }
    
    private func updateUI() {
        titleLabel.sizeToFit()
        if !starLabel.isHidden {
            starLabel.frame.origin.x = titleLabel.frame.maxX + 5
        }
    }
    
    func getText() -> String {
        guard let text = textField?.text else {
            return ""
        }
        
        return text
    }
    
}
