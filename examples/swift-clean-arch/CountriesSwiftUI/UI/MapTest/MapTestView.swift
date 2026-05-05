//
//  MapTestView.swift
//  CountriesSwiftUI
//
//  Created by Rejourney on 5/4/26.
//

import MapKit
import SwiftUI

struct MapTestView: View {

    @State private var cameraPosition: MapCameraPosition = .region(Self.chicagoRegion)
    @State private var selectedPin: TestPin.ID?
    @State private var droppedPins: [TestPin] = []
    @State private var tick = 0
    @State private var isAnimatingObjects = true

    private let timer = Timer.publish(every: 1.1, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            Map(position: $cameraPosition, selection: $selectedPin) {
                ForEach(Self.staticPins + droppedPins) { pin in
                    Marker(pin.title, systemImage: pin.systemImage, coordinate: pin.coordinate)
                        .tint(pin.tint)
                        .tag(pin.id)
                }

                ForEach(movingObjects) { object in
                    Annotation(object.title, coordinate: object.coordinate) {
                        MovingMapObjectBadge(object: object)
                            .onTapGesture {
                                RejourneyExample.logEvent("map_moving_object_tapped", properties: [
                                    "object_id": object.id,
                                    "title": object.title
                                ])
                            }
                    }
                    .annotationTitles(.hidden)
                }
            }
            .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .including([.airport, .cafe, .restaurant, .store, .theater])))
            .mapControls {
                MapCompass()
                MapScaleView()
                MapPitchToggle()
            }
            .safeAreaInset(edge: .bottom) {
                mapControlPanel
            }
            .navigationTitle("Map Test")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: recenterMap) {
                        Label("Recenter", systemImage: "location")
                    }
                }
            }
            .onAppear {
                RejourneyExample.trackScreen("Apple Maps Test")
            }
            .onReceive(timer) { _ in
                guard isAnimatingObjects else { return }
                withAnimation(.linear(duration: 1.0)) {
                    tick += 1
                }
            }
            .onChange(of: selectedPin) { _, id in
                guard let pin = (Self.staticPins + droppedPins).first(where: { $0.id == id }) else { return }
                RejourneyExample.logEvent("map_pin_selected", properties: [
                    "pin_id": pin.id.uuidString,
                    "title": pin.title,
                    "latitude": pin.coordinate.latitude,
                    "longitude": pin.coordinate.longitude
                ])
            }
        }
    }

    private var movingObjects: [MovingMapObject] {
        Self.movingRoutes.map { route in
            MovingMapObject(
                id: route.id,
                title: route.title,
                systemImage: route.systemImage,
                tint: route.tint,
                coordinate: route.coordinate(at: tick)
            )
        }
    }

    private var mapControlPanel: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Button(action: addDroppedPin) {
                    Label("Drop Pin", systemImage: "mappin.and.ellipse")
                }
                .buttonStyle(.borderedProminent)

                Button(action: toggleMovingObjects) {
                    Label(isAnimatingObjects ? "Pause" : "Move", systemImage: isAnimatingObjects ? "pause.fill" : "play.fill")
                }
                .buttonStyle(.bordered)

                Button(action: jumpToRiverwalk) {
                    Label("River", systemImage: "water.waves")
                }
                .buttonStyle(.bordered)
            }
            .labelStyle(.iconOnly)

            Text(statusText)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(.regularMaterial)
    }

    private var statusText: String {
        if let selectedPin,
           let pin = (Self.staticPins + droppedPins).first(where: { $0.id == selectedPin }) {
            return "Selected \(pin.title). Moving objects: \(isAnimatingObjects ? "active" : "paused")."
        }
        return "Pins, custom annotations, map controls, camera moves, and animated objects are active."
    }

    private func addDroppedPin() {
        let next = droppedPins.count + 1
        let coordinate = CLLocationCoordinate2D(
            latitude: 41.8781 + Double.random(in: -0.018...0.018),
            longitude: -87.6298 + Double.random(in: -0.024...0.024)
        )
        let pin = TestPin(
            title: "Test Pin \(next)",
            systemImage: "flag.fill",
            tint: .purple,
            coordinate: coordinate
        )

        droppedPins.append(pin)
        selectedPin = pin.id
        RejourneyExample.logEvent("map_test_pin_dropped", properties: [
            "pin_count": droppedPins.count,
            "latitude": coordinate.latitude,
            "longitude": coordinate.longitude
        ])
    }

    private func toggleMovingObjects() {
        isAnimatingObjects.toggle()
        RejourneyExample.logEvent("map_moving_objects_toggled", properties: [
            "is_animating": isAnimatingObjects
        ])
    }

    private func jumpToRiverwalk() {
        withAnimation(.easeInOut(duration: 0.7)) {
            cameraPosition = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 41.8876, longitude: -87.6250),
                span: MKCoordinateSpan(latitudeDelta: 0.018, longitudeDelta: 0.018)
            ))
        }
        RejourneyExample.logEvent("map_camera_jump_requested", properties: [
            "destination": "Chicago Riverwalk"
        ])
    }

    private func recenterMap() {
        withAnimation(.easeInOut(duration: 0.7)) {
            cameraPosition = .region(Self.chicagoRegion)
        }
        RejourneyExample.logEvent("map_recenter_requested")
    }
}

private extension MapTestView {
    static let chicagoRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 41.8838, longitude: -87.6320),
        span: MKCoordinateSpan(latitudeDelta: 0.07, longitudeDelta: 0.07)
    )

    static let staticPins: [TestPin] = [
        TestPin(title: "Cloud Gate", systemImage: "camera.fill", tint: .blue, coordinate: CLLocationCoordinate2D(latitude: 41.8827, longitude: -87.6233)),
        TestPin(title: "Union Station", systemImage: "tram.fill", tint: .orange, coordinate: CLLocationCoordinate2D(latitude: 41.8786, longitude: -87.6403)),
        TestPin(title: "Navy Pier", systemImage: "ferry.fill", tint: .cyan, coordinate: CLLocationCoordinate2D(latitude: 41.8917, longitude: -87.6078)),
        TestPin(title: "Grant Park", systemImage: "tree.fill", tint: .green, coordinate: CLLocationCoordinate2D(latitude: 41.8765, longitude: -87.6205))
    ]

    static let movingRoutes: [MovingRoute] = [
        MovingRoute(
            id: "train",
            title: "Loop Train",
            systemImage: "tram.fill",
            tint: .orange,
            coordinates: [
                CLLocationCoordinate2D(latitude: 41.8786, longitude: -87.6403),
                CLLocationCoordinate2D(latitude: 41.8842, longitude: -87.6330),
                CLLocationCoordinate2D(latitude: 41.8838, longitude: -87.6278),
                CLLocationCoordinate2D(latitude: 41.8781, longitude: -87.6270)
            ]
        ),
        MovingRoute(
            id: "courier",
            title: "Courier",
            systemImage: "bicycle",
            tint: .red,
            coordinates: [
                CLLocationCoordinate2D(latitude: 41.8917, longitude: -87.6078),
                CLLocationCoordinate2D(latitude: 41.8876, longitude: -87.6250),
                CLLocationCoordinate2D(latitude: 41.8827, longitude: -87.6233)
            ]
        ),
        MovingRoute(
            id: "shuttle",
            title: "Shuttle",
            systemImage: "bus.fill",
            tint: .indigo,
            coordinates: [
                CLLocationCoordinate2D(latitude: 41.8765, longitude: -87.6205),
                CLLocationCoordinate2D(latitude: 41.8786, longitude: -87.6403),
                CLLocationCoordinate2D(latitude: 41.8917, longitude: -87.6078)
            ]
        )
    ]
}

private struct TestPin: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let systemImage: String
    let tint: Color
    let coordinate: CLLocationCoordinate2D

    static func == (lhs: TestPin, rhs: TestPin) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

private struct MovingMapObject: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let tint: Color
    let coordinate: CLLocationCoordinate2D
}

private struct MovingRoute {
    let id: String
    let title: String
    let systemImage: String
    let tint: Color
    let coordinates: [CLLocationCoordinate2D]

    func coordinate(at tick: Int) -> CLLocationCoordinate2D {
        guard coordinates.count > 1 else { return coordinates.first ?? CLLocationCoordinate2D(latitude: 0, longitude: 0) }

        let stepsPerSegment = 4
        let segmentCount = coordinates.count
        let routeStep = tick % (coordinates.count * stepsPerSegment)
        let lowerIndex = (routeStep / stepsPerSegment) % coordinates.count
        let upperIndex = (lowerIndex + 1) % segmentCount
        let segmentProgress = Double(routeStep % stepsPerSegment) / Double(stepsPerSegment)
        let start = coordinates[lowerIndex]
        let end = coordinates[upperIndex]

        return CLLocationCoordinate2D(
            latitude: start.latitude + ((end.latitude - start.latitude) * segmentProgress),
            longitude: start.longitude + ((end.longitude - start.longitude) * segmentProgress)
        )
    }
}

private struct MovingMapObjectBadge: View {
    let object: MovingMapObject

    var body: some View {
        Image(systemName: object.systemImage)
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 34, height: 34)
            .background(object.tint.gradient, in: Circle())
            .overlay {
                Circle()
                    .stroke(.white, lineWidth: 2)
            }
            .shadow(radius: 4, y: 2)
            .accessibilityLabel(object.title)
    }
}
