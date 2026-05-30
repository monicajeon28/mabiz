//
//  HttpRequestManager.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import UIKit
import Alamofire

class HttpRequestManager: NSObject {
    
    func WebRequest(params:[String: AnyObject], handler: @escaping (_ result:Any) -> Void) {
                 
        for param in params {
            print("\(param.key) = \(param.value)")
        }

        if let jsonData = try? JSONSerialization.data(withJSONObject: params) {
            print("@@@ parameter : \(String(data: jsonData, encoding: .utf8) ?? "")")
        }

        Alamofire.request(ConstValue.BASE_URL,
                          method: .post,
                          parameters: params,
                          encoding: URLEncoding.default).responseString { [self] response in
            print("OAPI origin data : \(queryDictionary(query:response.result.value!))")
            handler(queryDictionary(query:response.result.value!))
        }
    }
    
    func queryDictionary(query:String) -> [String: Any] {

        var queryStrings = [String: String]()
        for pair in query.components(separatedBy: "&") {

            let key = pair.components(separatedBy: "=")[0]

            let value = pair
                .components(separatedBy:"=")[1]
                .replacingOccurrences(of: "+", with: " ")
                .removingPercentEncoding ?? ""
            queryStrings[key] = value
        }
        return queryStrings
    }
    
 

}
