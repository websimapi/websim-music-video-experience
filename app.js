import { config } from './config.js';
import { transcript } from './transcript.js';

let player;
let generatedImages = [];
let currentImageIndex = 0;
let progressInterval;
let generatingComplete = false;

// Make the YouTube callback function globally accessible
window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: config.videoId,
    playerVars: {
      'autoplay': 0,
      'controls': 0,
      'showinfo': 0,
      'rel': 0,
      'fs': 1,
      'modestbranding': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
};

function onPlayerReady(event) {
  // Player is ready but we don't autoplay yet
  console.log('Player ready');
}

function onPlayerStateChange(event) {
  // When video starts playing
  if (event.data === YT.PlayerState.PLAYING) {
    scheduleImageFalling();
  }
}

// Start the generation process
document.getElementById('start-button').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  
  await generateImages();
  
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('video-container').style.display = 'block';
  
  // Start the video after generation is complete
  player.playVideo();
});

// Generate AI images for each transcript entry
async function generateImages() {
  const totalLines = transcript.length;
  let completedLines = 0;
  
  // Setup progress tracking
  progressInterval = setInterval(() => {
    const fakeProgress = Math.min((completedLines / totalLines) * 100, 95);
    document.getElementById('progress-bar').style.width = `${fakeProgress}%`;
    document.getElementById('status-text').innerText = 
      `Generating visualizations... ${completedLines}/${totalLines}`;
  }, 500);
  
  // Generate images sequentially with rate limiting
  for (const line of transcript) {
    try {
      const result = await generateImage(line.text);
      generatedImages.push({
        url: result.url,
        time: line.time,
        text: line.text
      });
      
      completedLines++;
      
      // Rate limit: one image every 3 seconds
      await new Promise(resolve => setTimeout(resolve, config.imageGenRate));
    } catch (error) {
      console.error('Failed to generate image:', error);
      // Add a placeholder in case of failure
      generatedImages.push({
        url: null,
        time: line.time,
        text: line.text
      });
      completedLines++;
    }
  }
  
  // Complete the progress bar
  document.getElementById('progress-bar').style.width = '100%';
  document.getElementById('status-text').innerText = 'Ready to play!';
  
  clearInterval(progressInterval);
  generatingComplete = true;
}

// Generate a single image using AI
async function generateImage(prompt) {
  try {
    // Create a more descriptive prompt for better image generation
    const enhancedPrompt = `Artistic visualization of: "${prompt}" from reggae song Looking Up by Stick Figure, dreamy artistic style, vibrant, ocean and sky themes`;
    
    // Call the AI image generation
    const result = await websim.imageGen({
      prompt: enhancedPrompt,
      aspect_ratio: "16:9"
    });
    
    return result;
  } catch (error) {
    console.error('Image generation failed:', error);
    throw error;
  }
}

// Schedule images to fall based on their timestamp in the video
function scheduleImageFalling() {
  generatedImages.forEach((image, index) => {
    setTimeout(() => {
      displayFallingImage(image.url, image.text);
    }, (image.time - player.getCurrentTime()) * 1000);
  });
}

// Display a falling image on the overlay
function displayFallingImage(imageUrl, text) {
  if (!imageUrl) return; // Skip if image generation failed
  
  const imageOverlay = document.getElementById('image-overlay');
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = text;
  img.className = 'falling-image';
  
  // Randomize the starting position
  const startX = Math.random() * 70 + 15; // 15% to 85% of screen width
  const startRotation = Math.random() * 20 - 10; // -10 to 10 degrees
  
  img.style.left = `${startX}%`;
  img.style.transform = `translateY(-50px) rotate(${startRotation}deg)`;
  
  imageOverlay.appendChild(img);
  
  // Remove the image after animation completes
  setTimeout(() => {
    img.remove();
  }, config.imageDisplayDuration);
}