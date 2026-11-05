import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Usage: node scripts/prepare360Video.mjs <carId> <sourceVideoPath>
// Example: node scripts/prepare360Video.mjs carens public/assets/aistudio/Kia_Carens_xxx.mp4

const args = process.argv.slice(2);
const carId = args[0] || 'kicks';
const videoPath = args[1] || 'public/assets/aistudio/Nissan_Kicks_f04e26bd.mp4';

const targetDir = path.resolve(`public/assets/360_frames/${carId}`);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log(`Extracting 72 360-degree turntable frames for '${carId}' from '${videoPath}'...`);

// Extract 72 frames across the full 360 rotation (7.2 fps for a 10s video = 72 frames, 5° per frame)
const cmd = `ffmpeg -y -i "${videoPath}" -vf "fps=7.2,scale=800:450" -q:v 3 "${targetDir}/frame_%03d.jpg"`;
execSync(cmd, { stdio: 'inherit' });

console.log(`Successfully extracted 72 frames into ${targetDir}`);
