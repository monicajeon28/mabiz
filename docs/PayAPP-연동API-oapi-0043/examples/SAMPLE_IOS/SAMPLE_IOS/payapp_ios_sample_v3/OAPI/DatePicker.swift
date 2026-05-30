//
//  DatePicker.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/27.
//

import UIKit

class DatePicker: UIView {
    
    var changeClosure: ((Date)->())?
    var dismissClosure: (()->())?

    let picker: UIDatePicker = {
        let p = UIDatePicker()
        p.locale = Locale(identifier: "ko_KR")
        p.datePickerMode = .date
        return p
    }()
    
    let pickerHolderView: UIView = {
        let v = UIView()
        v.backgroundColor = .white
        v.layer.cornerRadius = 8
        return v
    }()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        makePicker()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        makePicker()
    }
    
    func makePicker() -> Void {
        
        let blurEffect = UIBlurEffect(style: .dark)
        let blurredEffectView = UIVisualEffectView(effect: blurEffect)

        [blurredEffectView, pickerHolderView, picker].forEach { v in
            v.translatesAutoresizingMaskIntoConstraints = false
        }

        addSubview(blurredEffectView)
        pickerHolderView.addSubview(picker)
        addSubview(pickerHolderView)
        
        NSLayoutConstraint.activate([
            
            blurredEffectView.topAnchor.constraint(equalTo: topAnchor),
            blurredEffectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            blurredEffectView.trailingAnchor.constraint(equalTo: trailingAnchor),
            blurredEffectView.bottomAnchor.constraint(equalTo: bottomAnchor),

            pickerHolderView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20.0),
            pickerHolderView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20.0),
            pickerHolderView.centerYAnchor.constraint(equalTo: centerYAnchor),

            picker.topAnchor.constraint(equalTo: pickerHolderView.topAnchor, constant: 20.0),
            picker.leadingAnchor.constraint(equalTo: pickerHolderView.leadingAnchor, constant: 20.0),
            picker.trailingAnchor.constraint(equalTo: pickerHolderView.trailingAnchor, constant: -20.0),
            picker.bottomAnchor.constraint(equalTo: pickerHolderView.bottomAnchor, constant: -20.0),

        ])
        
        if #available(iOS 14.0, *) {
            picker.preferredDatePickerStyle = .inline
        } else {
            // use default
        }
        
        picker.addTarget(self, action: #selector(didChangeDate(_:)), for: .valueChanged)
        
        let t = UITapGestureRecognizer(target: self, action: #selector(tapHandler(_:)))
        blurredEffectView.addGestureRecognizer(t)
    }
    
    @objc func tapHandler(_ g: UITapGestureRecognizer) -> Void {
        dismissClosure?()
    }
    
    @objc func didChangeDate(_ sender: UIDatePicker) -> Void {
        changeClosure?(sender.date)
        dismissClosure?()
    }

}
