import { Audio, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { fetchLocation, fetchLocationAndUploadAudio } from './LocationService';
import { sendRecordingEvent } from './ApiService';

let recording = null;
let intervalRecordingTimer = null;
let isIntervalRecordingActive = false;

async function notifyRecordingStatus(eventType, extra = {}) {
  try {
    const { latitude, longitude } = await fetchLocation();
    await sendRecordingEvent(eventType, latitude, longitude, {
      platform: 'ios',
      ...extra,
    });
  } catch (error) {
    console.log(`⚠️ Failed to send recording status "${eventType}":`, error.message);
  }
}

export async function startRecording() {
  try {
    // Check if already recording
    if (recording) {
      try {
        const status = await recording.getStatusAsync();
        if (status?.isRecording) {
          console.log("⚠️ Recording already in progress, reusing existing session");
          return {
            success: true,
            alreadyRecording: true,
            message: "Recording already in progress",
          };
        }
        // Recording object exists but not recording - clean it up
        console.log("🧹 Cleaning up stale recording object");
        try {
          await recording.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log("Cleanup error (non-critical):", cleanupError.message);
        }
      } catch (statusError) {
        console.log("⚠️ Could not inspect existing recording status:", statusError.message);
        try {
          await recording.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log("Cleanup error (non-critical):", cleanupError.message);
        }
      }
      recording = null;
    }

    console.log("🎤 Requesting audio permissions...");
    const permissionResponse = await Audio.requestPermissionsAsync();
    console.log("🎤 Permission status:", permissionResponse.status);
    
    if (!permissionResponse.granted) {
      const errorMsg = "Audio recording permission not granted";
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    console.log("🎤 Setting audio mode...");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    });

    console.log("🎤 Creating new Audio.Recording instance...");
    recording = new Audio.Recording();
    
    // WhatsApp-quality audio settings (AAC format with high bitrate)
    const recordingOptions = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100, // CD quality sample rate
        numberOfChannels: 1, // Mono for smaller file size
        bitRate: 128000, // 128 kbps - WhatsApp quality
        maxFileSize: 10 * 1024 * 1024, // 10MB max file size
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100, // CD quality sample rate
        numberOfChannels: 1, // Mono for smaller file size
        bitRate: 128000, // 128 kbps - WhatsApp quality
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      },
    };
    
    console.log("🎤 Preparing to record with options:", JSON.stringify(recordingOptions, null, 2));
    await recording.prepareToRecordAsync(recordingOptions);
    console.log("✅ Recording prepared successfully");
    
    console.log("🎤 Starting recording...");
    await recording.startAsync();
    
    // Verify recording actually started
    const status = await recording.getStatusAsync();
    if (!status.isRecording) {
      const errorMsg = "Recording start command failed - status shows not recording";
      console.error(`❌ ${errorMsg}`);
      recording = null;
      return { success: false, error: errorMsg };
    }
    
    console.log("✅ Recording started successfully!");
    console.log("🎤 Recording started with WhatsApp-quality AAC settings:");
    console.log("   📊 Sample Rate: 44.1kHz (CD Quality)");
    console.log("   📊 Bit Rate: 128 kbps (WhatsApp Quality)");
    console.log("   📊 Format: AAC (.m4a)");
    console.log("   📊 Channels: Mono (optimized for voice)");
    console.log("   📊 Status:", JSON.stringify(status));
    
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to start recording:", error);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    recording = null; // Clear on error
    return { success: false, error: error.message || "Unknown error starting recording" };
  }
}

export async function stopRecording() {
  if (!recording) {
    console.log("⚠️ No recording to stop (recording object is null)");
    return null;
  }
  
  try {
    // Check if actually recording
    const status = await recording.getStatusAsync();
    if (!status.isRecording) {
      console.log("⚠️ Recording object exists but is not currently recording");
      // Still clean it up
      try {
        await recording.stopAndUnloadAsync();
      } catch (cleanupError) {
        console.log("Cleanup error (non-critical):", cleanupError.message);
      }
      recording = null;
      return null;
    }
    
    console.log("⏹️ Stopping recording...");
    const currentRecording = recording;
    recording = null; // Clear recording reference first to prevent double stops
    
    await currentRecording.stopAndUnloadAsync();
    const uri = currentRecording.getURI();
    const finalStatus = await currentRecording.getStatusAsync();
    const duration = finalStatus.durationMillis ? finalStatus.durationMillis / 1000 : 0; // Convert to seconds
    console.log("✅ Recording stopped successfully!");
    console.log("   📁 File URI:", uri);
    console.log("   ⏱️ Duration:", duration, "seconds");
    console.log("   📊 Final status:", JSON.stringify(finalStatus));

    // Upload with location
    if (uri) {
      console.log("📤 Uploading recording with location...");
      await fetchLocationAndUploadAudio(uri, duration);
    } else {
      console.warn("⚠️ No URI returned from recording - cannot upload");
    }
    
    return uri;
  } catch (error) {
    console.error("❌ Failed to stop recording:", error);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    recording = null; // Make sure to clear reference even on error
    return null;
  }
}

// === INTERVAL RECORDING FUNCTIONS ===

export async function startIntervalRecording(intervalMinutes = 5, durationSeconds = 30) {
  if (isIntervalRecordingActive) {
    console.log("Interval recording already active");
    return;
  }

  console.log(`🎤 Starting interval recording: every ${intervalMinutes} minutes for ${durationSeconds} seconds`);
  isIntervalRecordingActive = true;

  const recordingFunction = async () => {
    if (!isIntervalRecordingActive) return;
    
    // Skip if already recording
    if (recording) {
      console.log("🎤 Skipping interval recording - already recording");
      return;
    }
    
    try {
      console.log("🎤 Starting automatic recording...");
      await startRecording();
      
      // Record for specified duration
      setTimeout(async () => {
        if (recording && isIntervalRecordingActive) {
          console.log("🎤 Stopping automatic recording...");
          await stopRecording();
        }
      }, durationSeconds * 1000);
      
    } catch (error) {
      console.error("Interval recording error:", error);
    }
  };

  // Start first recording immediately
  await recordingFunction();

  // Set up interval for subsequent recordings
  intervalRecordingTimer = setInterval(recordingFunction, intervalMinutes * 60 * 1000);
}

export async function stopIntervalRecording() {
  console.log("🎤 Stopping interval recording");
  isIntervalRecordingActive = false;
  
  if (intervalRecordingTimer) {
    clearInterval(intervalRecordingTimer);
    intervalRecordingTimer = null;
  }

  // Stop current recording if active
  if (recording) {
    console.log("🎤 Stopping current recording due to interval recording stop");
    await stopRecording();
  }
}

export function getIntervalRecordingStatus() {
  return {
    isActive: isIntervalRecordingActive,
    hasTimer: intervalRecordingTimer !== null,
    isCurrentlyRecording: recording !== null
  };
}

export function getAudioQualityInfo() {
  return {
    format: 'AAC (.m4a)',
    sampleRate: '44.1kHz',
    bitRate: '128 kbps',
    channels: 'Mono',
    quality: 'WhatsApp Quality',
    description: 'CD-quality sample rate with optimized bitrate for voice recording'
  };
}

/**
 * Get all recorded audio files from the app's cache directory
 */
export async function getRecordedAudioFiles() {
  try {
    console.log('📁 Getting recorded audio files...');
    
    // Get the app's cache directory where recordings are stored
    const cacheDir = FileSystem.cacheDirectory + 'ExponentExperienceData/';
    
    let audioFiles = [];
    
    try {
      // List all directories in the cache
      const dirs = await FileSystem.readDirectoryAsync(cacheDir);
      
      for (const dir of dirs) {
        if (dir.includes('MyExpoApp')) {
          const avPath = cacheDir + dir + '/AV/';
          try {
            const files = await FileSystem.readDirectoryAsync(avPath);
            for (const file of files) {
              if (file.endsWith('.m4a') || file.endsWith('.wav') || file.endsWith('.aac')) {
                const fileInfo = await FileSystem.getInfoAsync(avPath + file);
                if (fileInfo.exists) {
                  audioFiles.push({
                    name: file,
                    uri: avPath + file,
                    size: fileInfo.size,
                    modificationTime: fileInfo.modificationTime,
                    isDirectory: fileInfo.isDirectory
                  });
                }
              }
            }
          } catch (error) {
            console.log(`Could not read directory ${avPath}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.log('Could not read cache directory:', error.message);
    }
    
    // Sort by modification time (newest first)
    audioFiles.sort((a, b) => b.modificationTime - a.modificationTime);
    
    console.log(`📁 Found ${audioFiles.length} audio files`);
    return audioFiles;
    
  } catch (error) {
    console.error('❌ Error getting audio files:', error);
    return [];
  }
}

/**
 * Download/save audio file to device's media library
 */
export async function downloadAudioFile(audioFile) {
  try {
    console.log('📥 Downloading audio file:', audioFile.name);
    
    // Request media library permissions
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission not granted');
    }
    
    // Create a new filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newFileName = `MyExpoApp_Recording_${timestamp}.m4a`;
    
    // Copy file to a temporary location with a proper name
    const tempDir = FileSystem.cacheDirectory + 'Downloads/';
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    
    const tempUri = tempDir + newFileName;
    await FileSystem.copyAsync({
      from: audioFile.uri,
      to: tempUri
    });
    
    // Save to media library
    const asset = await MediaLibrary.createAssetAsync(tempUri);
    
    // Create an album for our app
    const albumName = 'MyExpoApp Recordings';
    let album = await MediaLibrary.getAlbumAsync(albumName);
    if (!album) {
      album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }
    
    // Clean up temp file
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
    
    console.log('✅ Audio file saved to media library:', newFileName);
    return {
      success: true,
      fileName: newFileName,
      album: albumName,
      message: `Audio saved to ${albumName} album`
    };
    
  } catch (error) {
    console.error('❌ Error downloading audio file:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to download: ${error.message}`
    };
  }
}

/**
 * Share audio file using system sharing
 */
export async function shareAudioFile(audioFile) {
  try {
    console.log('📤 Sharing audio file:', audioFile.name);
    
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }
    
    // Create a temporary copy with a proper name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newFileName = `MyExpoApp_Recording_${timestamp}.m4a`;
    const tempDir = FileSystem.cacheDirectory + 'Share/';
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    
    const tempUri = tempDir + newFileName;
    await FileSystem.copyAsync({
      from: audioFile.uri,
      to: tempUri
    });
    
    // Share the file
    await Sharing.shareAsync(tempUri, {
      mimeType: 'audio/mp4',
      dialogTitle: 'Share Audio Recording',
      UTI: 'public.audio'
    });
    
    // Clean up temp file after a delay
    setTimeout(async () => {
      try {
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
      } catch (error) {
        console.log('Could not clean up temp file:', error.message);
      }
    }, 5000);
    
    console.log('✅ Audio file shared successfully');
    return {
      success: true,
      message: 'Audio file shared successfully'
    };
    
  } catch (error) {
    console.error('❌ Error sharing audio file:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to share: ${error.message}`
    };
  }
}

// === TRIGGER-BASED RECORDING ===

export async function triggerRecording(triggerType = "manual", durationSeconds = null) {
  try {
    // If durationSeconds is null, undefined, or 0, treat as continuous recording (no auto-stop)
    const isContinuous = !durationSeconds || durationSeconds === null || durationSeconds === 0;
    
    if (isContinuous) {
      console.log(`🎤 Trigger recording activated: ${triggerType} (CONTINUOUS - no auto-stop)`);
    } else {
      console.log(`🎤 Trigger recording activated: ${triggerType} (${durationSeconds}s)`);
    }
    
    const result = await startRecording();
    
    if (!result || !result.success) {
      const errorMsg = result?.error || "Unknown error starting recording";
      console.error(`❌ Failed to start recording for trigger ${triggerType}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (result.alreadyRecording) {
      console.log(`ℹ️ Recording already in progress for trigger ${triggerType} (treated as success)`);
      await notifyRecordingStatus('recording_already_active', {
        trigger: triggerType,
        mode: isContinuous ? 'continuous' : 'timed',
      });
      return { success: true, alreadyRecording: true };
    }

    await notifyRecordingStatus('recording_started', {
      trigger: triggerType,
      mode: isContinuous ? 'continuous' : 'timed',
    });
    
    if (isContinuous) {
      console.log(`✅ Recording started successfully for trigger ${triggerType} in CONTINUOUS mode (stops only on manual command)`);
    } else {
      console.log(`✅ Recording started successfully for trigger ${triggerType}, will auto-stop after ${durationSeconds}s`);
      
      // Auto-stop after duration (only if duration specified)
      setTimeout(async () => {
        if (recording) {
          const status = await recording.getStatusAsync().catch(() => ({ isRecording: false }));
          if (status.isRecording) {
            console.log(`🎤 Trigger recording auto-stopping after ${durationSeconds}s: ${triggerType}`);
            await stopRecording();
          } else {
            console.log(`⚠️ Recording already stopped when auto-stop triggered for ${triggerType}`);
          }
        } else {
          console.log(`⚠️ Recording object is null when auto-stop triggered for ${triggerType}`);
        }
      }, durationSeconds * 1000);
    }
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Trigger recording error (${triggerType}):`, error);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error stack:`, error.stack);
    return { success: false, error: error.message || "Unknown error in triggerRecording" };
  }
}

// === SCHEDULE-BASED RECORDING ===

export async function scheduleRecording(startTime, durationSeconds = 30) {
  const now = new Date();
  const scheduledTime = new Date(startTime);
  const delay = scheduledTime.getTime() - now.getTime();

  if (delay <= 0) {
    console.log("🎤 Scheduled time is in the past, recording immediately");
    await triggerRecording("scheduled", durationSeconds);
    return;
  }

  console.log(`🎤 Recording scheduled for ${scheduledTime.toLocaleString()}`);
  
  setTimeout(async () => {
    console.log("🎤 Executing scheduled recording");
    await triggerRecording("scheduled", durationSeconds);
  }, delay);
}

// Default export for Expo Router compatibility
export default {
  startRecording,
  stopRecording,
  startIntervalRecording,
  stopIntervalRecording,
  getIntervalRecordingStatus,
  triggerRecording,
  scheduleRecording,
  getAudioQualityInfo,
  getRecordedAudioFiles,
  downloadAudioFile,
  shareAudioFile,
};