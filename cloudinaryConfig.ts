import { Platform } from 'react-native';

const CLOUD_NAME = 'h4j8tsin';
const UPLOAD_PRESET = 'HabitGram';

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export async function uploadImageToCloudinary(uri: string, timeoutMs = 20000): Promise<string> {
  if (CLOUD_NAME === 'YOUR_CLOUD_NAME' || UPLOAD_PRESET === 'YOUR_UPLOAD_PRESET') {
    throw new Error('Cloudinary is not configured yet (check cloudinaryConfig.ts)');
  }

  const formData = new FormData();

  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    formData.append('file', blob);
  } else {
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: `upload_${Date.now()}.jpg`,
    } as any);
  }

  formData.append('upload_preset', UPLOAD_PRESET);

  const uploadPromise = (async () => {
    const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok || !data?.secure_url) {
      throw new Error(data?.error?.message || 'Cloudinary upload failed');
    }
    return data.secure_url as string;
  })();

  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error('Upload timed out')), timeoutMs)
  );

  return await Promise.race([uploadPromise, timeoutPromise]);
}