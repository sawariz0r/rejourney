//
//  CountriesList.swift
//  CountriesSwiftUI
//
//  Created by Alexey on 7/11/24.
//  Copyright © 2024 Alexey Naumov. All rights reserved.
//

import SwiftUI
import SwiftData
import Combine

struct CountriesList: View {

    @State private var countries: [DBModel.Country] = []
    @State private(set) var countriesState: Loadable<Void>
    @State private var canRequestPushPermission: Bool = false
    @State internal var searchText = ""
    @State internal var navigationPath = NavigationPath()
    @State private var routingState: Routing = .init()
    private var routingBinding: Binding<Routing> {
        $routingState.dispatched(to: injected.appState, \.routing.countriesList)
    }
    @Environment(\.injected) private var injected: DIContainer
    @Environment(\.locale) private var locale: Locale
    private let localeContainer = LocaleReader.Container()

    let inspection = Inspection<Self>()

    init(state: Loadable<Void> = .notRequested) {
        self._countriesState = .init(initialValue: state)
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            content
                .query(searchText: searchText, results: $countries, { search in
                    Query(filter: #Predicate<DBModel.Country> { country in
                        if search.isEmpty {
                            return true
                        } else {
                            return country.name.localizedStandardContains(search)
                        }
                    }, sort: \DBModel.Country.name)
                })
                .navigationTitle("Countries")
        }
        .modifier(LocaleReader(container: localeContainer))
        .onAppear {
            RejourneyExample.trackScreen("Countries List")
        }
        .onReceive(routingUpdate) { self.routingState = $0 }
        .onReceive(canRequestPushPermissionUpdate) { self.canRequestPushPermission = $0 }
        .onReceive(inspection.notice) { self.inspection.visit(self, $0) }
        .flipsForRightToLeftLayoutDirection(true)
    }

    @ViewBuilder private var content: some View {
        switch countriesState {
        case .notRequested:
            defaultView()
        case .isLoading:
            loadingView()
        case .loaded:
            loadedView()
        case let .failed(error):
            failedView(error)
        }
    }

    @ViewBuilder private var permissionsButton: some View {
        if canRequestPushPermission {
            Button(action: requestPushPermission, label: { Text("Allow Push") })
        }
    }
}

// MARK: - Loading Content

private extension CountriesList {
    func defaultView() -> some View {
        Text("").onAppear {
            if !countries.isEmpty {
                countriesState = .loaded(())
            }
            loadCountriesList(forceReload: false)
        }
    }

    func loadingView() -> some View {
        ProgressView()
            .progressViewStyle(CircularProgressViewStyle())
    }

    func failedView(_ error: Error) -> some View {
        ErrorView(error: error, retryAction: {
            loadCountriesList(forceReload: true)
        })
    }
}

// MARK: - Displaying Content

@MainActor
private extension CountriesList {
    @ViewBuilder
    func loadedView() -> some View {
        if countries.isEmpty && !searchText.isEmpty {
            Text("No matches found")
                .font(.footnote)
        }
        List {
            Section {
                RejourneyReplayMasked {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Replay privacy demo")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Signed in as")
                            .font(.subheadline)
                        Text(RejourneyExample.demoUserId)
                            .font(.body.weight(.semibold))
                        Text("Synthetic card ···· 4242  4242  4242  4242")
                            .font(.caption.monospaced())
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
                }
                .frame(minHeight: 88)
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            }

            ForEach(countries, id: \.alpha3Code) { country in
                NavigationLink(value: country) {
                    CountryCell(country: country)
                }
                .simultaneousGesture(TapGesture().onEnded {
                    RejourneyExample.logEvent("country_selected", properties: [
                        "alpha3_code": country.alpha3Code,
                        "country_name": country.name(locale: locale)
                    ])
                })
            }
        }
        .navigationDestination(for: DBModel.Country.self) { country in
            CountryDetails(country: country)
        }
        .searchable(text: $searchText)
        .onChange(of: searchText) { _, query in
            RejourneyExample.logEvent("countries_search_updated", properties: [
                "query_length": query.count
            ])
        }
        .refreshable {
            loadCountriesList(forceReload: true)
        }
        .toolbar {
            // Leading placement avoids overlapping list row accessories on narrow widths (trailing collides with chevrons).
            ToolbarItem(placement: .topBarLeading) {
                permissionsButton
            }
        }
        .onChange(of: routingState.countryCode, initial: true, { _, code in
            guard let code,
                  let country = countries.first(where: { $0.alpha3Code == code})
            else { return }
            navigationPath.append(country)
        })
        .onChange(of: navigationPath, { _, path in
            if !path.isEmpty {
                routingBinding.wrappedValue.countryCode = nil
            }
        })
    }
}

// MARK: - Side Effects

private extension CountriesList {

    private func loadCountriesList(forceReload: Bool) {
        guard forceReload || countries.isEmpty else { return }
        RejourneyExample.logEvent("countries_refresh_requested", properties: [
            "force_reload": forceReload
        ])
        $countriesState.load {
            try await injected.interactors.countries
                .refreshCountriesList()
        }
    }

    private func requestPushPermission() {
        RejourneyExample.logEvent("push_permission_requested")
        injected.interactors.userPermissions
            .request(permission: .pushNotifications)
    }
}

// MARK: - Routing

extension CountriesList {
    struct Routing: Equatable {
        var countryCode: String?
    }
}

// MARK: - State Updates

private extension CountriesList {

    private var routingUpdate: AnyPublisher<Routing, Never> {
        injected.appState.updates(for: \.routing.countriesList)
    }

    private var canRequestPushPermissionUpdate: AnyPublisher<Bool, Never> {
        injected.appState.updates(for: AppState.permissionKeyPath(for: .pushNotifications))
            .map { $0 == .notRequested || $0 == .denied }
            .eraseToAnyPublisher()
    }
}
