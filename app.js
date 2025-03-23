import { config } from './config.js';
import { transcript } from './transcript.js';

let generatedImages = [];
let currentImageIndex = 0;
let progressInterval;
let generatingComplete = false;
let videoPlayer;
let videoStarted = false;

// Start the generation process
document.getElementById('start-button').addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  
  await generateImages();
  
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('video-container').style.display = 'block';
  
  // Setup the video player
  setupCustomVideoPlayer();
});

// Setup a custom video player instead of YouTube iframe
function setupCustomVideoPlayer() {
  const videoContainer = document.getElementById('video-player');
  
  // Create video element
  videoPlayer = document.createElement('video');
  videoPlayer.id = 'music-video';
  videoPlayer.width = '100%';
  videoPlayer.height = '100%';
  videoPlayer.controls = false;
  videoPlayer.style.width = '100%';
  videoPlayer.style.height = '100%';
  videoPlayer.style.objectFit = 'cover';
  
  // Create a source element
  const source = document.createElement('source');
  source.src = `https://www.youtube-nocookie.com/embed/${config.videoId}?autoplay=1&showinfo=0&rel=0&fs=1&modestbranding=1`;
  source.type = 'video/mp4';
  
  // Error handling for video
  videoPlayer.onerror = function() {
    // If video fails, show a message and placeholder
    videoContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #000;">
        <h2>Video playback unavailable</h2>
        <p style="margin-top: 1rem;">The music visualization will continue with images only.</p>
      </div>
    `;
    // Start the visualization anyway
    startVisualization();
  };
  
  // When video is ready to play
  videoPlayer.onloadeddata = function() {
    videoPlayer.muted = false;
    videoPlayer.play().then(() => {
      startVisualization();
    }).catch(err => {
      console.error("Video play failed:", err);
      // Start visualization anyway
      startVisualization();
    });
  };
  
  // Append to the container
  videoPlayer.appendChild(source);
  videoContainer.appendChild(videoPlayer);
  
  // Alternative approach if the video doesn't load properly
  // Create a fallback div that simulates the video timing
  const fallbackTimer = document.createElement('div');
  fallbackTimer.style.display = 'none';
  videoContainer.appendChild(fallbackTimer);
  
  // Try to play the video, if it fails use the fallback timer
  setTimeout(() => {
    if (!videoStarted) {
      console.log("Using fallback timer for visualization");
      fallbackTimer.style.display = 'block';
      videoPlayer.style.display = 'none';
      startVisualization();
    }
  }, 3000);
}

function startVisualization() {
  if (videoStarted) return;
  videoStarted = true;
  
  // Start scheduling image falling based on transcript timestamps
  let currentTime = 0;
  const intervalId = setInterval(() => {
    currentTime += 1;
    
    // Check if there are images that should appear at this time
    const imagesToShow = generatedImages.filter(img => img.time === currentTime);
    imagesToShow.forEach(image => {
      displayFallingImage(image.url, image.text);
    });
    
    // Stop when we've reached the end of the song
    if (currentTime >= transcript[transcript.length - 1].time + 10) {
      clearInterval(intervalId);
    }
  }, 1000);
}

// Generate AI images for each transcript entry
async function generateImages() {
  try {
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
  } catch (error) {
    console.error('Error in generateImages:', error);
    document.getElementById('status-text').innerText = 'Error generating images. Please try again.';
    clearInterval(progressInterval);
  }
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