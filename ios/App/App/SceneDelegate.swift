import UIKit
import Capacitor

final class ManifestBridgeViewController: CAPBridgeViewController {
    private let statusBarCover = UIView()

    override func viewDidLoad() {
        super.viewDidLoad()

        statusBarCover.backgroundColor = UIColor(
            red: 17.0 / 255.0,
            green: 19.0 / 255.0,
            blue: 24.0 / 255.0,
            alpha: 1.0
        )
        statusBarCover.isUserInteractionEnabled = false
        statusBarCover.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusBarCover)

        NSLayoutConstraint.activate([
            statusBarCover.topAnchor.constraint(equalTo: view.topAnchor),
            statusBarCover.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            statusBarCover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            statusBarCover.bottomAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.topAnchor
            ),
        ])
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = ManifestBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
