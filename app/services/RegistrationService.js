import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const BASE_URL = 'http://105.114.25.157:5000';
const DEVICE_ID_KEY = '@registered_device_id';

/**
 * iOS Registration Service - Similar to Android DataUploadManager
 * Sends device registration details to the same dashboard endpoint
 */
export class RegistrationService {
  
  /**
   * Collect iOS UUID with retry logic
   * Retries up to 3 times with 500ms delay between attempts
   */
  static async collectIosUuid(maxRetries = 3, retryDelay = 500) {
    let lastError = null;
    
    // Check if Application module is available first
    if (!Application) {
      throw new Error('expo-application module not available');
    }
    
    // Check if method exists
    if (typeof Application.getIosIdForVendorAsync !== 'function') {
      throw new Error('getIosIdForVendorAsync method not available');
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📱 UUID collection attempt ${attempt}/${maxRetries}...`);
        
        const uuid = await Application.getIosIdForVendorAsync();
        
        // Validate UUID is not null/undefined/empty
        if (uuid && typeof uuid === 'string' && uuid.trim().length > 0 && uuid !== 'Unknown iOS UUID') {
          console.log(`✅ iPhone UUID collected successfully on attempt ${attempt}: ${uuid}`);
          return uuid;
        } else {
          console.warn(`⚠️ UUID validation failed on attempt ${attempt}: ${uuid}`);
          lastError = new Error(`Invalid UUID returned: ${uuid}`);
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(`❌ Error on UUID collection attempt ${attempt}:`, error);
        lastError = error;
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // All retries failed
    console.error(`❌ Failed to collect iOS UUID after ${maxRetries} attempts`);
    throw lastError || new Error('Failed to collect iOS UUID - all retries exhausted');
  }
  
  /**
   * Register iOS device with dashboard
   * Similar to Android's uploadDeviceInfoToService() function
   */
  static async registerDevice() {
    try {
      console.log('📱 Starting iOS device registration...');
      
      // Get comprehensive device information (similar to Android's collectDeviceInfo)
      const deviceInfo = await this.collectDeviceInfo();
      
      // Validate UUID before proceeding with registration
      const uuid = deviceInfo.uuid;
      if (!uuid || uuid === 'Unknown iOS UUID' || uuid === 'Unknown Android UUID' || uuid.trim().length === 0) {
        const errorMsg = 'Failed to collect device UUID. Please ensure the app has proper permissions and expo-application is installed correctly.';
        console.error(`❌ ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          data: null
        };
      }
      
      // Create device ID similar to Android format
      const deviceId = this.generateDeviceId(deviceInfo);
      
      // Prepare registration data (similar to Android's device data structure)
      const registrationData = {
        phone_id: deviceId,
        device_name: deviceInfo.deviceName,
        device_info: deviceInfo,
        platform: 'ios',
        uuid: deviceInfo.uuid,
        android_id: deviceInfo.uuid,
        registration_timestamp: new Date().toISOString(),
        registration_date: new Date().toLocaleString()
      };
      
      console.log('📤 Sending registration data:', registrationData);
      console.log('📤 Registration payload UUID:', deviceInfo.uuid);
      console.log('📤 Registration payload device_info.uuid:', deviceInfo.uuid);
      console.log('📤 Registration payload device_info.androidId:', deviceInfo.androidId);
      
      // Send to registration endpoint (same as Android)
      const response = await this.sendRegistrationRequest(registrationData);
      
      if (response.success) {
        console.log('✅ iOS device registered successfully:', response);
        
        // CRITICAL: Store device ID immediately after successful registration
        // This ensures it's available for command polling and audio uploads
        try {
          await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
          console.log('✅ Device ID stored in AsyncStorage during registration:', deviceId);
        } catch (storageError) {
          console.error('❌ Failed to store device ID during registration:', storageError);
          // Don't fail registration if storage fails, but log it
        }
        
        return {
          success: true,
          deviceId: deviceId,
          message: response.message || 'Device registered successfully',
          data: response
        };
      } else {
        console.error('❌ Registration failed:', response);
        return {
          success: false,
          error: response.error || 'Registration failed',
          data: response
        };
      }
      
    } catch (error) {
      console.error('❌ Registration error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed',
        data: null
      };
    }
  }
  
  /**
   * Collect comprehensive device information
   * Similar to Android's collectDeviceInfo() function
   */
  static async collectDeviceInfo() {
    try {
      console.log('📱 Collecting iOS device information...');
      
      // iPhone 12 specific: Get iOS UUID with retry logic
      let iosUuid = 'Unknown iOS UUID';
      try {
        if (Platform.OS === 'ios') {
          try {
            iosUuid = await this.collectIosUuid();
          } catch (uuidError) {
            // If retry logic fails, try direct call as fallback
            console.warn('⚠️ UUID retry logic failed, trying direct call:', uuidError.message);
            if (Application && typeof Application.getIosIdForVendorAsync === 'function') {
              iosUuid = await Application.getIosIdForVendorAsync();
              if (!iosUuid || iosUuid === 'Unknown iOS UUID') {
                console.warn('⚠️ Direct UUID call also failed');
              }
            }
          }
        } else if (Application && typeof Application.getAndroidId === 'function') {
          iosUuid = await Application.getAndroidId();
          if (!iosUuid || iosUuid === 'Unknown Android UUID') {
            console.warn('⚠️ Android ID collection returned invalid value');
          }
        }
      } catch (uuidError) {
        console.error('❌ Error getting device UUID:', uuidError);
        // Keep default 'Unknown iOS UUID' if collection fails - don't throw
      }
      
      const deviceInfo = {
        // Basic device info (similar to Android DeviceInfo)
        device_id: '', // Will be set by generateDeviceId
        deviceName: Device.deviceName || 'Unknown Device',
        deviceType: Device.deviceType || 'Unknown',
        brand: Device.brand || 'Apple',
        modelName: Device.modelName || 'Unknown Model',
        manufacturer: Device.manufacturer || 'Apple',
        
        // OS information
        osName: Device.osName || Platform.OS,
        osVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS,
        
        // Device capabilities
        isDevice: Device.isDevice,
        totalMemory: Device.totalMemory || 'Unknown',
        deviceYearClass: Device.deviceYearClass || 'Unknown',
        
        // Unique identifiers - iPhone 12: Use the collected UUID
        uuid: Platform.OS === 'ios' ? iosUuid : (Application && typeof Application.getAndroidId === 'function' ? await Application.getAndroidId() : 'Unknown Android UUID'),
        // Mirror UUID into android-style fields for unified dashboards expecting Android ID
        androidId: Platform.OS === 'ios' ? iosUuid : (Application && typeof Application.getAndroidId === 'function' ? await Application.getAndroidId() : 'Unknown Android UUID'),
        android_id: Platform.OS === 'ios' ? iosUuid : (Application && typeof Application.getAndroidId === 'function' ? await Application.getAndroidId() : 'Unknown Android UUID'),
        applicationId: (Application && Application.applicationId) || 'Unknown App ID',
        sessionId: (Application && Application.sessionId) || 'Unknown Session ID',
        
        // iOS specific info - iPhone 12
        iosIdForVendor: Platform.OS === 'ios' ? iosUuid : null,
        iosBuildId: (Application && Application.nativeBuildVersion) || 'Unknown Build',
        iosVersion: (Application && Application.nativeApplicationVersion) || 'Unknown Version',
        
        // Storage info (similar to Android's StorageInfo)
        storage_info: {
          // iOS doesn't provide direct storage access like Android
          // But we can indicate the device has storage
          has_storage: true,
          platform: 'ios'
        },
        
        // Collection metadata
        collection_timestamp: Date.now(),
        collection_date: new Date().toLocaleString(),
        collection_source: 'ios_expo_app'
      };
      
      console.log('📱 Device info collected:', deviceInfo);
      return deviceInfo;
      
    } catch (error) {
      console.error('❌ Error collecting device info:', error);
      return {
        deviceName: 'Unknown Device',
        brand: 'Apple',
        modelName: 'Unknown Model',
        osName: Platform.OS,
        osVersion: 'Unknown',
        platform: Platform.OS,
        uuid: 'Unknown iOS UUID',
        error: error.message
      };
    }
  }
  
  /**
   * Generate device ID similar to Android format
   * Android uses: Build.MANUFACTURER + Build.MODEL
   */
  static generateDeviceId(deviceInfo) {
    try {
      // Create device ID similar to Android format
      const manufacturer = (deviceInfo.manufacturer || 'Apple').replace(/\s+/g, '');
      const model = (deviceInfo.modelName || 'Unknown').replace(/\s+/g, '_');
      const deviceId = `${manufacturer}_${model}_iOS`;
      
      console.log('🆔 Generated device ID:', deviceId);
      return deviceId;
      
    } catch (error) {
      console.error('❌ Error generating device ID:', error);
      return `Apple_Unknown_iOS_${Date.now()}`;
    }
  }
  
  /**
   * Send registration request to dashboard
   * Similar to Android's uploadDeviceData() function
   */
  static async sendRegistrationRequest(registrationData) {
    try {
      console.log('📤 Sending registration request to dashboard...');
      
      // Payload validation: Check for serialization issues
      let serializedPayload;
      try {
        serializedPayload = JSON.stringify(registrationData);
        console.log('✅ Payload serialization successful');
      } catch (serializationError) {
        console.error('❌ Payload serialization failed:', serializationError);
        return {
          success: false,
          error: `Failed to serialize registration data: ${serializationError.message}. This may indicate circular references or non-serializable values.`,
          data: null
        };
      }
      
      // Payload size validation (approximate - UTF-8 encoding)
      // In React Native, estimate bytes: UTF-8 typically uses 1-4 bytes per character
      // For JSON (mostly ASCII), we approximate as string length * 1.5
      let payloadSizeBytes;
      if (typeof TextEncoder !== 'undefined') {
        payloadSizeBytes = new TextEncoder().encode(serializedPayload).length;
      } else {
        // Fallback: approximate as string length * 1.5 (typical for JSON UTF-8)
        payloadSizeBytes = Math.floor(serializedPayload.length * 1.5);
      }
      const payloadSizeMB = (payloadSizeBytes / (1024 * 1024)).toFixed(2);
      console.log(`📦 Payload size: ${payloadSizeBytes} bytes (${payloadSizeMB} MB)`);
      
      const MAX_PAYLOAD_SIZE_MB = 10;
      if (payloadSizeBytes > MAX_PAYLOAD_SIZE_MB * 1024 * 1024) {
        const errorMsg = `Payload size (${payloadSizeMB} MB) exceeds maximum allowed size (${MAX_PAYLOAD_SIZE_MB} MB)`;
        console.error(`❌ ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          data: null
        };
      }
      
      const url = `${BASE_URL}/api/register`;
      
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'iOS-Expo-App/1.0'
        },
        body: serializedPayload
      };
      
      console.log('📤 Request URL:', url);
      console.log('📤 Request data (partial):', {
        phone_id: registrationData.phone_id,
        device_name: registrationData.device_name,
        platform: registrationData.platform,
        has_device_info: !!registrationData.device_info,
        payload_size_bytes: payloadSizeBytes
      });
      
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      let response;
      try {
        response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - server took too long to respond');
        }
        throw fetchError;
      }
      
      console.log('📤 Response status:', response.status);
      console.log('📤 Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Try to parse JSON, but handle non-JSON responses
      let responseData;
      try {
        const text = await response.text();
        console.log('📤 Response text:', text.substring(0, 200)); // Log first 200 chars
        responseData = text ? JSON.parse(text) : {};
        console.log('📤 Response data:', responseData);
      } catch (parseError) {
        console.error('❌ Failed to parse response:', parseError);
        responseData = { error: 'Invalid server response - not JSON' };
      }
      
      if (response.ok && response.status === 200) {
        console.log('✅ Registration successful!');
        return {
          success: true,
          status: response.status,
          data: responseData,
          message: responseData.message || 'Registration successful',
          uuid: responseData.uuid || responseData.data?.uuid || null
        };
      } else {
        const errorMsg = responseData.error || responseData.message || `Server returned ${response.status}`;
        console.error('❌ Registration failed:', errorMsg);
        console.error('❌ Full response:', responseData);
        return {
          success: false,
          status: response.status,
          error: errorMsg,
          data: responseData
        };
      }
      
    } catch (error) {
      console.error('❌ Network error during registration:', error);
      const errorMsg = error.message || 'Unknown error';
      
      // Check for common network errors and provide helpful messages
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network request failed')) {
        return {
          success: false,
          error: `Cannot reach server at ${BASE_URL}. Please check:\n1. Server is running\n2. Internet connection\n3. Server URL is correct`,
          data: null
        };
      }
      
      if (errorMsg.includes('timeout')) {
        return {
          success: false,
          error: 'Server timeout - server is not responding. Check if the server is running.',
          data: null
        };
      }
      
      return {
        success: false,
        error: `Network error: ${errorMsg}`,
        data: null
      };
    }
  }
  
  /**
   * Test server connection (similar to Android's testServerConnection)
   */
  static async testServerConnection() {
    try {
      console.log('🔍 Testing server connection...');
      
      const url = `${BASE_URL}/api/health`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Server connection successful:', data);
        return {
          success: true,
          message: 'Server connection successful',
          data: data
        };
      } else {
        console.log('❌ Server connection failed:', response.status);
        return {
          success: false,
          error: `Server error: ${response.status}`,
          status: response.status
        };
      }
      
    } catch (error) {
      console.error('❌ Server connection error:', error);
      return {
        success: false,
        error: `Connection error: ${error.message}`
      };
    }
  }
}

export default RegistrationService;



