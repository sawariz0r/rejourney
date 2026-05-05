//
//  RejourneyReplayMasked.swift
//  CountriesSwiftUI
//
//  Wraps SwiftUI content in a hosting controller whose root view is redacted in Rejourney session replay.
//

import Rejourney
import SwiftUI
import UIKit

/// SwiftUI container whose pixels are redacted in Rejourney replay (`Rejourney.mask`).
struct RejourneyReplayMasked<Content: View>: UIViewControllerRepresentable {
    @ViewBuilder var content: () -> Content

    func makeUIViewController(context: Context) -> MaskedHostingController<Content> {
        let controller = MaskedHostingController(rootView: content())
        controller.view.backgroundColor = .clear
        return controller
    }

    func updateUIViewController(_ controller: MaskedHostingController<Content>, context: Context) {
        controller.rootView = content()
    }

    static func dismantleUIViewController(_ controller: MaskedHostingController<Content>, coordinator: ()) {
        controller.applyUnmask()
    }
}

extension RejourneyReplayMasked {
    @MainActor
    final class MaskedHostingController<Root: View>: UIHostingController<Root> {
        private var didMask = false

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            guard !didMask else { return }
            didMask = true
            Rejourney.mask(view)
        }

        func applyUnmask() {
            guard didMask else { return }
            didMask = false
            Rejourney.unmask(view)
        }
    }
}
