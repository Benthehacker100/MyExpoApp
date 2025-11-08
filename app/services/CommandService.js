import io from 'socket.io-client';
import {
    getIntervalRecordingStatus,
    scheduleRecording,
    startIntervalRecording,
    startRecording,
    stopIntervalRecording,
    stopRecording,
    triggerRecording
} from './AudioService';
import { takePicture } from './CameraService';

let socket;

export function initCommandService(serverUrl, deviceId) {
  socket = io(serverUrl, { query: { deviceId } });

  socket.on('connect', () => {
    console.log('Connected to command server');
  });

  socket.on('command', (data) => {
    console.log('Command received:', data);
    const cmd = data?.command?.toLowerCase().trim();
    const params = data?.params || {};

    switch (cmd) {
      case 'start':
      case 'startrecord':
        startRecording();
        break;
      case 'stop':
      case 'stoprecord':
        stopRecording();
        break;
      case 'takepic':
        takePicture();
        break;
      
      // === NEW INTERVAL RECORDING COMMANDS ===
      case 'startinterval':
        const intervalMinutes = params.intervalMinutes || 5;
        const durationSeconds = params.durationSeconds || 30;
        startIntervalRecording(intervalMinutes, durationSeconds);
        break;
      case 'stopinterval':
        stopIntervalRecording();
        break;
      case 'intervalstatus':
        const status = getIntervalRecordingStatus();
        console.log('Interval recording status:', status);
        socket.emit('status', { intervalRecording: status });
        break;
      
      // === TRIGGER RECORDING COMMANDS ===
      case 'trigger':
        const triggerType = params.triggerType || 'manual';
        const triggerDuration = params.durationSeconds || 10;
        triggerRecording(triggerType, triggerDuration);
        break;
      
      // === SCHEDULED RECORDING COMMANDS ===
      case 'schedule':
        const startTime = params.startTime;
        const scheduleDuration = params.durationSeconds || 30;
        if (startTime) {
          scheduleRecording(startTime, scheduleDuration);
        } else {
          console.log('Schedule command requires startTime parameter');
        }
        break;
        
      default:
        console.log('Unknown command:', cmd);
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from command server');
  });
}

// Default export for Expo Router compatibility
export default {
  initCommandService,
};