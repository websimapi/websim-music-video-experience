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
  
  try {
    await generateImages();
    
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('video-container').style.display = 'block';
    
    // Setup the video player
    setupCustomVideoPlayer();
  } catch (error) {
    console.error("Error during initialization:", error);
    document.getElementById('status-text').innerText = 'An error occurred. Please refresh and try again.';
  }
});

// Setup a custom video player instead of YouTube iframe
function setupCustomVideoPlayer() {
  const videoContainer = document.getElementById('video-player');
  
  // Create play button overlay
  const playButtonOverlay = document.createElement('div');
  playButtonOverlay.id = 'play-button-overlay';
  playButtonOverlay.innerHTML = `
    <button id="play-video-button">
      <svg width="50" height="50" viewBox="0 0 24 24">
        <path fill="#fff" d="M8 5v14l11-7z"/>
      </svg>
      <span>Play Video</span>
    </button>
  `;
  playButtonOverlay.style.position = 'absolute';
  playButtonOverlay.style.top = '0';
  playButtonOverlay.style.left = '0';
  playButtonOverlay.style.width = '100%';
  playButtonOverlay.style.height = '100%';
  playButtonOverlay.style.display = 'flex';
  playButtonOverlay.style.justifyContent = 'center';
  playButtonOverlay.style.alignItems = 'center';
  playButtonOverlay.style.background = 'rgba(0,0,0,0.7)';
  playButtonOverlay.style.zIndex = '10';
  
  // Create video element
  videoPlayer = document.createElement('video');
  videoPlayer.id = 'music-video';
  videoPlayer.width = '100%';
  videoPlayer.height = '100%';
  videoPlayer.controls = false;
  videoPlayer.muted = false;
  videoPlayer.autoplay = false;
  videoPlayer.playsInline = true;
  videoPlayer.style.width = '100%';
  videoPlayer.style.height = '100%';
  videoPlayer.style.objectFit = 'cover';
  
  // Add placeholder background before video plays
  videoPlayer.style.backgroundColor = '#000';
  videoPlayer.poster = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" fill="%23000"><rect width="1280" height="720"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="%23fff" text-anchor="middle">Click to play "Looking Up" by Stick Figure</text></svg>';
  
  // Create a source element using direct YouTube video URL
  const source = document.createElement('source');
  source.src = `https://www.youtube.com/watch?v=${config.videoId}`;
  source.type = 'video/mp4';
  
  // Error handling for video
  videoPlayer.onerror = function() {
    console.error("Video playback error");
    // If video fails, show a message and placeholder
    videoContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #000;">
        <h2>Video playback unavailable</h2>
        <p style="margin-top: 1rem;">The music visualization will continue with images only.</p>
        <button id="continue-without-video" style="margin-top: 1rem; padding: 10px 20px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Continue with Images Only
        </button>
      </div>
    `;
    
    document.getElementById('continue-without-video').addEventListener('click', function() {
      startVisualization();
    });
  };
  
  // Append to the container
  videoPlayer.appendChild(source);
  videoContainer.appendChild(videoPlayer);
  videoContainer.appendChild(playButtonOverlay);
  
  // Play button event listener
  document.getElementById('play-video-button').addEventListener('click', function() {
    // Ensure audio context is started
    if (window.audioContext && window.audioContext.state === 'suspended') {
      window.audioContext.resume();
    }
    
    // Try to play the video
    videoPlayer.play().then(() => {
      playButtonOverlay.style.display = 'none';
      startVisualization();
    }).catch(err => {
      console.error("Video play failed:", err);
      // Show error and option to continue with just images
      playButtonOverlay.innerHTML = `
        <div style="text-align: center; color: white;">
          <p>Unable to play video. You can continue with images only.</p>
          <button id="continue-with-images" style="margin-top: 15px; padding: 10px 20px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Continue with Images
          </button>
        </div>
      `;
      
      document.getElementById('continue-with-images').addEventListener('click', function() {
        playButtonOverlay.style.display = 'none';
        startVisualization();
      });
    });
  });
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
        
        // Update the progress bar immediately
        const progress = Math.min((completedLines / totalLines) * 100, 95);
        document.getElementById('progress-bar').style.width = `${progress}%`;
        document.getElementById('status-text').innerText = 
          `Generating visualizations... ${completedLines}/${totalLines}`;
          
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
    return true;
  } catch (error) {
    console.error('Error in generateImages:', error);
    document.getElementById('status-text').innerText = 'Error generating images. Please try again.';
    clearInterval(progressInterval);
    throw error;
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
    // Create a fallback image with placeholder text for visualization
    return {
      url: createPlaceholderImage(prompt)
    };
  }
}

// Create a placeholder SVG image when generation fails
function createPlaceholderImage(text) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <rect width="800" height="450" fill="#333"/>
      <text x="400" y="225" font-family="Arial" font-size="24" fill="#fff" text-anchor="middle">${text}</text>
    </svg>
  `;
  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}

// Display a falling image on the overlay
function displayFallingImage(imageUrl, text) {
  if (!imageUrl) {
    // If no image URL, create a placeholder
    imageUrl = createPlaceholderImage(text);
  }
  
  const imageOverlay = document.getElementById('image-overlay');
  const img = document.createElement('img');
  
  // Handle different types of URLs
  if (imageUrl.startsWith('data:')) {
    img.src = imageUrl;
    applyImageStyles(img, text, imageOverlay);
  } else {
    // Try to load the image, with multiple CORS proxies as fallbacks
    loadImageWithFallbacks(img, imageUrl, text, imageOverlay);
  }
}

// Try multiple CORS proxies until one works
async function loadImageWithFallbacks(img, originalUrl, text, imageOverlay) {
  const corsProxies = [
    url => url, // Try direct URL first
    url => `https://cors-anywhere.herokuapp.com/${url}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${url}`,
    url => `https://crossorigin.me/${url}`
  ];
  
  // Set a placeholder while we try to load the image
  img.src = createPlaceholderImage('Loading...');
  applyImageStyles(img, text, imageOverlay);
  
  let loaded = false;
  
  for (const proxyFn of corsProxies) {
    if (loaded) break;
    
    try {
      const proxiedUrl = proxyFn(originalUrl);
      
      // Try to fetch the image through the proxy
      const response = await fetch(proxiedUrl, { 
        mode: 'cors',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }).catch(() => null);
      
      if (response && response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        img.onload = () => {
          loaded = true;
          URL.revokeObjectURL(img.src); // Clean up the object URL
        };
        
        img.src = objectUrl;
        return;
      }
    } catch (error) {
      console.warn(`Proxy failed: ${error.message}`);
      // Continue to next proxy
    }
  }
  
  // If all proxies fail, use a placeholder
  if (!loaded) {
    img.src = createPlaceholderImage(text);
    console.warn('All image loading attempts failed, using placeholder');
  }
}

// Apply common styles and add to DOM
function applyImageStyles(img, text, imageOverlay) {
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