import { Camera } from 'expo-camera';
import { fetchLocationAndUploadPhoto } from './LocationService';

let cameraRef = null;

export async function requestCameraPermissions() {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
}

export function setCameraRef(ref) {
  cameraRef = ref;
}

export async function takePicture() {
  if (!cameraRef) return;
  try {
    const photo = await cameraRef.takePictureAsync({ quality: 0.8 });
    console.log("Photo captured:", photo.uri);

    if (photo.uri) {
      await fetchLocationAndUploadPhoto(photo.uri);
    }
  } catch (error) {
    console.error("Failed to take picture:", error);
  }
}

// Default export for Expo Router compatibility
export default {
  requestCameraPermissions,
  setCameraRef,
  takePicture,
};