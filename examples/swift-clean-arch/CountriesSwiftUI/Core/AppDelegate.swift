//
//  AppDelegate.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 23.10.2019.
//  Copyright © 2019 Alexey Naumov. All rights reserved.
//

import UIKit
import SwiftUI
import Combine
import Foundation

@MainActor
final class AppDelegate: UIResponder, UIApplicationDelegate {

    private lazy var environment = AppEnvironment.bootstrap()
    private var systemEventsHandler: SystemEventsHandler { environment.systemEventsHandler }

    var rootView: some View {
        environment.rootView
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions
        launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        RejourneyExample.configureAndStart()
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config: UISceneConfiguration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        SceneDelegate.register(systemEventsHandler)
        return config
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        RejourneyExample.logEvent("push_token_registered", properties: [
            "token_byte_count": deviceToken.count
        ])
        systemEventsHandler.handlePushRegistration(result: .success(deviceToken))
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        RejourneyExample.logEvent("push_token_registration_failed", properties: [
            "error_description": error.localizedDescription
        ])
        systemEventsHandler.handlePushRegistration(result: .failure(error))
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
        RejourneyExample.logEvent("remote_notification_received", properties: [
            "payload_key_count": userInfo.keys.count
        ])
        return await systemEventsHandler
            .appDidReceiveRemoteNotification(payload: userInfo)
    }
}

// MARK: - SceneDelegate

@MainActor
final class SceneDelegate: UIResponder, UIWindowSceneDelegate, ObservableObject {

    private static var systemEventsHandler: SystemEventsHandler?
    private var systemEventsHandler: SystemEventsHandler? { Self.systemEventsHandler }

    static func register(_ systemEventsHandler: SystemEventsHandler?) {
        Self.systemEventsHandler = systemEventsHandler
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            RejourneyExample.logEvent("deep_link_opened", properties: [
                "url_scheme": url.scheme ?? "unknown",
                "url_host": url.host ?? "unknown"
            ])
        }
        systemEventsHandler?.sceneOpenURLContexts(URLContexts)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        RejourneyExample.logEvent("scene_did_become_active")
        systemEventsHandler?.sceneDidBecomeActive()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        RejourneyExample.logEvent("scene_will_resign_active")
        systemEventsHandler?.sceneWillResignActive()
    }
}
