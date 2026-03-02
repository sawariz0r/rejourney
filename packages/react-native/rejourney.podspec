require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "rejourney"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"] || "https://rejourney.co"
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => package["repository"]["url"], :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.0"
  s.exclude_files = "ios/build/**/*"
  s.library      = "z"

  # React Native core dependencies so headers like `React/RCTBridgeModule.h`
  # are always available, regardless of React Native version or architecture.
  # On modern React Native, `React-Core` is the canonical dependency.
  s.dependency "React-Core"
  s.dependency "ReactCommon/turbomodule/core"

  # New Architecture / Codegen integration (RN 0.71+). On older RN versions
  # this helper is not defined, so we guard it.
  if respond_to?(:install_modules_dependencies)
    install_modules_dependencies(s)
  end
end
