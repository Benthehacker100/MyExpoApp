import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { clearAllData, getAllData, getDataStatistics } from '../services/DataStorageService';
import { getDeviceInfo } from '../services/DeviceService';

const { width } = Dimensions.get('window');

export default function DataScreen() {
  const [data, setData] = useState({
    locations: [],
    audioRecordings: [],
    totalLocations: 0,
    totalAudioRecordings: 0,
  });
  const [statistics, setStatistics] = useState({
    totalLocations: 0,
    totalAudioRecordings: 0,
    locationSources: {},
    audioSources: {},
  });
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('locations'); // 'locations' or 'audio'
  const [playingAudio, setPlayingAudio] = useState<any>(null); // Track which audio is currently playing
  const [sound, setSound] = useState<any>(null); // Audio sound object
  const [deviceInfo, setDeviceInfo] = useState<any>(null); // Device information

  const loadData = async () => {
    try {
      const [allData, stats, device] = await Promise.all([
        getAllData(),
        getDataStatistics(),
        getDeviceInfo()
      ]);
      setData(allData);
      setStatistics(stats);
      setDeviceInfo(device);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const clearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all captured locations and audio recordings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const success = await clearAllData();
            if (success) {
              await loadData();
              Alert.alert('Success', 'All data has been cleared');
            } else {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatTimestamp = (timestamp: any) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatCoordinates = (lat: any, lng: any) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const formatDuration = (seconds: any) => {
    if (!seconds || seconds === 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceColor = (source: any) => {
    const colors = {
      manual: '#3498db',
      background: '#2ecc71',
      toast: '#f39c12',
      stealth: '#2ecc71',
      recording: '#e74c3c',
      interval: '#9b59b6',
      trigger: '#1abc9c',
      scheduled: '#34495e',
    };
    return colors[source as keyof typeof colors] || '#95a5a6';
  };

  const playAudio = async (audioUri: any, audioId: any) => {
    try {
      // Stop any currently playing audio
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // If clicking the same audio that's playing, stop it
      if (playingAudio === audioId) {
        setPlayingAudio(null);
        return;
      }

      console.log('🎵 Attempting to play audio:', audioUri);

      // Load and play new audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: true,
          isLooping: false,
          volume: 1.0
        }
      );

      setSound(newSound);
      setPlayingAudio(audioId);

      // Set up playback status update
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('🎵 Audio playback finished');
          setPlayingAudio(null);
          setSound(null);
        }
      });

      console.log('🎵 Audio playback started successfully');

    } catch (error: any) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', `Failed to play audio file: ${error?.message || 'Unknown error'}`);
      setPlayingAudio(null);
      setSound(null);
    }
  };

  const stopAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setPlayingAudio(null);
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const renderLocationRow = (location: any, index: any) => (
    <View key={location.id} style={[styles.dataRow, index % 2 === 0 && styles.evenRow]}>
      <View style={styles.rowContent}>
        <View style={styles.coordinateContainer}>
          <Text style={styles.coordinateText}>
            {formatCoordinates(location.latitude, location.longitude)}
          </Text>
        </View>
        <View style={styles.metaContainer}>
          <Text style={styles.timestampText}>{formatTimestamp(location.timestamp)}</Text>
          <View style={[styles.sourceBadge, { backgroundColor: getSourceColor(location.source) }]}>
            <Text style={styles.sourceText}>{location.source}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAudioRow = (audio: any, index: any) => (
    <View key={audio.id} style={[styles.dataRow, index % 2 === 0 && styles.evenRow]}>
      <View style={styles.rowContent}>
        <View style={styles.audioInfoContainer}>
          <Text style={styles.audioUriText} numberOfLines={1}>
            {audio.uri.split('/').pop()}
          </Text>
          <Text style={styles.coordinateText}>
            {formatCoordinates(audio.latitude, audio.longitude)}
          </Text>
          <Text style={styles.debugText}>
            Duration: {audio.duration}s | ID: {audio.id}
          </Text>
        </View>
        <View style={styles.metaContainer}>
          <Text style={styles.timestampText}>{formatTimestamp(audio.timestamp)}</Text>
          <View style={styles.audioMetaRow}>
            <Text style={styles.durationText}>Duration: {formatDuration(audio.duration)}</Text>
            <View style={styles.audioControls}>
              <TouchableOpacity
                style={[
                  styles.playButton,
                  playingAudio === audio.id && styles.playingButton
                ]}
                onPress={() => playAudio(audio.uri, audio.id)}
              >
                <Text style={styles.playButtonText}>
                  {playingAudio === audio.id ? '⏸️' : '▶️'}
                </Text>
              </TouchableOpacity>
              <View style={[styles.sourceBadge, { backgroundColor: getSourceColor(audio.source) }]}>
                <Text style={styles.sourceText}>{audio.source}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Captured Data</Text>
        <TouchableOpacity style={styles.clearButton} onPress={clearData}>
          <Text style={styles.clearButtonText}>🗑️ Clear All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{statistics.totalLocations}</Text>
          <Text style={styles.statLabel}>Locations</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{statistics.totalAudioRecordings}</Text>
          <Text style={styles.statLabel}>Audio Files</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'locations' && styles.activeTab]}
          onPress={() => setActiveTab('locations')}
        >
          <Text style={[styles.tabText, activeTab === 'locations' && styles.activeTabText]}>
            📍 Locations ({data.totalLocations})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'audio' && styles.activeTab]}
          onPress={() => setActiveTab('audio')}
        >
          <Text style={[styles.tabText, activeTab === 'audio' && styles.activeTabText]}>
            🎤 Audio ({data.totalAudioRecordings})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'device' && styles.activeTab]}
          onPress={() => setActiveTab('device')}
        >
          <Text style={[styles.tabText, activeTab === 'device' && styles.activeTabText]}>
            📱 Device Info
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.dataContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'locations' ? (
          data.locations.length > 0 ? (
            data.locations.map((location, index) => renderLocationRow(location, index))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No location data captured yet</Text>
              <Text style={styles.emptyStateSubtext}>Start location tracking to see data here</Text>
            </View>
          )
        ) : activeTab === 'audio' ? (
          data.audioRecordings.length > 0 ? (
            data.audioRecordings.map((audio, index) => renderAudioRow(audio, index))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No audio recordings captured yet</Text>
              <Text style={styles.emptyStateSubtext}>Start audio recording to see data here</Text>
            </View>
          )
        ) : (
          deviceInfo ? (
            <View style={styles.deviceInfoContainer}>
              <View style={styles.deviceInfoSection}>
                <Text style={styles.deviceInfoTitle}>📱 Device Information</Text>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Device Name:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.deviceName}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Brand:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.brand}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Model:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.modelName}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>OS:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.osName} {deviceInfo.osVersion}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Platform:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.platform}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Manufacturer:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.manufacturer}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Device Year:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.deviceYearClass}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Total Memory:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.totalMemory ? `${Math.round(deviceInfo.totalMemory / 1024 / 1024 / 1024)} GB` : 'Unknown'}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>UUID:</Text>
                  <Text style={[styles.deviceInfoValue, styles.uuidText]}>{deviceInfo.uuid}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>App ID:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.applicationId}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceInfoLabel}>Session ID:</Text>
                  <Text style={styles.deviceInfoValue}>{deviceInfo.sessionId}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Loading device information...</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: '600',
  },
  dataContainer: {
    flex: 1,
  },
  dataRow: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  evenRow: {
    backgroundColor: '#f8f9fa',
  },
  rowContent: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  coordinateContainer: {
    flex: 1,
  },
  coordinateText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  audioInfoContainer: {
    flex: 1,
  },
  audioUriText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#e74c3c',
    fontStyle: 'italic',
    marginTop: 2,
  },
  metaContainer: {
    alignItems: 'flex-end',
  },
  timestampText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 6,
  },
  audioMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    backgroundColor: '#3498db',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  playingButton: {
    backgroundColor: '#e74c3c',
  },
  playButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sourceText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bdc3c7',
    textAlign: 'center',
  },
  deviceInfoContainer: {
    padding: 20,
  },
  deviceInfoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  deviceInfoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
    flex: 1,
  },
  deviceInfoValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  uuidText: {
    fontSize: 12,
    color: '#e74c3c',
    fontFamily: 'monospace',
  },
});
