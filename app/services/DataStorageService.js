import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATIONS_KEY = 'captured_locations';
const AUDIO_RECORDINGS_KEY = 'captured_audio_recordings';

// Location data structure
export const addLocationData = async (latitude, longitude, timestamp, source = 'manual') => {
  try {
    const locationData = {
      id: Date.now().toString(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: timestamp || new Date().toISOString(),
      source, // 'manual', 'background', 'toast', 'recording'
      accuracy: null, // Could be added if available
    };

    const existingData = await getLocationData();
    const updatedData = [locationData, ...existingData];
    
    // Keep only last 1000 entries to prevent storage bloat
    const trimmedData = updatedData.slice(0, 1000);
    
    await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(trimmedData));
    console.log('📍 Location data saved:', locationData);
    return locationData;
  } catch (error) {
    console.error('❌ Failed to save location data:', error);
    return null;
  }
};

export const getLocationData = async () => {
  try {
    const data = await AsyncStorage.getItem(LOCATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('❌ Failed to get location data:', error);
    return [];
  }
};

// Audio recording data structure
export const addAudioRecordingData = async (uri, latitude, longitude, duration, timestamp, source = 'manual') => {
  try {
    const audioData = {
      id: Date.now().toString(),
      uri,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      duration: duration || 0,
      timestamp: timestamp || new Date().toISOString(),
      source, // 'manual', 'interval', 'trigger', 'scheduled'
      fileSize: null, // Could be added if available
      uploaded: false,
    };

    const existingData = await getAudioRecordingData();
    const updatedData = [audioData, ...existingData];
    
    // Keep only last 500 entries to prevent storage bloat
    const trimmedData = updatedData.slice(0, 500);
    
    await AsyncStorage.setItem(AUDIO_RECORDINGS_KEY, JSON.stringify(trimmedData));
    console.log('🎤 Audio recording data saved:', audioData);
    return audioData;
  } catch (error) {
    console.error('❌ Failed to save audio recording data:', error);
    return null;
  }
};

export const getAudioRecordingData = async () => {
  try {
    const data = await AsyncStorage.getItem(AUDIO_RECORDINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('❌ Failed to get audio recording data:', error);
    return [];
  }
};

// Combined data for table view
export const getAllData = async () => {
  try {
    const [locations, audioRecordings] = await Promise.all([
      getLocationData(),
      getAudioRecordingData()
    ]);

    return {
      locations,
      audioRecordings,
      totalLocations: locations.length,
      totalAudioRecordings: audioRecordings.length,
      lastLocation: locations[0] || null,
      lastAudioRecording: audioRecordings[0] || null,
    };
  } catch (error) {
    console.error('❌ Failed to get all data:', error);
    return {
      locations: [],
      audioRecordings: [],
      totalLocations: 0,
      totalAudioRecordings: 0,
      lastLocation: null,
      lastAudioRecording: null,
    };
  }
};

// Clear all data
export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove([LOCATIONS_KEY, AUDIO_RECORDINGS_KEY]);
    console.log('🗑️ All data cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
    return false;
  }
};

// Get data statistics
export const getDataStatistics = async () => {
  try {
    const data = await getAllData();
    
    const locationSources = {};
    const audioSources = {};
    
    data.locations.forEach(loc => {
      locationSources[loc.source] = (locationSources[loc.source] || 0) + 1;
    });
    
    data.audioRecordings.forEach(audio => {
      audioSources[audio.source] = (audioSources[audio.source] || 0) + 1;
    });

    return {
      totalLocations: data.totalLocations,
      totalAudioRecordings: data.totalAudioRecordings,
      locationSources,
      audioSources,
      oldestLocation: data.locations[data.locations.length - 1] || null,
      newestLocation: data.locations[0] || null,
      oldestAudio: data.audioRecordings[data.audioRecordings.length - 1] || null,
      newestAudio: data.audioRecordings[0] || null,
    };
  } catch (error) {
    console.error('❌ Failed to get data statistics:', error);
    return {
      totalLocations: 0,
      totalAudioRecordings: 0,
      locationSources: {},
      audioSources: {},
      oldestLocation: null,
      newestLocation: null,
      oldestAudio: null,
      newestAudio: null,
    };
  }
};

// Default export for Expo Router compatibility
export default {
  addLocationData,
  getLocationData,
  addAudioRecordingData,
  getAudioRecordingData,
  getAllData,
  clearAllData,
  getDataStatistics,
};
