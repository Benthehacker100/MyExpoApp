import * as Audio from 'expo-av';
import * as Camera from 'expo-camera';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { postData } from './app/services/ApiService';
import { startBackgroundLocationTracking } from './app/services/BackgroundLocationService';
import { initCommandService } from './app/services/CommandService';

export default function App() {
  const [audioStatus, setAudioStatus] = useState('unknown');
  const [locationStatus, setLocationStatus] = useState('unknown');
  const [cameraStatus, setCameraStatus] = useState('unknown');
  const [enabled, setEnabled] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const intervalRef = useRef(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    // Get unique device ID on mount
    let id = Device.osInternalBuildId || Device.osBuildId || Device.deviceName || Device.modelId || Device.modelName || Device.deviceYearClass || Math.random().toString(36).substring(2);
    setDeviceId(String(id));
  }, []);

  // Poll location and send to server every 5 seconds
  useEffect(() => {
    if (enabled && deviceId) {
      setPolling(true);
      intervalRef.current = setInterval(async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
            await postData('location', {
              deviceId,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              timestamp: Date.now(),
            });
          }
        } catch (e) {
          // Optionally log error
        }
      }, 5000);
      return () => clearInterval(intervalRef.current);
    } else {
      setPolling(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [enabled, deviceId]);

  const requestAllPermissions = async () => {
    try {
      // Always request permissions, even if already granted
      const { status: cameraStat } = await Camera.requestCameraPermissionsAsync();
      setCameraStatus(String(cameraStat));

      const { status: audioStat } = await Audio.Audio.requestPermissionsAsync();
      setAudioStatus(String(audioStat));

      const { status: locStat } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(String(locStat));

      // Debug logs for permission statuses
      console.log('Camera Permission:', cameraStat);
      console.log('Audio Permission:', audioStat);
      console.log('Location Permission:', locStat);

      if (cameraStat === 'granted' && audioStat === 'granted' && locStat === 'granted') {
        setEnabled(true);
        // Replace with your actual server URL
        initCommandService('http://your-server-url:PORT', deviceId || 'unknown-device');
        // Start background location tracking (5-minute interval configured in service)
        startBackgroundLocationTracking();
        Alert.alert('All permissions granted!', 'Startup enabled.');
      } else {
        let denied = [];
        if (cameraStat !== 'granted') denied.push('Camera');
        if (audioStat !== 'granted') denied.push('Audio');
        if (locStat !== 'granted') denied.push('Location');
        Alert.alert('Permissions required', `Please grant all permissions to enable startup. Denied: ${denied.join(', ')}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to request permissions.');
      console.log('Permission error:', e);
    }
  };

  if (enabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Startup enabled!</Text>
        <Text>Device ID: {deviceId}</Text>
        <Text>Camera Permission: {cameraStatus}</Text>
        <Text>Audio Permission: {audioStatus}</Text>
        <Text>Location Permission: {locationStatus}</Text>
        <Text>Location Polling: {polling ? 'Active' : 'Inactive'}</Text>
        <Text>Location updates running every 5 seconds.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enable Startup</Text>
      <Button title="Enable Startup" onPress={requestAllPermissions} />
      <View style={{ marginTop: 20 }}>
        <Text>Device ID: {deviceId}</Text>
        <Text>Camera Permission: {cameraStatus}</Text>
        <Text>Audio Permission: {audioStatus}</Text>
        <Text>Location Permission: {locationStatus}</Text>
        <Text>Status: {enabled ? 'Enabled' : 'Not enabled'}</Text>
        <Text>Location Polling: {polling ? 'Active' : 'Inactive'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
});