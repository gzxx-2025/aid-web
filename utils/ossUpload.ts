/**
 * OSS 上传业务封装（带 Toast），供各页面选择本地文件后写入可持久化 URL。
 * 接口见 components/steps/接口.md：/api/user/oss/upload（统一单/多文件入口）
 */
import { message } from 'ant-design-vue'
import { ossRemoteUploadImages, ossRemoteUploadSingle } from '~/utils/businessApi'

export const OSS_DIR = {
  images: 'images',
  video: 'video',
  audio: 'audio',
  files: 'files',
  avatar: 'avatar'
} as const

export async function uploadImageToOssWithToast(file: File): Promise<string | null> {
  const close = message.loading('正在上传图片…', 0)
  try {
    const r = await ossRemoteUploadSingle(file, OSS_DIR.images)
    return r.url
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '图片上传失败')
    return null
  } finally {
    close()
  }
}

export async function uploadImagesToOssWithToast(files: File[]): Promise<string[] | null> {
  if (!files.length) return []
  const close = message.loading(`正在上传 ${files.length} 张图片…`, 0)
  try {
    return await ossRemoteUploadImages(files, OSS_DIR.images)
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '图片上传失败')
    return null
  } finally {
    close()
  }
}

export async function uploadVideoToOssWithToast(file: File): Promise<string | null> {
  const close = message.loading('正在上传视频…', 0)
  try {
    const r = await ossRemoteUploadSingle(file, OSS_DIR.video)
    return r.url
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '视频上传失败')
    return null
  } finally {
    close()
  }
}

export async function uploadAudioToOssWithToast(file: File): Promise<string | null> {
  const close = message.loading('正在上传音频…', 0)
  try {
    const r = await ossRemoteUploadSingle(file, OSS_DIR.audio)
    return r.url
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '音频上传失败')
    return null
  } finally {
    close()
  }
}

export async function uploadFileToOssWithToast(file: File, customDir = OSS_DIR.files): Promise<string | null> {
  const close = message.loading('正在上传文件…', 0)
  try {
    const r = await ossRemoteUploadSingle(file, customDir)
    return r.url
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '文件上传失败')
    return null
  } finally {
    close()
  }
}
