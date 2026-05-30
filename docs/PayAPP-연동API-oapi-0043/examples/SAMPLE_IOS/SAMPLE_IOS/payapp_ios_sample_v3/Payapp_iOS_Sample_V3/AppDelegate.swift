//
//  AppDelegate.swift
//  Payapp_iOS_Sample_V3
//
//  Created by Jin Won Kim on 2023/06/22.
//

import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
 
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }
    
    
    @available(iOS 9.0, *)
    open func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        var appToAppArr = [String:Any]()
        if let query = url.query {
            let urlEncoding = query.removingPercentEncoding
            let queryComponents = urlEncoding!.components(separatedBy: "&")
            
            
            for theComponent in queryComponents {
                let elements = theComponent.components(separatedBy: "=")
                let key = elements[0]
                let value = elements.count == 2 ? elements[1] : ""
                
                appToAppArr[key] = value
            }
        }
      
        NotificationCenter.default.post(name: NSNotification.Name(rawValue: ConstValue.NOTIFICATION_RESULT),  object: nil, userInfo: appToAppArr)
        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Called when a new scene session is being created.
        // Use this method to select a configuration to create the new scene with.
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // Called when the user discards a scene session.
        // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
        // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
    }


}

