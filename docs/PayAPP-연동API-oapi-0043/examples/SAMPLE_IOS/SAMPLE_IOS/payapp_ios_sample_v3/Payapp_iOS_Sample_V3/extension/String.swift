//
//  String.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/23.
//

import Foundation
extension String {
    
    // ! $ \ ( ) * +  - . / : ; ? @ _ ~       <- 필요한 경우 추가작업
    func encodeSpecialChar() -> String {
        return self.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!
            .replacingOccurrences(of: "&", with: "%26")
            .replacingOccurrences(of: "=", with: "%3D")

    }
    
}
