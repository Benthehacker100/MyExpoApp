import AsyncStorage from '@react-native-async-storage/async-storage';
import RegistrationService from './RegistrationService';

const BASE_URL = 'http://105.114.25.157:5000';
const DEVICE_ID_KEY = '@registered_device_id';

async function resolvePhoneId() {
  try {
    // Use stored device ID from registration (same as command polling)
    // This ensures audio uploads use the SAME device ID as registration
    const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (storedDeviceId) {
      console.log('📱 Using stored device ID for upload:', storedDeviceId);
      return storedDeviceId;
    }
    
    // Fallback: generate if not stored (should rarely happen after registration)
    console.log('⚠️ No stored device ID found, generating new one...');
    const deviceInfo = await RegistrationService.collectDeviceInfo();
    const deviceId = RegistrationService.generateDeviceId(deviceInfo);
    
    // Store it for future use
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('📱 Generated and stored device ID:', deviceId);
    return deviceId;
  } catch (err) {
    console.error('❌ Error resolving phone ID:', err);
    // Last resort fallback
    return `Unknown_Device_${Date.now()}`;
  }
}

export async function sendRecordingEvent(eventType, latitude, longitude, extra = {}) {
  try {
    const phone_id = await resolvePhoneId();
    const extraPayload = (extra && typeof extra === 'object') ? extra : (extra ? { uri: String(extra) } : {});
    
    // Determine source based on event type
    let source = 'foreground';
    if (eventType.includes('background')) {
      source = 'background';
    } else if (eventType.includes('recording')) {
      source = 'recording';
    }
    
    const payload = {
      phone_id,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      event: eventType,
      source: source,
      platform: 'ios',
      ...extraPayload,
    };

    console.log(`📍 Sending location data to dashboard:`, {
      phone_id,
      latitude,
      longitude,
      event: eventType,
      source: source,
      timestamp: payload.timestamp
    });

    const response = await fetch(`${BASE_URL}/api/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`❌ Location POST failed: ${response.status} ${text}`);
      throw new Error(`Location POST failed: ${response.status} ${text}`);
    }

    const result = await response.json();
    console.log(`✅ Location data sent successfully:`, result);
    return result;
  } catch (error) {
    console.error('❌ sendRecordingEvent error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendRecordingEvent,
};

// ===== File Uploads aligned to BUAS backend =====

export async function uploadAudioFile(fileUri) {
  try {
    const deviceId = await resolvePhoneId();
    const endpoint = `${BASE_URL}/api/upload/audio/${encodeURIComponent(deviceId)}`;

    console.log(`🎵 Uploading audio file to dashboard:`, {
      deviceId,
      fileUri,
      endpoint
    });

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: `recording_${Date.now()}.m4a`,
      type: 'audio/mp4',
    });
    formData.append('platform', 'ios');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`❌ Audio upload failed: ${response.status} ${text}`);
      throw new Error(`Audio upload failed: ${response.status} ${text}`);
    }

    const result = await response.json();
    console.log(`✅ Audio file uploaded successfully:`, result);
    return result;
  } catch (error) {
    console.error('❌ uploadAudioFile error:', error);
    return { success: false, error: error.message };
  }
}

export async function uploadPhotoFile(fileUri) {
  // No photo endpoint in BUAS; provide a graceful no-op to avoid runtime errors
  console.log('uploadPhotoFile skipped: no matching BUAS endpoint');
  return { success: true, skipped: true };
}
