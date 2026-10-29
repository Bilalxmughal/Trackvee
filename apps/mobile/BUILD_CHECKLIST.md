# Native build checks

- Launcher icons use the Trackvee website favicon, exported as square 1024px PNGs. Android uses a separate foreground asset with safe padding.
- Android maps require Maps SDK for Android enabled and a key restricted to `com.trackvee.mobile` plus the signing certificate SHA-1. Set `GOOGLE_MAPS_ANDROID_API_KEY` in the EAS environment used by the build. `app.config.js` passes it to the react-native-maps plugin and blocks Android EAS builds when missing. Do not commit the key.
- Android push builds need the Firebase `google-services.json` plus an FCM V1 service-account key in EAS Credentials. The local JSON is gitignored; upload it to EAS as a File environment variable named `GOOGLE_SERVICES_JSON` for each build environment. `app.config.js` uses that EAS-provided path. Never commit the service-account JSON.
- Native configuration and launcher changes require a new binary. Ignored local `android/` output is generated; do not upload stale native output to EAS.
- The commit hash identifies source, not an EAS build. Retain the EAS build URL/ID when testing an installed binary.
- For an app that closes at launch, capture Android `adb logcat -b crash -d` after reproducing. A successful JS export does not validate native startup.
- Offline-map operations using `cacheDirectory`, `getInfoAsync`, `downloadAsync`, and `FileSystemSessionType` must import `expo-file-system/legacy` for SDK 57. Keep modern `File`/`Directory` callers on the modern import.
