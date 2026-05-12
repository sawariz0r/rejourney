/**
 * Copyright 2026 Rejourney
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import UIKit
import Foundation
import QuartzCore
import Accelerate
import AVFoundation

@objc(VisualCapture)
public final class VisualCapture: NSObject {
    
    @objc public static let shared = VisualCapture()
    
    @objc public var snapshotInterval: Double = 1.0
    @objc public var quality: CGFloat = 0.5
    /// Capture scale (e.g. 1.25 = capture at 80% linear size). Matches Android for parity; reduces JPEG size.
    @objc public var captureScale: CGFloat = 1.25
    
    @objc public var isCapturing: Bool {
        _stateMachine.currentState == .capturing
    }
    
    private let _stateMachine = CaptureStateMachine()
    private var _screenshots: [(Data, UInt64)] = []
    private let _stateLock = NSLock()
    private var _captureTimer: Timer?
    private var _frameCounter: UInt64 = 0
    private var _sessionEpoch: UInt64 = 0
    private var _redactionMask: RedactionMask
    private var _framesDiskPath: URL?
    private var _currentSessionId: String?
    @objc public private(set) var captureGeneration: Int = 0
    
    // Use OperationQueue like industry standard - serialized, utility QoS
    private let _encodeQueue: OperationQueue = {
        let q = OperationQueue()
        q.maxConcurrentOperationCount = 1
        q.qualityOfService = .utility
        q.name = "co.rejourney.encode"
        return q
    }()
    
    // Backpressure limits to prevent stutter
    private let _maxPendingBatches = 50
    private let _maxBufferedScreenshots = 500
    
    /// Flush to the network after this many frames (smaller = more frequent uploads).
    private var _uploadBatchSize = 3

    
    private override init() {
        _redactionMask = RedactionMask()
        super.init()
        _setupLifecycleObservers()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func _setupLifecycleObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(_handleBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(_handleForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }
    
    @objc private func _handleBackground() {
        // Stop capturing when app goes to background to prevent
        // "Rendering a view that is not in a visible window" warnings
        _stopCaptureTimer()
        
        // Flush any pending screenshots immediately before background
        // This ensures we don't lose data when app is backgrounded
        _sendScreenshots()
    }
    
    @objc private func _handleForeground() {
        // Resume capturing when app comes back to foreground
        if _stateMachine.currentState == .capturing {
            _startCaptureTimer()
        }
    }
    
    @objc public func beginCapture(sessionOrigin: UInt64) {
        // If still in CAPTURING state (halt() from previous session hasn't
        // run yet), force-halt first to prevent it from stopping the new session.
        if _stateMachine.currentState == .capturing {
            DiagnosticLog.trace("[VisualCapture] Force-halting stale capture before starting new session")
            _stopCaptureTimer()
            _ = _stateMachine.transition(to: .halted)
        }

        guard _stateMachine.transition(to: .capturing) else { return }

        // Bump generation so any stale halt() becomes a no-op
        captureGeneration += 1

        // Discard leftover frames from the previous session
        _stateLock.lock()
        let staleCount = _screenshots.count
        if staleCount > 0 {
            DiagnosticLog.trace("[VisualCapture] Clearing \(staleCount) stale frames from previous session")
            _screenshots.removeAll()
        }
        _stateLock.unlock()

        _sessionEpoch = sessionOrigin
        _frameCounter = 0
        
        // Set up disk persistence for frames
        _currentSessionId = TelemetryPipeline.shared.currentReplayId
        if let sid = _currentSessionId,
           let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
            _framesDiskPath = cacheDir.appendingPathComponent("rj_pending").appendingPathComponent(sid).appendingPathComponent("frames")
            try? FileManager.default.createDirectory(at: _framesDiskPath!, withIntermediateDirectories: true)
        }
        
        _startCaptureTimer()
        DispatchQueue.main.async { [weak self] in
            self?._captureFrame(forced: true)
        }
    }
    
    @objc public func halt(expectedGeneration: Int = -1) {
        // If a specific generation is expected (async/posted halt from a previous
        // session), skip if a new session has already started capture.
        if expectedGeneration >= 0 && expectedGeneration != captureGeneration {
            DiagnosticLog.trace("[VisualCapture] Skipping stale halt (gen=\(expectedGeneration), current=\(captureGeneration))")
            return
        }
        guard _stateMachine.transition(to: .halted) else { return }
        _stopCaptureTimer()
        
        // Flush any remaining frames to disk before halting
        _flushBufferToDisk()
        _flushBuffer()
        
        _stateLock.lock()
        _screenshots.removeAll()
        _stateLock.unlock()
    }
    
    /// Synchronously flush all pending frames to disk for crash safety
    @objc public func flushToDisk() {
        _flushBufferToDisk()
    }
    
    /// Submit any buffered frames to the upload pipeline immediately
    /// (regardless of batch size threshold). Packages synchronously to
    /// avoid race conditions during backgrounding.
    @objc public func flushBufferToNetwork() {
        _flushBuffer()
    }

    /// Blocks the calling thread until all pending encode operations finish.
    /// Used by the shutdown drain path to ensure frame bundles are enqueued
    /// in TelemetryPipeline._frameQueue before _shipPendingFrames runs.
    @objc public func waitForEncodingToComplete() {
        _encodeQueue.waitUntilAllOperationsAreFinished()
    }
    
    @objc public func registerRedaction(_ view: UIView) {
        _redactionMask.add(view)
    }
    
    @objc public func unregisterRedaction(_ view: UIView) {
        _redactionMask.remove(view)
    }
    
    @objc public func invalidateMaskCache() {
        _redactionMask.invalidateCache()
    }

    
    @objc public func configure(snapshotInterval: Double, jpegQuality: Double, captureScale: CGFloat = 1.25, uploadBatchSize: Int = 3) {
        self.snapshotInterval = snapshotInterval
        self.quality = CGFloat(jpegQuality)
        self.captureScale = max(1.0, captureScale)
        _uploadBatchSize = max(1, min(uploadBatchSize, 100))
        if _stateMachine.currentState == .capturing {
            _stopCaptureTimer()
            _startCaptureTimer()
        }
    }
    
    @objc public func snapshotNow() {
        DispatchQueue.main.async { [weak self] in
            self?._captureFrame(forced: true)
        }
    }
    
    private func _startCaptureTimer() {
        _stopCaptureTimer()
        _captureTimer = Timer.scheduledTimer(withTimeInterval: snapshotInterval, repeats: true) { [weak self] _ in
            self?._captureFrame()
        }
    }
    
    private func _stopCaptureTimer() {
        _captureTimer?.invalidate()
        _captureTimer = nil
    }
    
    private func _captureFrame(forced: Bool = false) {
        guard _stateMachine.currentState == .capturing else { return }
        
        // Skip capture if app is not in foreground (prevents "not in visible window" warnings)
        guard UIApplication.shared.applicationState == .active else { return }
        
        let frameStart = CFAbsoluteTimeGetCurrent()
        
        // Refresh map detection state (very cheap shallow walk)
        SpecialCases.shared.refreshMapState()
        
        if _frameCounter < 5 || _frameCounter % 30 == 0 {
            var info = mach_task_basic_info()
            var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
            let _ = withUnsafeMutablePointer(to: &info) {
                $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                    task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
                }
            }
            let memMB = Double(info.resident_size) / 1_048_576.0
            DiagnosticLog.trace("[VisualCapture] frame#\(_frameCounter) mapVisible=\(SpecialCases.shared.mapVisible) mapIdle=\(SpecialCases.shared.mapIdle) forced=\(forced) residentMB=\(String(format: "%.0f", memMB))")
        }
        
        // Map stutter prevention: when a map view is visible and its camera
        // is still moving (user gesture or animation), skip drawHierarchy
        // entirely — this is the call that causes GPU readback stutter on
        // Metal/OpenGL-backed map tiles.  We resume capture at 1 FPS once
        // the map SDK reports idle.
        if !forced && SpecialCases.shared.mapVisible && !SpecialCases.shared.mapIdle {
            DiagnosticLog.trace("[VisualCapture] SKIPPING frame (map moving)")
            return
        }
        
        // Capture the pixel buffer on the main thread (required by UIKit),
        // then move JPEG compression to the encode queue to reduce main-thread blocking.
        autoreleasepool {
            guard let window = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow }) else { return }
            let bounds = window.bounds
            // Guard against NaN and invalid bounds that cause CoreGraphics errors
            guard bounds.width > 0, bounds.height > 0 else { return }
            guard !bounds.width.isNaN && !bounds.height.isNaN else { return }
            guard bounds.width.isFinite && bounds.height.isFinite else { return }
            
            let captureWindows = _captureWindows(primary: window)
            let redactionRegions = _redactionMask.computeRegions(windows: captureWindows)
            let scale = max(1.0, captureScale)
            let scaledSize = CGSize(width: bounds.width / scale, height: bounds.height / scale)
            guard scaledSize.width >= 1, scaledSize.height >= 1 else {
                return
            }
            
            UIGraphicsBeginImageContextWithOptions(scaledSize, false, 1.0)
            guard let context = UIGraphicsGetCurrentContext() else {
                UIGraphicsEndImageContext()
                return
            }
            context.scaleBy(x: 1.0 / scale, y: 1.0 / scale)
            for captureWindow in captureWindows {
                let drawRect = captureWindow === window ? bounds : captureWindow.frame
                captureWindow.drawHierarchy(in: drawRect, afterScreenUpdates: false)
            }
            
            // Apply redactions inline while context is open
            if !redactionRegions.isEmpty {
                // Use fully opaque black for privacy masks (no transparency)
                context.setFillColor(UIColor.black.cgColor)
                for region in redactionRegions {
                    let r = region.rect
                    // Skip invalid rects that could cause CoreGraphics errors
                    guard r.width > 0 && r.height > 0 else { continue }
                    guard r.origin.x.isFinite && r.origin.y.isFinite && r.width.isFinite && r.height.isFinite else { continue }
                    guard !r.origin.x.isNaN && !r.origin.y.isNaN && !r.width.isNaN && !r.height.isNaN else { continue }
                    context.fill(r)
                    if region.kind == .camera {
                        _drawCameraMaskIndicator(in: r, context: context)
                    }
                }
            }
            
            guard let image = UIGraphicsGetImageFromCurrentImageContext() else {
                UIGraphicsEndImageContext()
                return
            }
            UIGraphicsEndImageContext()
            
            let captureTs = UInt64(Date().timeIntervalSince1970 * 1000)
            _frameCounter += 1
            let frameNumber = _frameCounter
            let jpegQuality = quality
            let generation = captureGeneration
            
            // Move JPEG compression off the main thread.
            // drawHierarchy must be on main, but jpegData is thread-safe and
            // accounts for ~40-60% of per-frame main-thread cost.
            _encodeQueue.addOperation { [weak self] in
                guard let self else { return }
                guard let data = image.jpegData(compressionQuality: jpegQuality) else { return }
                
                // Log frame timing every 30 frames to avoid log spam
                if frameNumber % 30 == 0 {
                    let frameDurationMs = (CFAbsoluteTimeGetCurrent() - frameStart) * 1000
                    DiagnosticLog.perfFrame(operation: "screenshot", durationMs: frameDurationMs, frameNumber: Int(frameNumber), isMainThread: Thread.isMainThread)
                }
                
                // Store in buffer (fast operation)
                self._stateLock.lock()
                guard generation == self.captureGeneration, self._stateMachine.currentState == .capturing else {
                    self._stateLock.unlock()
                    return
                }
                self._screenshots.append((data, captureTs))
                self._enforceScreenshotCaps()
                let count = self._screenshots.count
                let shouldSend = forced || count >= self._uploadBatchSize
                // Time-based flush: if frames have been sitting for longer than one full
                // batch interval, send regardless of count. This ensures sessions that end
                // before reaching uploadBatchSize frames (very short sessions) still ship
                // their frames promptly rather than waiting for shutdown.
                let shouldFlushByTime: Bool
                if !shouldSend, count > 0, let oldestTs = self._screenshots.first?.1 {
                    let waitMs = captureTs > oldestTs ? captureTs - oldestTs : 0
                    let thresholdMs = UInt64(Double(self._uploadBatchSize) * self.snapshotInterval * 1_000)
                    shouldFlushByTime = waitMs >= thresholdMs
                } else {
                    shouldFlushByTime = false
                }
                self._stateLock.unlock()

                if shouldSend || shouldFlushByTime {
                    self._sendScreenshots()
                }
            }
        }
    }

    private func _captureWindows(primary: UIWindow) -> [UIWindow] {
        guard ReplayOrchestrator.shared.captureNativeSheets else {
            return [primary]
        }
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .filter { window in
                if window.isHidden || window.alpha <= 0.01 || window.bounds.width <= 0 || window.bounds.height <= 0 {
                    return false
                }
                if window === primary {
                    return true
                }
                let className = String(describing: type(of: window))
                if ReplayOrchestrator.shared.maskTextInputsByDefault && _isKeyboardOrTextInputWindow(className) {
                    return false
                }
                return window.screen == primary.screen
            }
            .sorted { lhs, rhs in
                if lhs.windowLevel == rhs.windowLevel {
                    return lhs === primary
                }
                return lhs.windowLevel.rawValue < rhs.windowLevel.rawValue
            }
        return windows.contains(where: { $0 === primary }) ? windows : [primary] + windows
    }

    private func _isKeyboardOrTextInputWindow(_ className: String) -> Bool {
        className.contains("UIRemoteKeyboardWindow") ||
        className.contains("UITextEffectsWindow") ||
        className.contains("UIInputSetHostView") ||
        className.contains("UIKeyboard")
    }

    private func _drawCameraMaskIndicator(in rect: CGRect, context: CGContext) {
        let minSide = min(rect.width, rect.height)
        guard minSide >= 44 else { return }

        let iconSize = min(CGFloat(64), max(CGFloat(28), minSide * 0.24))
        let bodyWidth = iconSize
        let bodyHeight = iconSize * 0.62
        let body = CGRect(
            x: rect.midX - bodyWidth / 2,
            y: rect.midY - bodyHeight / 2,
            width: bodyWidth,
            height: bodyHeight
        )
        let lineWidth = max(CGFloat(2), iconSize * 0.06)
        let strokeColor = UIColor.white.withAlphaComponent(0.82)

        context.saveGState()
        strokeColor.setStroke()
        strokeColor.setFill()

        let bodyPath = UIBezierPath(roundedRect: body, cornerRadius: max(CGFloat(4), iconSize * 0.1))
        bodyPath.lineWidth = lineWidth
        bodyPath.stroke()

        let bump = CGRect(
            x: body.minX + iconSize * 0.18,
            y: body.minY - iconSize * 0.13,
            width: iconSize * 0.24,
            height: iconSize * 0.18
        )
        let bumpPath = UIBezierPath(roundedRect: bump, cornerRadius: max(CGFloat(2), iconSize * 0.04))
        bumpPath.lineWidth = lineWidth
        bumpPath.stroke()

        let lensRadius = iconSize * 0.16
        let lens = CGRect(
            x: rect.midX - lensRadius,
            y: rect.midY - lensRadius,
            width: lensRadius * 2,
            height: lensRadius * 2
        )
        let lensPath = UIBezierPath(ovalIn: lens)
        lensPath.lineWidth = lineWidth
        lensPath.stroke()

        let dotRadius = max(CGFloat(1.6), iconSize * 0.035)
        let dot = CGRect(
            x: body.maxX - iconSize * 0.2 - dotRadius,
            y: body.minY + iconSize * 0.16 - dotRadius,
            width: dotRadius * 2,
            height: dotRadius * 2
        )
        UIBezierPath(ovalIn: dot).fill()
        context.restoreGState()
    }

    
    /// Enforce memory caps to prevent unbounded growth (industry standard backpressure)
    private func _enforceScreenshotCaps() {
        // Called with lock held
        if _screenshots.count > _maxBufferedScreenshots {
            _screenshots.removeFirst(_screenshots.count - _maxBufferedScreenshots)
        }
    }
    
    /// Send screenshots to server - runs on OperationQueue to avoid blocking main thread
    private func _sendScreenshots() {
        // Check backpressure first - drop if too backed up (prevents stutter)
        guard _encodeQueue.operationCount <= _maxPendingBatches else {
            DiagnosticLog.trace("Dropping screenshot batch due to backlog")
            return
        }
        
        // Copy and clear under lock (fast operation)
        _stateLock.lock()
        let images = _screenshots
        _screenshots.removeAll()
        let sessionEpoch = _sessionEpoch
        let captureSessionId = _currentSessionId
        _stateLock.unlock()
        
        guard !images.isEmpty else { return }
        
        // All heavy work (package, gzip, network) happens in background queue
        _encodeQueue.addOperation { [weak self] in
            self?._packageAndShip(images: images, sessionEpoch: sessionEpoch, sessionId: captureSessionId)
        }
    }
    
    private func _packageAndShip(images: [(Data, UInt64)], sessionEpoch: UInt64, sessionId: String?) {
        let batchStart = CFAbsoluteTimeGetCurrent()
        
        guard let bundle = _packageFrameBundle(images: images, sessionEpoch: sessionEpoch) else { return }
        
        let rid = sessionId ?? "unknown"
        let endTs = images.last?.1 ?? sessionEpoch
        let fname = "\(rid)-\(endTs).tar.gz"
        
        let packDurationMs = (CFAbsoluteTimeGetCurrent() - batchStart) * 1000
        DiagnosticLog.perfBatch(operation: "package-frames", itemCount: images.count, totalMs: packDurationMs, isMainThread: Thread.isMainThread)
        
        // Submit directly - no main thread dispatch needed
        TelemetryPipeline.shared.submitFrameBundle(
            payload: bundle,
            filename: fname,
            startMs: images.first?.1 ?? sessionEpoch,
            endMs: endTs,
            frameCount: images.count,
            sessionId: sessionId
        )
    }
    
    private func _writeFrameToDisk(jpeg: Data, timestamp: UInt64) {
        guard let path = _framesDiskPath else { return }
        let framePath = path.appendingPathComponent("\(timestamp).jpeg")
        try? jpeg.write(to: framePath)
    }
    
    private func _flushBufferToDisk() {
        // Package any frames still in memory to disk
        _stateLock.lock()
        let frames = _screenshots
        _stateLock.unlock()
        
        guard !frames.isEmpty, let path = _framesDiskPath else { return }
        
        for (jpeg, timestamp) in frames {
            let framePath = path.appendingPathComponent("\(timestamp).jpeg")
            if !FileManager.default.fileExists(atPath: framePath.path) {
                try? jpeg.write(to: framePath)
            }
        }
    }
    
    /// Load and upload any pending frames from disk for a session
    @objc public func uploadPendingFrames(sessionId: String) {
        uploadPendingFrames(sessionId: sessionId, sessionEpoch: nil, completion: nil)
    }
    
    public func uploadPendingFrames(sessionId: String, sessionEpoch: UInt64? = nil, completion: ((Bool) -> Void)? = nil) {
        guard let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            completion?(false)
            return
        }
        let framesPath = cacheDir.appendingPathComponent("rj_pending").appendingPathComponent(sessionId).appendingPathComponent("frames")
        
        guard let frameFiles = try? FileManager.default.contentsOfDirectory(at: framesPath, includingPropertiesForKeys: nil) else {
            completion?(true)
            return
        }
        
        var frames: [(Data, UInt64)] = []
        for file in frameFiles.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            guard file.pathExtension == "jpeg",
                  let data = try? Data(contentsOf: file) else { continue }
            
            // Try to parse timestamp from filename
            let filename = file.deletingPathExtension().lastPathComponent
            let ts = UInt64(filename) ?? 0
            guard ts > 0 else { continue }
            
            frames.append((data, ts))
        }
        
        let recoveryEpoch = sessionEpoch ?? frames.first?.1 ?? 0
        guard !frames.isEmpty, let bundle = _packageFrameBundle(images: frames, sessionEpoch: recoveryEpoch) else {
            completion?(frames.isEmpty)
            return
        }
        
        let endTs = frames.last?.1 ?? 0
        
        SegmentDispatcher.shared.transmitFrameBundle(
            for: sessionId,
            payload: bundle,
            startMs: frames.first?.1 ?? 0,
            endMs: endTs,
            frameCount: frames.count
        ) { ok in
            if ok {
                try? FileManager.default.removeItem(at: framesPath)
            }
            completion?(ok)
        }
    }
    
    /// Clear pending frames for a session after successful upload
    @objc public func clearPendingFrames(sessionId: String) {
        guard let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let framesPath = cacheDir.appendingPathComponent("rj_pending").appendingPathComponent(sessionId).appendingPathComponent("frames")
        try? FileManager.default.removeItem(at: framesPath)
    }
    
    private func _flushBuffer() {
        _stateLock.lock()
        let frames = _screenshots
        _screenshots.removeAll()
        let captureSessionId = _currentSessionId
        _stateLock.unlock()
        
        guard !frames.isEmpty else { return }
        
        // Clear the disk copies since we're uploading
        if let path = _framesDiskPath {
            for (_, timestamp) in frames {
                let framePath = path.appendingPathComponent("\(timestamp).jpeg")
                try? FileManager.default.removeItem(at: framePath)
            }
        }
        
        guard let bundle = _packageFrameBundle(images: frames, sessionEpoch: _sessionEpoch) else { return }
        
        let rid = captureSessionId ?? "unknown"
        let endTs = frames.last?.1 ?? _sessionEpoch
        let fname = "\(rid)-\(endTs).tar.gz"
        
        // No main thread dispatch - submit directly (fixes stutter)
        TelemetryPipeline.shared.submitFrameBundle(
            payload: bundle,
            filename: fname,
            startMs: frames.first?.1 ?? _sessionEpoch,
            endMs: endTs,
            frameCount: frames.count,
            sessionId: captureSessionId
        )
    }
    
    /// Android-compatible binary format: [8-byte BE timestamp offset][4-byte BE size][jpeg] per frame. Backend auto-detects.
    private func _packageFrameBundle(images: [(Data, UInt64)], sessionEpoch: UInt64) -> Data? {
        var archive = Data()
        for (jpeg, timestamp) in images {
            let tsOffset = timestamp - sessionEpoch
            archive.append(_uint64BigEndian(tsOffset))
            archive.append(_uint32BigEndian(UInt32(jpeg.count)))
            archive.append(jpeg)
        }
        return archive.gzipCompress()
    }
    
    private func _uint64BigEndian(_ value: UInt64) -> Data {
        Data([
            UInt8((value >> 56) & 0xff),
            UInt8((value >> 48) & 0xff),
            UInt8((value >> 40) & 0xff),
            UInt8((value >> 32) & 0xff),
            UInt8((value >> 24) & 0xff),
            UInt8((value >> 16) & 0xff),
            UInt8((value >> 8) & 0xff),
            UInt8(value & 0xff)
        ])
    }
    
    private func _uint32BigEndian(_ value: UInt32) -> Data {
        Data([
            UInt8((value >> 24) & 0xff),
            UInt8((value >> 16) & 0xff),
            UInt8((value >> 8) & 0xff),
            UInt8(value & 0xff)
        ])
    }
}

private enum CaptureState { case idle, capturing, halted }

private final class CaptureStateMachine {
    private var _state: CaptureState = .idle
    private let _lock = NSLock()
    
    var currentState: CaptureState {
        _lock.lock()
        defer { _lock.unlock() }
        return _state
    }
    
    func transition(to target: CaptureState) -> Bool {
        _lock.lock()
        defer { _lock.unlock() }
        switch (_state, target) {
        case (.idle, .capturing), (.halted, .capturing), (.capturing, .halted):
            _state = target
            return true
        default:
            return _state == target
        }
    }
}

private enum RedactionMaskKind {
    case generic
    case camera
}

private struct RedactionRegion {
    let rect: CGRect
    let kind: RedactionMaskKind
}

private final class RedactionMask {
    private var _explicitViews = NSHashTable<UIView>.weakObjects()
    private let _lock = NSLock()
    
    // Cache the hierarchy scan results to avoid scanning every frame.
    // The full recursive scan runs String(describing: type(of:)) reflection
    // on every view in the key window, which is expensive in React Native
    // hierarchies (thousands of views). Caching for ~1s is safe because
    // sensitive views (text inputs, cameras) don't appear/disappear at 3fps.
    private var _cachedAutoRegions: [RedactionRegion] = []
    private var _lastScanTime: CFAbsoluteTime = 0
    private let _scanCacheDurationSec: CFAbsoluteTime = 0.5
    
    private var _observers: [Any] = []
    
    init() {
        _observers.append(NotificationCenter.default.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: nil) { [weak self] _ in self?.invalidateCache() })
        _observers.append(NotificationCenter.default.addObserver(forName: UIResponder.keyboardWillHideNotification, object: nil, queue: nil) { [weak self] _ in self?.invalidateCache() })
        _observers.append(NotificationCenter.default.addObserver(forName: UITextField.textDidChangeNotification, object: nil, queue: nil) { [weak self] _ in self?.invalidateCache() })
        _observers.append(NotificationCenter.default.addObserver(forName: UITextView.textDidChangeNotification, object: nil, queue: nil) { [weak self] _ in self?.invalidateCache() })
    }
    
    deinit {
        for observer in _observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }
    
    func invalidateCache() {
        _lock.lock()
        _lastScanTime = 0
        _lock.unlock()
    }
    
    // View class names that should always be masked (privacy sensitive)
    private let _alwaysSensitiveClassNames: Set<String> = [
        // Camera views
        "AVCaptureVideoPreviewLayer",
        "CameraView",
        "RCTCameraView",
        "ExpoCamera",
        "EXCameraView",
    ]

    private let _textInputClassNames: Set<String> = [
        // React Native text inputs (internal class names)
        "RCTSinglelineTextInputView",
        "RCTMultilineTextInputView", 
        "RCTTextInput",
        "RCTBaseTextInputView",
        "RCTUITextField",
        // Expo text inputs
        "EXTextInput"
    ]
    
    func add(_ view: UIView) {
        _lock.lock()
        defer { _lock.unlock() }
        _explicitViews.add(view)
    }
    
    func remove(_ view: UIView) {
        _lock.lock()
        defer { _lock.unlock() }
        _explicitViews.remove(view)
    }
    
    func computeRegions(windows: [UIWindow]? = nil) -> [RedactionRegion] {
        _lock.lock()
        let explicitViews = _explicitViews.allObjects
        _lock.unlock()
        
        var regions: [RedactionRegion] = []
        regions.reserveCapacity(explicitViews.count + 20)
        
        // 1. Add explicitly registered views (always fresh — these are few)
        for v in explicitViews {
            if let rect = _viewRect(v) {
                regions.append(RedactionRegion(rect: rect, kind: .generic))
            }
        }
        
        // 2. Auto-detect sensitive views from a cached hierarchy scan.
        //    The full recursive scan is expensive (String(describing:) reflection
        //    on every view) so we cache results for ~1s. Explicit views above
        //    are always re-evaluated, so newly focused inputs still get masked.
        let now = CFAbsoluteTimeGetCurrent()
        if now - _lastScanTime >= _scanCacheDurationSec {
            _cachedAutoRegions.removeAll()
            let scanWindows = windows ?? _keyWindow().map { [$0] } ?? []
            for window in scanWindows {
                _scanForSensitiveViews(in: window, regions: &_cachedAutoRegions)
            }
            _lastScanTime = now
        }
        regions.append(contentsOf: _cachedAutoRegions)
        
        return regions
    }
    
    private func _viewRect(_ v: UIView) -> CGRect? {
        guard let w = v.window else { return nil }
        
        // Skip non-key windows unless native sheet capture is explicitly enabled.
        // These have transitional layer transforms during animation that cause
        // UIView.convert() to pass NaN to CoreGraphics internally, producing
        // "invalid numeric value (NaN)" errors that we cannot catch because
        // CoreGraphics logs the error before the return value is available.
        if !w.isKeyWindow && !ReplayOrchestrator.shared.captureNativeSheets { return nil }
        
        // Guard against views with invalid bounds before conversion
        let viewBounds = v.bounds
        guard viewBounds.width > 0 && viewBounds.height > 0 else { return nil }
        guard viewBounds.width.isFinite && viewBounds.height.isFinite else { return nil }
        guard !viewBounds.width.isNaN && !viewBounds.height.isNaN else { return nil }
        guard viewBounds.origin.x.isFinite && viewBounds.origin.y.isFinite else { return nil }
        guard !viewBounds.origin.x.isNaN && !viewBounds.origin.y.isNaN else { return nil }
        
        // During animation, convert() internally passes NaN to CoreGraphics
        // which logs an error even though we guard the output. Skip animated views.
        if v.layer.animationKeys()?.isEmpty == false {
            return nil
        }
        
        // Also check the view's layer transform — keyboard views during transition
        // can have a transform with NaN or degenerate values that cause convert()
        // to produce NaN internally in CoreGraphics before we can catch the result.
        let t = v.layer.transform
        if t.m11.isNaN || t.m22.isNaN || t.m33.isNaN || t.m44.isNaN ||
           t.m41.isNaN || t.m42.isNaN || t.m43.isNaN {
            return nil
        }
        // Degenerate transform (scale=0) will produce zero-area results
        if t.m11 == 0 && t.m22 == 0 {
            return nil
        }
        
        // Also check the window's transform for safety (keyboard windows can have odd transforms)
        let wt = w.layer.transform
        if wt.m11.isNaN || wt.m22.isNaN || wt.m41.isNaN || wt.m42.isNaN {
            return nil
        }
        
        let r = v.convert(viewBounds, to: w)
        // Guard against NaN and invalid values that cause CoreGraphics errors
        guard r.width > 0 && r.height > 0 else { return nil }
        guard !r.origin.x.isNaN && !r.origin.y.isNaN && !r.width.isNaN && !r.height.isNaN else { return nil }
        guard r.origin.x.isFinite && r.origin.y.isFinite && r.width.isFinite && r.height.isFinite else { return nil }
        if w.isKeyWindow {
            return r
        }
        return r.offsetBy(dx: w.frame.origin.x, dy: w.frame.origin.y)
    }
    
    /// Fallback rect computation for views that have active CoreAnimation keys.
    /// Used only for views explicitly marked for masking (accessibilityHint =
    /// "rejourney_occlude") where we must produce a rect even during animations,
    /// such as when a map page triggers layout animations on the Mask wrapper.
    ///
    /// Uses CALayer.presentation() to get the current rendered frame, which avoids
    /// the UIView.convert() NaN issue that affects keyboard-window views. Regular
    /// RCTViews never produce NaN transforms, so this path is safe for app-layer views.
    private func _viewRectAnimationSafe(_ v: UIView) -> CGRect? {
        guard let w = v.window, w.isKeyWindow else { return nil }
        guard v.bounds.width > 0, v.bounds.height > 0 else { return nil }

        // Use the presentation layer (current animated state) so the mask covers
        // where the view is visually rendered right now, not its final model position.
        let layer = v.layer.presentation() ?? v.layer
        let frameInWindow = layer.convert(layer.bounds, to: w.layer)

        guard frameInWindow.width > 0, frameInWindow.height > 0 else { return nil }
        guard frameInWindow.origin.x.isFinite, frameInWindow.origin.y.isFinite,
              frameInWindow.width.isFinite, frameInWindow.height.isFinite else { return nil }
        guard !frameInWindow.origin.x.isNaN, !frameInWindow.origin.y.isNaN,
              !frameInWindow.width.isNaN, !frameInWindow.height.isNaN else { return nil }
        return frameInWindow
    }

    private func _keyWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
    
    private func _scanForSensitiveViews(in view: UIView, regions: inout [RedactionRegion], depth: Int = 0) {
        // Limit recursion depth to avoid scanning deep hierarchies.
        // Expo Router + React Navigation stack/tab navigators create 25+ levels
        // before reaching screen content, so 20 was too shallow to find Mask wrappers.
        guard depth < 60 else { return }
        
        // Skip hidden, transparent, or zero-sized views entirely
        guard !view.isHidden && view.alpha > 0.01 else { return }
        guard view.bounds.width > 0 && view.bounds.height > 0 else { return }
        
        // Skip keyboard windows entirely — their internal views have
        // transitional frames during animation that produce NaN when
        // converted via UIView.convert(_:to:), causing CoreGraphics
        // "invalid numeric value (NaN)" errors. Keyboard content is
        // not meaningful for session replay and is never recorded.
        let className = String(describing: type(of: view))
        if className.contains("UIRemoteKeyboardWindow") ||
           className.contains("UITextEffectsWindow") ||
           className.contains("UIInputSetHostView") ||
           className.contains("UIKeyboard") {
            return
        }
        
        // Check if this view should be masked.
        // IMPORTANT: always stop recursing into a masked view's children regardless
        // of whether we can compute its rect — we never want to expose child content
        // of a Mask wrapper (e.g. when the view has active animation keys during map
        // loading or a screen transition).
        if let maskKind = _maskKind(view) {
            // Primary: full validation path (skips views with active animation keys)
            if let rect = _viewRect(view) {
                regions.append(RedactionRegion(rect: rect, kind: maskKind))
            } else if let rect = _viewRectAnimationSafe(view) {
                // Fallback for views currently animating (e.g. Mask wrapper on a map
                // page where map load triggers CoreAnimation layout updates on parent
                // views). Uses CALayer.presentation() for the current rendered frame
                // instead of skipping the view entirely.
                regions.append(RedactionRegion(rect: rect, kind: maskKind))
            }
            return // Always stop — never recurse into children of a masked view
        }

        // Recurse into subviews
        for subview in view.subviews {
            _scanForSensitiveViews(in: subview, regions: &regions, depth: depth + 1)
        }
    }
    
    private func _maskKind(_ view: UIView) -> RedactionMaskKind? {
        if view.accessibilityHint == "rejourney_occlude" {
            return .generic
        }
        // Fallback: nativeID maps to accessibilityIdentifier and is always set
        // regardless of the accessible prop. Covers RN New Architecture / Bridgeless
        // mode where accessibilityHint may not be propagated when accessible={false}.
        if view.accessibilityIdentifier?.hasPrefix("rj_occlude") == true {
            return .generic
        }
        
        // Secure fields are always masked, even when ordinary text input masking is relaxed.
        if let textField = view as? UITextField, textField.isSecureTextEntry {
            return .generic
        }

        // 1. Mask ALL text input fields by default (privacy first)
        // This includes password fields, instructions, notes, etc.
        if view is UITextField {
            return ReplayOrchestrator.shared.maskTextInputsByDefault ? .generic : nil
        }
        
        // 2. Mask ALL text views (multiline inputs like instructions, notes, etc.)
        if view is UITextView {
            return ReplayOrchestrator.shared.maskTextInputsByDefault ? .generic : nil
        }
        
        // 3. Check class name against known sensitive types
        let className = String(describing: type(of: view))
        if _alwaysSensitiveClassNames.contains(className) {
            return _isCameraView(view, className: className) ? .camera : .generic
        }
        if ReplayOrchestrator.shared.maskTextInputsByDefault && _textInputClassNames.contains(className) {
            return .generic
        }

        // 4. Check camera previews separately so the replay can annotate them.
        if _isCameraView(view, className: className) {
            return .camera
        }

        return nil
    }

    private func _isCameraView(_ view: UIView, className: String? = nil) -> Bool {
        let resolvedClassName = className ?? String(describing: type(of: view))
        if _alwaysSensitiveClassNames.contains(resolvedClassName) {
            return true
        }

        let lowerClassName = resolvedClassName.lowercased()
        if lowerClassName.contains("camera") || lowerClassName.contains("preview") {
            // Verify it's actually a camera preview, not just any view with "camera" in name
            if lowerClassName.contains("video") || lowerClassName.contains("capture") ||
                lowerClassName.contains("avcapture") || view.layer is AVCaptureVideoPreviewLayer {
                return true
            }
        }

        // Check layer type for camera preview layers
        if view.layer.sublayers?.contains(where: { $0 is AVCaptureVideoPreviewLayer }) == true {
            return true
        }

        return false
    }
}
