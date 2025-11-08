import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { sendRecordingEvent } from './ApiService';
import { addLocationData } from './DataStorageService';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const BACKGROUND_FETCH_TASK = 'background-fetch-task';

// Background location task - runs when location changes significantly
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.log('Background location error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    if (location) {
      console.log('📍 Background location update:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date(location.timestamp).toISOString()
      });
      
      try {
        // Store location data locally
        await addLocationData(location.coords.latitude, location.coords.longitude, new Date(location.timestamp).toISOString(), 'background');
        
        // Send location data to server
        sendRecordingEvent('background_location', location.coords.latitude, location.coords.longitude);
      } catch (err) {
        console.log('Error in background location task:', err);
      }
    }
  }
});

// Background fetch task - runs periodically when app is backgrounded
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('🔄 Background fetch triggered');
    
    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low, // Use lower accuracy to reduce battery usage
      timeInterval: 30000, // 30 seconds minimum between updates
    });
    
    console.log('📍 Background fetch location:', {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date(location.timestamp).toISOString()
    });
    
    // Store location data locally
    await addLocationData(location.coords.latitude, location.coords.longitude, new Date(location.timestamp).toISOString(), 'background');
    
    // Send location data
    await sendRecordingEvent('background_fetch_location', location.coords.latitude, location.coords.longitude);
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.log('Background fetch error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Start background location tracking with minimal frequency
export async function startBackgroundLocationTracking() {
  try {
    console.log('🚀 Starting background location tracking...');
    
    // Request background location permission
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ Background location permission denied');
      return false;
    }
    
    // Start background location updates every 5 minutes
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced, // balanced to save battery but be timely
      timeInterval: 300000, // 5 minutes between updates (300000ms)
      distanceInterval: 10, // update if moved ~10 meters
      foregroundService: {
        notificationTitle: 'Location Tracking',
        notificationBody: 'App is tracking your location in the background',
        notificationColor: '#ffffff',
      },
    });
    
    // Register background fetch every 5 minutes
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 300, // request ~5 minutes (300 seconds); iOS may throttle
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    console.log('✅ Background location tracking started');
    return true;
  } catch (error) {
    console.log('❌ Failed to start background location tracking:', error);
    return false;
  }
}

// Stop background location tracking
export async function stopBackgroundLocationTracking() {
  try {
    console.log('🛑 Stopping background location tracking...');
    
    // Stop location updates
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    
    // Unregister background fetch
    const isFetchRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isFetchRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    }
    
    console.log('✅ Background location tracking stopped');
    return true;
  } catch (error) {
    console.log('❌ Failed to stop background location tracking:', error);
    return false;
  }
}

// Check if background location is active
export async function isBackgroundLocationActive() {
  try {
    const isLocationRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    const isFetchRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    return isLocationRegistered || isFetchRegistered;
  } catch (error) {
    console.log('Error checking background location status:', error);
    return false;
  }
}

// Get background location status
export async function getBackgroundLocationStatus() {
  try {
    const locationStatus = await Location.getBackgroundPermissionsAsync();
    const isActive = await isBackgroundLocationActive();
    
    return {
      permission: locationStatus.status,
      isActive,
      canStart: locationStatus.status === 'granted'
    };
  } catch (error) {
    console.log('Error getting background location status:', error);
    return {
      permission: 'unknown',
      isActive: false,
      canStart: false
    };
  }
}

// Default export for Expo Router compatibility
export default {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  isBackgroundLocationActive,
  getBackgroundLocationStatus,
};
