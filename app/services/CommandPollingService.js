import AsyncStorage from '@react-native-async-storage/async-storage';
import { stopRecording, triggerRecording } from './AudioService';
import RegistrationService from './RegistrationService';

const BASE_URL = 'http://105.114.25.157:5000';
const DEVICE_ID_KEY = '@registered_device_id';
let pollingInterval = null;
let isPolling = false;

/**
 * Start polling for remote commands from dashboard
 * Polls every 2 seconds to check for start/stop recording commands
 */
export async function startCommandPolling() {
  if (isPolling) {
    console.log('📡 Command polling already active');
    return;
  }

  console.log('📡 Starting command polling...');
  
  // Get and log the device ID that will be used
  const deviceId = await getDeviceId();
  console.log('📡 Command polling will use device ID:', deviceId);
  
  isPolling = true;

  // Poll immediately
  await checkForCommands();

  // Then poll every 2 seconds
  pollingInterval = setInterval(async () => {
    await checkForCommands();
  }, 2000);
  
  console.log('✅ Command polling started - checking for commands every 2 seconds');
}

/**
 * Stop polling for commands
 */
export function stopCommandPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isPolling = false;
  console.log('📡 Command polling stopped');
}

/**
 * Get stored device ID from registration, or generate a new one
 */
let cachedDeviceId = null;
let deviceIdLogged = false;

async function getDeviceId() {
  try {
    // Return cached device ID if available (avoid repeated AsyncStorage reads)
    if (cachedDeviceId) {
      return cachedDeviceId;
    }
    
    // First, try to get stored device ID from registration
    const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (storedDeviceId) {
      cachedDeviceId = storedDeviceId;
      if (!deviceIdLogged) {
        console.log('📱 Using stored device ID for command polling:', storedDeviceId);
        deviceIdLogged = true;
      }
      return storedDeviceId;
    }
    
    // If not stored, generate it (should match registration)
    if (!deviceIdLogged) {
      console.log('⚠️ No stored device ID found, generating new one...');
      deviceIdLogged = true;
    }
    const deviceInfo = await RegistrationService.collectDeviceInfo();
    const deviceId = RegistrationService.generateDeviceId(deviceInfo);
    
    // Store it for future use
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    cachedDeviceId = deviceId;
    console.log('📱 Generated and stored device ID:', deviceId);
    return deviceId;
  } catch (error) {
    console.warn('⚠️ Failed to get device ID, using fallback:', error.message);
    // Generate a simple fallback ID based on platform
    const { Platform } = require('react-native');
    const fallbackId = `Fallback_${Platform.OS}_${Date.now()}`;
    cachedDeviceId = fallbackId;
    return fallbackId;
  }
}

/**
 * Store device ID after successful registration
 */
export async function storeDeviceId(deviceId) {
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    cachedDeviceId = deviceId; // Update cache
    deviceIdLogged = false; // Reset so it logs again
    console.log('✅ Stored device ID for command polling:', deviceId);
  } catch (error) {
    console.error('❌ Failed to store device ID:', error);
  }
}

/**
 * Check for pending commands from dashboard
 */
async function checkForCommands() {
  try {
    // Get device ID (stored from registration or generated)
    const deviceId = await getDeviceId();
    
    // Poll the command endpoint
    const url = `${BASE_URL}/api/command/${encodeURIComponent(deviceId)}`;
    // Only log polling details occasionally to reduce spam (every 20 polls = ~40 seconds)
    const shouldLogPoll = Math.random() < 0.05; // 5% chance
    if (shouldLogPoll) {
      console.log(`📡 Polling for commands with device ID: ${deviceId}`);
      console.log(`📡 Polling URL: ${url}`);
    }
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log(`📡 Command poll response status: ${response.status}`);

      // Try to parse response body regardless of status code
      // Backend may return JSON even for 404 (with hasCommand: false)
      // Some servers return HTML 404 pages instead of JSON - handle gracefully
      let data;
      try {
        const responseText = await response.text();
        
        // Check if response is HTML (server returned HTML 404 page instead of JSON)
        const isHtml = responseText.trim().toLowerCase().startsWith('<!doctype') || 
                       responseText.trim().toLowerCase().startsWith('<html');
        
        if (isHtml) {
          // HTML response - likely a 404 page from server
          if (response.status === 404) {
            // This is expected when endpoint doesn't exist or no command
            // Silently ignore - just means no command available
            if (shouldLogPoll) {
              console.log(`📡 No command endpoint available (HTML 404 response) - this is normal if backend route not set up`);
            }
            return;
          } else {
            // HTML response with non-404 status - unexpected error
            console.error(`❌ Command poll error: Server returned HTML (status ${response.status})`);
            if (shouldLogPoll) {
              console.error(`❌ Response preview: ${responseText.substring(0, 200)}...`);
            }
            return;
          }
        }
        
        if (responseText) {
          try {
            data = JSON.parse(responseText);
            if (shouldLogPoll) {
              console.log(`📡 Command poll parsed data:`, JSON.stringify(data));
            }
          } catch (parseError) {
            // Not JSON and not HTML - unexpected format
            if (response.status === 404) {
              // 404 with non-JSON/non-HTML - might be text error message
              if (shouldLogPoll) {
                console.log(`📡 No command found (404 with text response): ${responseText.substring(0, 100)}`);
              }
            } else {
              console.error(`❌ Command poll error: Failed to parse response (status ${response.status})`);
              if (shouldLogPoll) {
                console.error(`❌ Response: ${responseText.substring(0, 200)}`);
              }
            }
            return;
          }
        } else {
          // Empty response
          if (response.status === 404) {
            // Empty 404 is normal - no command
            return;
          } else if (response.status !== 200) {
            console.error(`❌ Command poll error: ${response.status} - Empty response`);
          }
          return;
        }
      } catch (textError) {
        console.error(`❌ Error reading response:`, textError);
        // If status is not 200/404, log as error
        if (response.status !== 200 && response.status !== 404) {
          console.error(`❌ Command poll failed: ${response.status}`);
        }
        return;
      }

      // If we got here, we have parsed data - process it
      
      if (data.hasCommand && data.action) {
        console.log(`📡 ✅ COMMAND RECEIVED: ${data.action} (duration: ${data.durationSeconds || 'N/A'})`);
        
        // Support both old format ('start'/'stop') and new format ('start recording'/'stop recording')
        if (data.action === 'start recording' || data.action === 'start') {
          const duration = data.durationSeconds || 30;
          console.log(`🎙️ Starting recording via dashboard command (${duration}s)`);
          try {
            const result = await triggerRecording('dashboard', duration);
            if (result && result.success) {
              console.log(`✅ Recording started successfully via dashboard command (${duration}s)`);
            } else {
              const errorMsg = result?.error || "Unknown error";
              console.error(`❌ Failed to start recording via dashboard command: ${errorMsg}`);
              // Don't throw - just log, so polling can continue
            }
          } catch (recordError) {
            console.error(`❌ Exception while starting recording:`, recordError);
            console.error(`❌ Error message:`, recordError.message);
            console.error(`❌ Error stack:`, recordError.stack);
            // Don't throw - just log, so polling can continue
          }
        } else if (data.action === 'stop recording' || data.action === 'stop') {
          console.log(`⏹️ Stopping recording via dashboard command`);
          try {
            const result = await stopRecording();
            if (result) {
              console.log(`✅ Recording stopped successfully via dashboard command`);
            } else {
              console.log(`⚠️ Stop recording returned null (may not have been recording)`);
            }
          } catch (stopError) {
            console.error(`❌ Failed to stop recording:`, stopError);
            console.error(`❌ Error message:`, stopError.message);
            console.error(`❌ Error stack:`, stopError.stack);
            // Don't throw - just log, so polling can continue
          }
        } else {
          console.warn(`⚠️ Unknown command action: ${data.action}`);
        }
      } else {
        // Log when no command found - helpful for debugging
        if (response.status === 404 || (data && !data.hasCommand)) {
          // Only log occasionally to avoid spam (every 10th poll = ~20 seconds)
          const shouldLog = Math.random() < 0.1; // 10% chance
          if (shouldLog) {
            console.log(`📡 No command pending (status: ${response.status}, hasCommand: ${data?.hasCommand || false})`);
            console.log(`📡 Polling device ID: ${deviceId}`);
            console.log(`📡 If dashboard shows different device ID, that's the mismatch!`);
          }
        } else {
          console.log(`📡 No command pending (hasCommand: ${data?.hasCommand || false})`);
        }
      }
    } catch (fetchError) {
      // Log all errors for debugging
      console.error('❌ Error checking for commands:', fetchError);
      console.error('❌ Error message:', fetchError.message);
      console.error('❌ Error stack:', fetchError.stack);
    }
  } catch (error) {
    console.error('❌ Error in checkForCommands:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

/**
 * Check if polling is active
 */
export function isCommandPollingActive() {
  return isPolling;
}

/**
 * Test backend connectivity and command endpoint
 * Call this to diagnose why commands aren't working
 */
export async function testBackendConnectivity() {
  try {
    console.log('\n🔍 ========================================');
    console.log('🔍 TESTING BACKEND CONNECTIVITY');
    console.log('🔍 ========================================\n');
    
    // Test 1: Health endpoint
    console.log('🔍 Test 1: Health endpoint...');
    try {
      const healthResponse = await fetch(`${BASE_URL}/api/health`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('✅ Backend health check passed:', healthData);
      } else {
        console.error('❌ Backend health check failed:', healthResponse.status);
        return { success: false, error: `Backend not reachable (status: ${healthResponse.status})` };
      }
    } catch (healthError) {
      console.error('❌ Backend health check error:', healthError);
      return { success: false, error: `Cannot reach backend: ${healthError.message}` };
    }
    
    // Test 2: Command endpoint with test device ID
    console.log('🔍 Test 2: Command endpoint...');
    const testDeviceId = 'Test_Device_Connectivity';
    const testUrl = `${BASE_URL}/api/command/${encodeURIComponent(testDeviceId)}`;
    console.log('🔍 Testing URL:', testUrl);
    
    try {
      const commandResponse = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      const responseText = await commandResponse.text();
      const isHtml = responseText.trim().toLowerCase().startsWith('<!doctype') || 
                     responseText.trim().toLowerCase().startsWith('<html');
      
      console.log('🔍 Response status:', commandResponse.status);
      console.log('🔍 Response is HTML:', isHtml);
      
      if (isHtml) {
        console.error('\n❌ ========================================');
        console.error('❌ CRITICAL: Command endpoint returned HTML 404');
        console.error('❌ This means the backend route /api/command/<device_id> is NOT registered');
        console.error('❌ ========================================\n');
        console.error('❌ SOLUTION:');
        console.error('   1. Check that backend server is running');
        console.error('   2. Check that BUAS/app/routes.py is loaded');
        console.error('   3. Verify routes blueprint is registered in app/__init__.py');
        console.error('   4. Check backend logs for route registration errors\n');
        return { 
          success: false, 
          error: 'Command endpoint not found - backend route not registered',
          details: 'Backend returned HTML 404 instead of JSON. The /api/command route may not be registered in the Flask app.',
          fix: 'Start backend server: cd BUAS && python server.py'
        };
      }
      
      if (commandResponse.status === 200) {
        console.log('✅ Command endpoint is accessible and returns JSON');
        try {
          const commandData = JSON.parse(responseText);
          console.log('✅ Command endpoint returns valid JSON:', commandData);
          console.log('\n✅ ========================================');
          console.log('✅ BACKEND CONNECTIVITY TEST PASSED');
          console.log('✅ ========================================\n');
          return { success: true, message: 'Backend is accessible and command endpoint works' };
        } catch (parseError) {
          console.warn('⚠️ Command endpoint response is not JSON:', responseText.substring(0, 200));
          return { success: false, error: 'Command endpoint returned non-JSON response' };
        }
      } else {
        console.warn('⚠️ Command endpoint returned status:', commandResponse.status);
        return { success: false, error: `Command endpoint returned status: ${commandResponse.status}` };
      }
    } catch (commandError) {
      console.error('❌ Command endpoint test error:', commandError);
      return { success: false, error: `Command endpoint error: ${commandError.message}` };
    }
  } catch (error) {
    console.error('❌ Backend connectivity test error:', error);
    return { success: false, error: error.message };
  }
}

// Default export for Expo Router compatibility
export default {
  startCommandPolling,
  stopCommandPolling,
  isCommandPollingActive,
  storeDeviceId,
  testBackendConnectivity,
};

