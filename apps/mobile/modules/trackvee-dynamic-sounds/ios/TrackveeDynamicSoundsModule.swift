import ExpoModulesCore
import Foundation

public class TrackveeDynamicSoundsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TrackveeDynamicSounds")

    AsyncFunction("installSound") { (soundId: String, fileName: String, _ soundName: String, sourceUri: String) -> Bool in
      guard soundId.range(of: "^[0-9a-fA-F-]{36}$", options: .regularExpression) != nil,
            fileName.range(of: "^tv_[0-9a-f]{32}\\.wav$", options: .regularExpression) != nil,
            let source = URL(string: sourceUri), source.isFileURL else {
        return false
      }
      guard let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else {
        return false
      }
      let directory = library.appendingPathComponent("Sounds", isDirectory: true)
      let destination = directory.appendingPathComponent(fileName)
      do {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: destination.path) {
          try FileManager.default.copyItem(at: source, to: destination)
        }
        return true
      } catch {
        return false
      }
    }
  }
}
