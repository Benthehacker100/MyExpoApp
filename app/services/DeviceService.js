import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import RegistrationService from './RegistrationService';

export async function getDeviceInfo() {
  try {
    // Use the same UUID collection retry logic as RegistrationService
    // Don't let UUID failure break device info collection
    let uuid = 'Unknown UUID';
    try {
      if (Platform.OS === 'ios') {
        try {
          uuid = await RegistrationService.collectIosUuid();
        } catch (uuidError) {
          // Try direct call as fallback
          if (Application && typeof Application.getIosIdForVendorAsync === 'function') {
            try {
              uuid = await Application.getIosIdForVendorAsync();
              if (!uuid || uuid === 'Unknown iOS UUID') {
                uuid = 'Unknown iOS UUID';
              }
            } catch (directError) {
              console.warn('⚠️ Direct UUID call also failed:', directError.message);
              uuid = 'Unknown iOS UUID';
            }
          } else {
            uuid = 'Unknown iOS UUID';
          }
        }
      } else if (Application && typeof Application.getAndroidId === 'function') {
        try {
          uuid = await Application.getAndroidId();
          if (!uuid || uuid === 'Unknown Android UUID') {
            console.warn('⚠️ Android ID collection returned invalid value');
            uuid = 'Unknown Android UUID';
          }
        } catch (androidError) {
          console.warn('⚠️ Android ID collection failed:', androidError.message);
          uuid = 'Unknown Android UUID';
        }
      }
    } catch (uuidError) {
      console.error('❌ Error getting device UUID:', uuidError);
      uuid = Platform.OS === 'ios' ? 'Unknown iOS UUID' : 'Unknown Android UUID';
    }
    
    const deviceInfo = {
      deviceName: Device.deviceName || 'Unknown Device',
      deviceType: Device.deviceType || 'Unknown',
      brand: Device.brand || 'Unknown Brand',
      modelName: Device.modelName || 'Unknown Model',
      osName: Device.osName || Platform.OS,
      osVersion: Device.osVersion || 'Unknown',
      platform: Platform.OS,
      isDevice: Device.isDevice,
      manufacturer: Device.manufacturer || 'Unknown',
      totalMemory: Device.totalMemory || 'Unknown',
      deviceYearClass: Device.deviceYearClass || 'Unknown',
      uuid: uuid,
      // Provide android-style keys using the same UUID so dashboards expecting Android ID fields get values
      androidId: uuid,
      android_id: uuid,
      applicationId: (Application && Application.applicationId) || 'Unknown App ID',
      sessionId: (Application && Application.sessionId) || 'Unknown Session ID',
    };

    console.log('📱 Device Info:', deviceInfo);
    return deviceInfo;
  } catch (error) {
    console.error('❌ Failed to get device info:', error);
    return {
      deviceName: 'Unknown Device',
      deviceType: 'Unknown',
      brand: 'Unknown Brand',
      modelName: 'Unknown Model',
      osName: Platform.OS,
      osVersion: 'Unknown',
      platform: Platform.OS,
      isDevice: false,
      manufacturer: 'Unknown',
      totalMemory: 'Unknown',
      deviceYearClass: 'Unknown',
      uuid: 'Unknown UUID',
      applicationId: 'Unknown App ID',
      sessionId: 'Unknown Session ID',
    };
  }
}

export function getDeviceSummary() {
  return `${Device.brand || 'Unknown'} ${Device.modelName || 'Device'} (${Device.osName || Platform.OS} ${Device.osVersion || 'Unknown'})`;
}

/**
 * Register device with dashboard (similar to Android's uploadDeviceInfoToService)
 * This function should be called after permissions are granted
 */
export async function registerDeviceWithDashboard() {
  try {
    console.log('📱 Starting device registration with dashboard...');
    
    // Use the RegistrationService to register the device
    const result = await RegistrationService.registerDevice();
    
    if (result.success) {
      console.log('✅ Device registered successfully:', result);
      return {
        success: true,
        deviceId: result.deviceId,
        message: result.message,
        data: result.data
      };
    } else {
      console.error('❌ Device registration failed:', result);
      return {
        success: false,
        error: result.error,
        data: result.data
      };
    }
    
  } catch (error) {
    console.error('❌ Error in device registration:', error);
    return {
      success: false,
      error: error.message || 'Registration failed',
      data: null
    };
  }
}

/**
 * Test server connection before registration
 */
export async function testDashboardConnection() {
  try {
    console.log('🔍 Testing dashboard connection...');
    
    const result = await RegistrationService.testServerConnection();
    
    if (result.success) {
      console.log('✅ Dashboard connection successful:', result);
      return {
        success: true,
        message: result.message,
        data: result.data
      };
    } else {
      console.error('❌ Dashboard connection failed:', result);
      return {
        success: false,
        error: result.error,
        data: result.data
      };
    }
    
  } catch (error) {
    console.error('❌ Error testing dashboard connection:', error);
    return {
      success: false,
      error: error.message || 'Connection test failed',
      data: null
    };
  }
}

// Default export for Expo Router compatibility
export default {
  getDeviceInfo,
  getDeviceSummary,
  registerDeviceWithDashboard,
  testDashboardConnection,
};
