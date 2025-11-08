# MyExpoApp - Location & Audio Tracking App

A comprehensive React Native Expo app that provides stealth location tracking, audio recording, and data management capabilities.

## 🚀 Features

### 📍 Location Tracking
- **Stealth Mode**: Silent location tracking without toast notifications or beeping
- **Background Tracking**: Continuous location updates even when app is closed
- **Multiple Sources**: Manual, background, toast, and stealth location capture
- **Minimal Battery Usage**: Optimized settings to reduce location signal indicator

### 🎤 Audio Recording
- **Multiple Recording Modes**:
  - Manual recording
  - Interval recording (every X minutes for Y seconds)
  - Trigger-based recording
  - Scheduled recording
- **Audio Playback**: Built-in audio player in the data table
- **Duration Tracking**: Accurate recording duration capture
- **Location Tagging**: Each recording is tagged with GPS coordinates

### 📊 Data Management
- **Data Table**: Comprehensive view of all captured locations and audio recordings
- **Local Storage**: All data stored locally using AsyncStorage
- **Statistics**: Real-time statistics on captured data
- **Data Export**: Clear all data functionality
- **Pull-to-Refresh**: Easy data refresh in the table

### 🔧 Technical Features
- **Permission Management**: Comprehensive camera, audio, and location permissions
- **WebSocket Integration**: Remote control via CommandService
- **API Integration**: Data upload capabilities (with development flags)
- **Background Tasks**: Background location and fetch tasks
- **Error Handling**: Robust error handling throughout the app

## 📱 App Structure

### Main Screens
- **Home Tab**: Main control panel with permission management and feature toggles
- **Explore Tab**: Additional features and settings
- **Data Tab**: Data table showing all captured locations and audio recordings

### Services
- **LocationService**: Handles location fetching and stealth tracking
- **AudioService**: Manages all audio recording functionality
- **DataStorageService**: Local data persistence using AsyncStorage
- **BackgroundLocationService**: Background location tracking
- **ApiService**: Server communication and data uploads
- **CommandService**: WebSocket-based remote control

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Expo CLI
- iOS Simulator or Android Emulator
- Physical device with Expo Go app

### Installation Steps

1. **Clone/Download the project**
   ```bash
   cd /path/to/your/projects
   # Extract the backup file if needed
   tar -xzf MyExpoApp_backup_20250913_074947.tar.gz
   ```

2. **Install dependencies**
   ```bash
   cd MyExpoApp
   npm install
   ```

3. **Start the development server**
   ```bash
   npx expo start --clear
   ```

4. **Run on device/simulator**
   - Scan QR code with Expo Go (Android) or Camera app (iOS)
   - Or press `i` for iOS simulator, `a` for Android emulator

## 📋 Usage Guide

### Initial Setup
1. **Grant Permissions**: Tap "Enable Startup" to request all necessary permissions
2. **Location Tracking**: Toggle "Start Location Tracking" for stealth mode
3. **Audio Recording**: Use "Start Interval Recording" for automatic audio capture

### Data Viewing
1. **Navigate to Data Tab**: View all captured data
2. **Switch Between Tabs**: Locations and Audio Recordings
3. **Play Audio**: Tap the play button (▶️) to listen to recordings
4. **Refresh Data**: Pull down to refresh the data table

### Recording Controls
- **Manual Recording**: Use the manual recording button
- **Interval Recording**: Set automatic recording intervals
- **Trigger Recording**: Remote-triggered recordings
- **Scheduled Recording**: Set specific times for recording

## 🔧 Configuration

### App Configuration (`app.json`)
- **Permissions**: All necessary iOS and Android permissions configured
- **Background Modes**: Location and background processing enabled
- **Plugins**: Expo AV, Task Manager, and other required plugins

### Development Settings
- **API Uploads**: Disabled by default (set `ENABLE_UPLOADS` to `true` in ApiService.js)
- **Debug Logging**: Comprehensive logging throughout the app
- **Error Handling**: Graceful error handling with user-friendly messages

## 📁 Project Structure

```
MyExpoApp/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Main home screen
│   │   ├── explore.tsx        # Explore screen
│   │   ├── data.tsx           # Data table screen
│   │   └── _layout.tsx        # Tab navigation
│   ├── services/
│   │   ├── LocationService.js      # Location management
│   │   ├── AudioService.js         # Audio recording
│   │   ├── DataStorageService.js   # Local data storage
│   │   ├── BackgroundLocationService.js # Background tracking
│   │   ├── ApiService.js           # Server communication
│   │   ├── CommandService.js       # WebSocket commands
│   │   └── CameraService.js        # Camera functionality
│   └── _layout.tsx            # Root layout with Toast
├── components/                # Reusable UI components
├── constants/                 # App constants and colors
├── hooks/                     # Custom React hooks
├── assets/                    # Images, fonts, and other assets
├── package.json              # Dependencies and scripts
├── app.json                  # Expo configuration
└── README.md                 # This file
```

## 🔒 Privacy & Security

- **Local Storage**: All data stored locally on device
- **No Cloud Sync**: Data remains on device unless explicitly uploaded
- **Permission-Based**: All features require explicit user permission
- **Stealth Mode**: Location tracking without visual/audio indicators
- **Data Control**: Users can clear all data at any time

## 🐛 Troubleshooting

### Common Issues

1. **Audio Permission Denied**
   - Go to device Settings > Privacy > Microphone
   - Enable microphone access for the app

2. **Location Not Working**
   - Check device location services are enabled
   - Grant location permissions when prompted
   - Ensure GPS is enabled

3. **Audio Playback Issues**
   - Check device volume settings
   - Ensure audio files are not corrupted
   - Try restarting the app

4. **Background Location Not Working**
   - Grant "Always" location permission
   - Check device battery optimization settings
   - Ensure app is not force-closed

### Development Issues

1. **Metro Bundler Errors**
   ```bash
   npx expo start --clear --reset-cache
   ```

2. **iOS Simulator Issues**
   ```bash
   xcode-select --install
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

3. **Package Conflicts**
   ```bash
   npm install --legacy-peer-deps
   npx expo install --fix
   ```

## 📈 Performance Optimization

- **Battery Usage**: Optimized location accuracy and update intervals
- **Storage Management**: Automatic data trimming (1000 locations, 500 audio files)
- **Memory Management**: Proper cleanup of audio and location resources
- **Background Efficiency**: Minimal background processing

## 🔄 Updates & Maintenance

### Regular Maintenance
- Clear old data periodically using the "Clear All Data" button
- Monitor storage usage in device settings
- Update Expo SDK when new versions are available

### Backup Strategy
- Project is backed up as: `MyExpoApp_backup_20250913_074947.tar.gz`
- Git repository initialized for version control
- Regular commits recommended for code changes

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the console logs for error details
3. Ensure all permissions are granted
4. Try restarting the app and development server

## 📄 License

This project is for educational and development purposes. Please ensure compliance with local privacy laws and regulations when using location tracking features.

---

**Last Updated**: September 13, 2025  
**Version**: 1.0.0  
**Expo SDK**: 54.0.3# MyExpoApp
