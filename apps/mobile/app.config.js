module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || config.android?.googleServicesFile;

  if (process.env.EAS_BUILD_PLATFORM === 'android' && !mapsKey) {
    throw new Error('Set GOOGLE_MAPS_ANDROID_API_KEY in the EAS build environment before building Android.');
  }

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }]] : []),
      'react-native-nfc-manager',
    ],
  };
};
