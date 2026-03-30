// backend/src/utils/image-downloader.ts

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { gpfFetch } from './gpf-fetch.js';

export interface DownloadResult {
 localPaths: string[];
}

export async function downloadImagesToTemp(
 urls: string[],
 token: string
): Promise<DownloadResult> {
 const tmpDir = './tmp/uploads/images';

 if (!fs.existsSync(tmpDir)) {
 fs.mkdirSync(tmpDir, { recursive: true });
 }

 const localPaths: string[] = [];
 const appToken = process.env.GPF_APP_TOKEN || '';

 for (const url of urls) {
 try {
 const response = await gpfFetch(url, {
 headers: {
 'Authorization': `Bearer ${token}`,
 'X-App-Token': appToken,
 'ngrok-skip-browser-warning': 'true'
 }
 });

 if (!response.ok) {
 logger.warn(` Failed to download image: ${url} → ${response.status}`);
 continue;
 }

 const contentType = response.headers.get('content-type') || '';
 const ext = contentType.includes('png') ? '.png' : '.jpg';
 const filename = `${uuidv4()}${ext}`;
 const localPath = path.join(tmpDir, filename);

 const buffer = await response.arrayBuffer();
 fs.writeFileSync(localPath, Buffer.from(buffer));

 localPaths.push(localPath);
 logger.info(` Image downloaded: ${filename}`);
 } catch (error) {
 logger.warn(` Error downloading image ${url}:`, error);
 }
 }

 logger.info(` Downloaded ${localPaths.length}/${urls.length} images`);
 return { localPaths };
}
