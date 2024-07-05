
import { SECRET, CLOUDINARY_CLOUD_NAME ,CLOUDINARY_API_KEY,CLOUDINARY_API_SECRET, FILEBASE_API_TOKEN, DUMMY_BOT_SIGNER, NEYNAR_DUMMY_BOT_API_KEY } from '../env/server-env';
import { v2 as cloudinary } from 'cloudinary';

const cloudinaryConfig = { 
    cloud_name: CLOUDINARY_CLOUD_NAME, 
    api_key: CLOUDINARY_API_KEY, 
    api_secret: CLOUDINARY_API_SECRET 
  }


export async function uploadVideoToTheCloud(filePath: string, publicId: string): Promise<any> {
    cloudinary.config(cloudinaryConfig)
    return cloudinary.uploader.upload(filePath, {
      resource_type: "video",
      public_id: publicId,
      folder: "zurf",
      overwrite: true
    })
  }

  export async function uploadGifToTheCloud(filePath: string, publicId: string): Promise<any> {
    cloudinary.config(cloudinaryConfig)
    return cloudinary.uploader.upload(filePath, {
      resource_type: "image",
      public_id: publicId,
      folder: "zurf",
      overwrite: true
    })
  }