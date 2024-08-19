
import {CLOUDINARY_CLOUD_NAME ,CLOUDINARY_API_KEY,CLOUDINARY_API_SECRET } from '../env/server-env';
import { v2 as cloudinary } from 'cloudinary';

const cloudinaryConfig = { 
    cloud_name: CLOUDINARY_CLOUD_NAME, 
    api_key: CLOUDINARY_API_KEY, 
    api_secret: CLOUDINARY_API_SECRET 
  }


export async function uploadVideoToTheCloud(filePath: string, publicId: string): Promise<any> {
    cloudinary.config(cloudinaryConfig)
    const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
      resource_type: "video",
      public_id: publicId,
      folder: "vibra",
      overwrite: true
    })
    return cloudinaryResponse
  }

export async function uploadGifToTheCloud(filePath: string, publicId: string, folderName: string = "vibra"): Promise<any> {
    cloudinary.config(cloudinaryConfig)
    const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
        resource_type: "image",
        public_id: publicId,
        folder: folderName,
        overwrite: true
      })
    return cloudinaryResponse
  }


export async function uploadInitialGifOfFrame(filePath: string, publicId: string): Promise<any> {
    cloudinary.config(cloudinaryConfig)
    const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
        resource_type: "image",
        public_id: publicId,
        upload_preset: "frame_gifs",
        overwrite: true,
        invalidate: true
    })
    return cloudinaryResponse
}