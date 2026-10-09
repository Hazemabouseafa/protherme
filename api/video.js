/**
 * Video streaming handler for ProTherme on Vercel & Node.js
 * Supports Range requests (HTTP 206) for smooth seeking and iOS Safari compatibility
 */
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const reqFile = (req.query && req.query.file) ? path.basename(req.query.file) : 'beforeafter.mp4';
  let videoPath = path.join(process.cwd(), 'assets', 'videos', reqFile);
  if (!fs.existsSync(videoPath)) {
    videoPath = path.join(process.cwd(), 'assets', 'videos', 'beforeafter.mp4');
  }
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;
    
    const stream = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=86400'
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400'
    });
    fs.createReadStream(videoPath).pipe(res);
  }
};
