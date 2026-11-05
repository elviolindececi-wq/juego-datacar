import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const VIDEOS_DIR = path.resolve('public/assets/videos');
const TEMP_DIR = path.resolve('temp_frames');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

const CARS = [
  {
    id: 'nissan-kicks-2027',
    name: 'kicks_360.mp4',
    frames: [
      'src/assets/images/kicks_front_direct_1793825636931.jpg',
      'src/assets/images/nissan_kicks_sense_1793824276957.jpg',
      'src/assets/images/kicks_side_profile_1793824926230.jpg',
      'src/assets/images/kicks_rear_angle_1793824926558.jpg',
      'src/assets/images/kicks_rear_direct_1793825659532.jpg',
    ],
  },
  {
    id: 'kia-carens-ex',
    name: 'carens_360.mp4',
    frames: [
      'src/assets/images/carens_front_direct_1793825675700.jpg',
      'src/assets/images/kia_carens_ex_1793824276943.jpg',
      'src/assets/images/carens_side_profile_1793825089572.jpg',
      'src/assets/images/carens_rear_angle_1793825104271.jpg',
      'src/assets/images/carens_rear_direct_1793825692834.jpg',
    ],
  },
  {
    id: 'chevrolet-tracker-lite',
    name: 'tracker_360.mp4',
    frames: [
      'src/assets/images/tracker_front_direct_1793825707992.jpg',
      'src/assets/images/chevrolet_tracker_lite_1793824277485.jpg',
      'src/assets/images/tracker_side_profile_1793825135689.jpg',
      'src/assets/images/tracker_rear_angle_1793825150483.jpg',
      'src/assets/images/tracker_rear_direct_1793825722711.jpg',
    ],
  },
];

for (const car of CARS) {
  const carTempDir = path.join(TEMP_DIR, car.id);
  if (fs.existsSync(carTempDir)) {
    fs.rmSync(carTempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(carTempDir, { recursive: true });

  console.log(`Processing ${car.id}...`);

  // We construct the 8-angle loop sequence
  // 0: front (0°)
  // 1: 3/4 front (45°)
  // 2: side (90°)
  // 3: 3/4 rear (135°)
  // 4: rear (180°)
  // 5: 3/4 rear flipped (225°)
  // 6: side flipped (270°)
  // 7: 3/4 front flipped (315°)
  const sequence = [
    { src: car.frames[0], flip: false },
    { src: car.frames[1], flip: false },
    { src: car.frames[2], flip: false },
    { src: car.frames[3], flip: false },
    { src: car.frames[4], flip: false },
    { src: car.frames[3], flip: true },
    { src: car.frames[2], flip: true },
    { src: car.frames[1], flip: true },
  ];

  // For each angle, scale to 800x600 with white studio background
  sequence.forEach((item, idx) => {
    const outImg = path.join(carTempDir, `angle_${idx}.jpg`);
    const flipFilter = item.flip ? ',hflip' : '';
    // ffmpeg command to scale and pad cleanly
    const cmd = `ffmpeg -y -i "${item.src}" -vf "scale=800:600:force_original_aspect_ratio=decrease,pad=800:600:(ow-iw)/2:(oh-ih)/2:color=white${flipFilter}" "${outImg}"`;
    execSync(cmd, { stdio: 'pipe' });
  });

  // Now create a 24-frame or smooth looped video
  // Duplicate each frame for 3 frames at 12 fps -> 8 * 3 = 24 frames = 2 seconds smooth continuous loop
  let frameIndex = 0;
  for (let i = 0; i < sequence.length; i++) {
    const srcAngle = path.join(carTempDir, `angle_${i}.jpg`);
    for (let repeat = 0; repeat < 3; repeat++) {
      const targetFrame = path.join(carTempDir, `frame_${String(frameIndex).padStart(4, '0')}.jpg`);
      fs.copyFileSync(srcAngle, targetFrame);
      frameIndex++;
    }
  }

  const outVideo = path.join(VIDEOS_DIR, car.name);
  // Encode into high quality MP4 H264 with pixel format yuv420p (universally supported in browsers)
  // Use 12 fps for crisp, responsive turntable playback and seeking
  const encodeCmd = `ffmpeg -y -framerate 12 -i "${carTempDir}/frame_%04d.jpg" -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 -movflags +faststart "${outVideo}"`;
  execSync(encodeCmd, { stdio: 'inherit' });

  console.log(`Successfully generated ${outVideo}`);
}

// Cleanup temp
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
console.log('All 360 videos created successfully!');
