
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    downloadAudioFile,
    getAudioQualityInfo,
    getRecordedAudioFiles,
    shareAudioFile,
    stopRecording,
} from '../services/AudioService';
import { setCameraRef, takePicture } from '../services/CameraService';
import { startCommandPolling, stopCommandPolling, storeDeviceId, testBackendConnectivity } from '../services/CommandPollingService';
import { getDeviceInfo, registerDeviceWithDashboard, testDashboardConnection } from '../services/DeviceService';
import { startLocationToastUpdates, stopLocationToastUpdates, getLocationUpdateStats } from '../services/LocationService';

const openAppSettings = () => {
  // NEVER try to open settings - just show instructions (prevents freezing)
  // This function ONLY shows an alert, it does NOT use Linking.openSettings() or any URL schemes
  Alert.alert(
    'Permission Help',
    'To grant permissions:\n\n✅ BEST: Tap "🚀 Enable Startup" button above to request permissions directly from the app.\n\nOr manually:\n1. Go to iPhone Settings\n2. Scroll to "Expo Go"\n3. Grant permissions\n4. Return to app',
    [{ text: 'OK' }]
  );
};

export default function HomeScreen() {
  const [audioStatus, setAudioStatus] = useState('unknown');
  const [locationStatus, setLocationStatus] = useState('unknown');
  const [enabled, setEnabled] = useState(false);
  const [locationToastEnabled, setLocationToastEnabled] = useState(false);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState('not_registered');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<any[]>([]);
  const [showAudioFiles, setShowAudioFiles] = useState(false);
  const cameraRef = useRef(null);

  // Periodically update location stats
  useEffect(() => {
    if (locationToastEnabled) {
      const statsInterval = setInterval(() => {
        const stats = getLocationUpdateStats();
        setLocationUpdateCount(stats.updateCount);
      }, 10000); // Update every 10 seconds
      
      return () => clearInterval(statsInterval);
    }
  }, [locationToastEnabled]);

  // Get device info and auto-request permissions on component mount
  useEffect(() => {
    const initializeApp = async () => {
      // Load device info
      const info = await getDeviceInfo();
      setDeviceInfo(info);
      
      // Auto-request all permissions on app startup
      try {
        console.log('🚀 Auto-requesting permissions on app startup...');
        
        // Request location permission
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        setLocationStatus(String(locStatus));
        console.log('📍 Location permission:', locStatus);
        
        if (locStatus === 'granted') {
          console.log('📍 Location permission granted - starting automatic location tracking (every 5 minutes)');
          setLocationToastEnabled(true);
          startLocationToastUpdates();
        }
        
        // Request audio permission
        try {
          const { status: audioStat } = await Audio.requestPermissionsAsync();
          setAudioStatus(String(audioStat));
          console.log('🎤 Audio permission:', audioStat);
        } catch (audioError) {
          console.log('Audio permission error:', audioError);
        }
        
        // Request camera permission
        try {
          if (cameraPermission?.status !== 'granted') {
            const { status: camStatus } = await requestCameraPermission();
            console.log('📸 Camera permission:', camStatus);
          }
        } catch (camError) {
          console.log('Camera permission error:', camError);
        }
        
        // Auto-register device if location permission is granted
        if (locStatus === 'granted') {
          // Wait a bit for location to initialize, then register
          setTimeout(async () => {
            try {
              const result = await registerDeviceWithDashboard();
              if (result.success) {
                setRegistrationStatus('registered');
                setDeviceId(result.deviceId || null);
                // Store device ID for command polling consistency
                await storeDeviceId(result.deviceId);
                // Start command polling for dashboard control
                await startCommandPolling();
                console.log('✅ Auto-registered device and started command polling');
              }
            } catch (error) {
              console.log('Auto-registration failed (user can register manually):', error);
            }
          }, 2000);
        }
      } catch (error) {
        console.log('Could not auto-request permissions:', error);
      }
    };
    
    initializeApp();
  }, []);

  // Deep link handler: myexpoapp://stop only
  useEffect(() => {
    const handleUrl = (eventUrl: string) => {
      try {
        const url = new URL(eventUrl);
        const action = url.hostname || url.pathname.replace('/', '');
        if (action === 'stop') {
          stopRecording();
          Alert.alert('⏹️ Recording', 'Stopped via link');
        }
      } catch (e) {
        // ignore invalid URLs
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) handleUrl(initialUrl);
    }).catch(() => {});
    return () => {
      sub.remove();
    };
  }, []);

  // Cleanup location toasts and command polling when component unmounts
  useEffect(() => {
    return () => {
      stopLocationToastUpdates();
      stopCommandPolling();
    };
  }, []);

  const handleDeviceRegistration = async () => {
    try {
      console.log('📱 Starting device registration with dashboard...');
      setRegistrationStatus('registering');
      
      const result = await registerDeviceWithDashboard();
      
      if (result.success) {
        setRegistrationStatus('registered');
        setDeviceId(result.deviceId || null);
        console.log('✅ Device registered successfully:', result);
        console.log('📱 Registered Device ID:', result.deviceId);
        
        // Store device ID for command polling consistency
        await storeDeviceId(result.deviceId);
        console.log('💾 Device ID stored for command polling');
        
        // Verify it was stored
        const storedId = await AsyncStorage.getItem('@registered_device_id');
        console.log('🔍 Verification - Stored device ID:', storedId);
        
        // Start command polling after successful registration
        await startCommandPolling();
        Alert.alert('✅ Registration Successful', `Device registered: ${result.deviceId}\nUUID: ${result.data?.uuid || 'N/A'}\n\n📡 Command polling started - dashboard can now control recording.`);
        return result;
      } else {
        setRegistrationStatus('failed');
        console.error('❌ Device registration failed:', result);
        const errorMsg = result.error || 'Registration failed';
        Alert.alert('❌ Registration Failed', errorMsg);
        return result;
      }
    } catch (error: any) {
      setRegistrationStatus('failed');
      console.error('❌ Registration error:', error);
      const errorMsg = error?.message || 'Unknown error occurred';
      Alert.alert('❌ Registration Error', errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const handleTestDashboardConnection = async () => {
    try {
      console.log('🔍 Testing dashboard connection...');
      
      const result = await testDashboardConnection();
      
      if (result.success) {
        Alert.alert('✅ Dashboard Connection', 'Successfully connected to dashboard!');
        return result;
      } else {
        Alert.alert('❌ Dashboard Connection Failed', `Error: ${result.error}`);
        return result;
      }
    } catch (error: any) {
      console.error('❌ Connection test error:', error);
      Alert.alert('❌ Connection Test Error', `Error: ${error?.message || 'Unknown error'}`);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  };

  const handleTestBackendConnectivity = async () => {
    try {
      console.log('🔍 Testing backend connectivity...');
      Alert.alert('🔍 Testing Backend', 'Check phone logs for detailed results...');
      
      const result = await testBackendConnectivity();
      
      if (result.success) {
        Alert.alert('✅ Backend Test Passed', result.message || 'Backend is accessible and command endpoint works!');
      } else {
        const errorMsg = result.error || 'Backend test failed';
        const fixMsg = result.fix ? `\n\nFix: ${result.fix}` : '';
        Alert.alert('❌ Backend Test Failed', `${errorMsg}${fixMsg}\n\nCheck phone logs for details.`);
      }
      return result;
    } catch (error: any) {
      console.error('❌ Backend connectivity test error:', error);
      Alert.alert('❌ Backend Test Error', `Error: ${error?.message || 'Unknown error'}\n\nCheck phone logs for details.`);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  };

  const loadAudioFiles = async () => {
    try {
      console.log('📁 Loading audio files...');
      const files = await getRecordedAudioFiles();
      setAudioFiles(files);
      console.log(`📁 Loaded ${files.length} audio files`);
    } catch (error: any) {
      console.error('❌ Error loading audio files:', error);
      Alert.alert('❌ Error', `Failed to load audio files: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDownloadAudio = async (audioFile: any) => {
    try {
      console.log('📥 Downloading audio file:', audioFile.name);
      
      const result = await downloadAudioFile(audioFile);
      
      if (result.success) {
        Alert.alert('✅ Download Complete', result.message);
      } else {
        Alert.alert('❌ Download Failed', result.message);
      }
    } catch (error: any) {
      console.error('❌ Download error:', error);
      Alert.alert('❌ Download Error', `Failed to download: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleShareAudio = async (audioFile: any) => {
    try {
      console.log('📤 Sharing audio file:', audioFile.name);
      
      const result = await shareAudioFile(audioFile);
      
      if (result.success) {
        Alert.alert('✅ Share Complete', result.message);
      } else {
        Alert.alert('❌ Share Failed', result.message);
      }
    } catch (error: any) {
      console.error('❌ Share error:', error);
      Alert.alert('❌ Share Error', `Failed to share: ${error?.message || 'Unknown error'}`);
    }
  };

  const toggleAudioFiles = async () => {
    if (!showAudioFiles) {
      await loadAudioFiles();
    }
    setShowAudioFiles(!showAudioFiles);
  };

  const requestAllPermissions = async () => {
    try {
      console.log('🚀 Starting permission requests from within app...');
      
      // Request Location permission first (most important)
      console.log('📍 Requesting location permission...');
      const { status: locStat } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(String(locStat));
      console.log('📍 Location permission result:', locStat);
      
      // Request Audio permission
      let audioStat = 'denied';
      try {
        console.log('🎤 Requesting microphone permission...');
        const { status } = await Audio.requestPermissionsAsync();
        audioStat = status;
        setAudioStatus(String(audioStat));
        console.log('🎤 Microphone permission result:', status);
      } catch (audioError) {
        console.log('Audio permission error:', audioError);
        setAudioStatus('denied');
      }

      // Request Camera permission
      let cameraStatus = cameraPermission?.status;
      console.log('📸 Initial camera status:', cameraStatus);
      
      if (cameraStatus !== 'granted') {
        console.log('📸 Requesting camera permission...');
        try {
          const { status } = await requestCameraPermission();
          cameraStatus = status;
          console.log('📸 Camera permission result:', cameraStatus);
        } catch (camError) {
          console.log('Camera permission error:', camError);
        }
      }

      console.log('✅ Final permission status:', { camera: cameraStatus, audio: audioStat, location: locStat });

      // Start location tracking if granted
      if (locStat === 'granted') {
        console.log('📍 Location permission granted - starting automatic location tracking (every 5 minutes)');
        setLocationToastEnabled(true);
        startLocationToastUpdates();
        
        // Auto-register device
        try {
          const result = await registerDeviceWithDashboard();
          if (result.success) {
            setRegistrationStatus('registered');
            setDeviceId(result.deviceId || null);
            await storeDeviceId(result.deviceId || '');
            await startCommandPolling();
            console.log('✅ Auto-registered device and started command polling');
          }
        } catch (regError) {
          console.log('Auto-registration failed:', regError);
        }
      }

      // Show summary
      const granted = [];
      const denied = [];
      
      if (locStat === 'granted') granted.push('Location');
      else denied.push('Location');
      
      if (audioStat === 'granted') granted.push('Audio');
      else denied.push('Audio');
      
      if (cameraStatus === 'granted') granted.push('Camera');
      else denied.push('Camera');

      if (granted.length === 3) {
        setEnabled(true);
        Alert.alert(
          '✅ All Permissions Granted!',
          'All permissions have been granted!\n\n✅ Location tracking started (every 5 minutes)\n✅ Device registered with dashboard\n✅ Ready to use all features'
        );
      } else if (granted.length > 0) {
        Alert.alert(
          '⚠️ Some Permissions Granted',
          `Granted: ${granted.join(', ')}\n\nDenied: ${denied.join(', ')}\n\n${locStat === 'granted' ? '✅ Location tracking is active' : '❌ Location tracking requires permission'}\n\nTap "🚀 Enable Startup" again to request permissions.`
        );
      } else {
        Alert.alert(
          '❌ Permissions Denied',
          'All permissions were denied.\n\nTap "🚀 Enable Startup" again to request permissions from within the app.'
        );
      }
    } catch (e: any) {
      console.error('Permission request error:', e);
      Alert.alert('Error', `Failed to request permissions: ${e?.message || 'Unknown error'}`);
    }
  };

  const toggleLocationToasts = () => {
    if (locationToastEnabled) {
      stopLocationToastUpdates();
      setLocationToastEnabled(false);
      Alert.alert('Location Tracking Stopped', 'Location tracking has been disabled.');
    } else {
      if (locationStatus === 'granted') {
        startLocationToastUpdates();
        setLocationToastEnabled(true);
        Alert.alert('Location Tracking Started', 'Location tracking enabled every 5 minutes.');
      } else {
        Alert.alert('Permission Required', 'Please grant location permission first.');
      }
    }
  };

  const testAudioPermission = async () => {
    try {
      console.log('🎤 Testing microphone permission directly...');
      
      // First check/request permissions
      const { status } = await Audio.requestPermissionsAsync();
      console.log('🎤 Permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('🎤 Microphone Permission', `❌ Permission ${status}. Please grant microphone access in device settings.`);
        return;
      }
      
      // Set audio mode for recording (required for iOS)
      console.log('🎤 Setting audio mode for recording...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      // Test if we can create a recording with expo-av
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      
      Alert.alert('🎤 Microphone Test', '✅ Microphone access is working! You can now use audio recording features.');
      
      // Clean up
      await recording.stopAndUnloadAsync();
    } catch (error: any) {
      console.log('Audio test error:', error);
      Alert.alert('🎤 Microphone Test', `❌ Error: ${error?.message || 'Unknown error'}`);
    }
  };
  const handleCameraRef = (ref: any) => {
    cameraRef.current = ref;
    setCameraRef(ref);
  };

  const capturePhoto = async () => {
    try {
      await takePicture();
      Alert.alert('📸 Photo Captured', 'Photo has been taken and uploaded with location data!');
    } catch (error: any) {
      console.error('Photo capture error:', error);
      Alert.alert('❌ Error', `Failed to capture photo: ${error?.message || 'Unknown error'}`);
    }
  };

  const toggleCamera = () => {
    if (cameraPermission?.status !== 'granted') {
      Alert.alert('Camera Permission Required', 'Please grant camera permission first.');
      return;
    }
    setShowCamera(!showCamera);
  };



  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>📱 MyExpoApp</Text>
      
      {/* Main Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 Get Started</Text>
        <Button 
          title="🚀 Enable Startup" 
          onPress={requestAllPermissions}
          color="#27ae60"
        />
        <Text style={styles.helpText}>
          Tap above to request all permissions (Location, Audio, Camera) directly from the app.
        </Text>
        <Button 
          title="ℹ️ Permission Help" 
          onPress={openAppSettings}
          color="#95a5a6"
        />
      </View>

      {/* Dashboard Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Dashboard</Text>
        <Button 
          title="🔍 Test Connection" 
          onPress={handleTestDashboardConnection}
          color="#3498db"
        />
        <Button 
          title="🔧 Test Backend Command" 
          onPress={handleTestBackendConnectivity}
          color="#e67e22"
        />
        <Button 
          title="📱 Register Device" 
          onPress={handleDeviceRegistration}
          color={registrationStatus === 'registered' ? "#27ae60" : "#e67e22"}
        />
        <Text style={styles.statusText}>
          Registration: {registrationStatus === 'registered' ? '✅ Registered' : 
                        registrationStatus === 'registering' ? '⏳ Registering...' :
                        registrationStatus === 'failed' ? '❌ Failed' : '❌ Not Registered'}
        </Text>
        {deviceId && (
          <Text style={styles.statusText}>Device ID: {deviceId}</Text>
        )}
      </View>

      {/* Location Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Location</Text>
        <Button 
          title={locationToastEnabled ? "🛑 Stop Tracking" : "🎯 Start Tracking"} 
          onPress={toggleLocationToasts}
          color={locationToastEnabled ? "#ff6b6b" : "#4ecdc4"}
        />
      </View>

      {/* Camera Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📸 Camera</Text>
        <Button 
          title={showCamera ? "📷 Hide Camera" : "📷 Show Camera"} 
          onPress={toggleCamera}
          color="#e67e22"
        />
        {showCamera && cameraPermission?.status === 'granted' && (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={handleCameraRef}
              style={styles.camera}
              facing="back"
            >
              <View style={styles.cameraOverlay}>
                <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        )}
        {showCamera && cameraPermission?.status !== 'granted' && (
          <Text style={styles.cameraErrorText}>
            Camera permission required to show camera view
          </Text>
        )}
      </View>

      {/* Audio Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎤 Audio</Text>
        <Button 
          title="🔊 Test Audio" 
          onPress={testAudioPermission}
          color="#9b59b6"
        />
        <Button 
          title={showAudioFiles ? "📁 Hide Files" : "📁 Show Files"} 
          onPress={toggleAudioFiles}
          color="#8e44ad"
        />
        <Text style={styles.helpText}>
          📍 Audio recording is controlled remotely from the dashboard.{'\n'}
          Use the dashboard to start/stop recording.
        </Text>
      </View>

      {/* Audio Files Section */}
      {showAudioFiles && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📁 Audio Files ({audioFiles.length})</Text>
          {audioFiles.length === 0 ? (
            <Text style={styles.statusText}>No audio files found. Record some audio first!</Text>
          ) : (
            audioFiles.map((file, index) => (
              <View key={index} style={styles.audioFileItem}>
                <View style={styles.audioFileInfo}>
                  <Text style={styles.audioFileName}>{file.name}</Text>
                  <Text style={styles.audioFileDetails}>
                    Size: {Math.round(file.size / 1024)}KB | 
                    Date: {new Date(file.modificationTime).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.audioFileActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.downloadButton]}
                    onPress={() => handleDownloadAudio(file)}
                  >
                    <Text style={styles.actionButtonText}>📥</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.shareButton]}
                    onPress={() => handleShareAudio(file)}
                  >
                    <Text style={styles.actionButtonText}>📤</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}


      {/* Status Display */}
      <View style={styles.statusSection}>
        <Text style={styles.statusTitle}>📊 Status</Text>
        <Text style={styles.statusText}>Camera: {cameraPermission?.status || 'unknown'}</Text>
        <Text style={styles.statusText}>Audio: {audioStatus}</Text>
        <Text style={styles.statusText}>Location: {locationStatus}</Text>
        <Text style={styles.statusText}>App: {enabled ? '✅ Enabled' : '❌ Disabled'}</Text>
        <Text style={styles.statusText}>
          Tracking: {locationToastEnabled ? `🟢 Active (${locationUpdateCount} updates sent)` : '🔴 Inactive'}
        </Text>
        <Text style={styles.statusText}>Dashboard: {registrationStatus === 'registered' ? '✅ Connected' : 
                                        registrationStatus === 'registering' ? '⏳ Connecting...' :
                                        registrationStatus === 'failed' ? '❌ Failed' : '❌ Not Connected'}</Text>
        <Text style={styles.statusText}>Audio Quality: {getAudioQualityInfo().quality} ({getAudioQualityInfo().bitRate})</Text>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  helpText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statusSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  statusText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#34495e',
  },
  cameraContainer: {
    height: 200,
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  cameraErrorText: {
    textAlign: 'center',
    color: '#e74c3c',
    marginTop: 10,
    fontSize: 14,
  },
  audioFileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginVertical: 5,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  audioFileInfo: {
    flex: 1,
    marginRight: 10,
  },
  audioFileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  audioFileDetails: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  audioFileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadButton: {
    backgroundColor: '#27ae60',
  },
  shareButton: {
    backgroundColor: '#3498db',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#fff',
  },
});
