
// This service manages the proctoring functionality

export interface ViolationEvent {
  type: 'tab_switch' | 'browser_minimize' | 'multiple_people' | 'mobile_detected' | 'looking_away' | 'other';
  timestamp: number;
  details?: string;
}

class ProctorService {
  private videoElement: HTMLVideoElement | null = null;
  private violationEvents: ViolationEvent[] = [];
  private onViolationCallback: ((event: ViolationEvent) => void) | null = null;
  private active = false;
  private visibilityChangeHandler: () => void;
  private focusHandler: () => void;
  private blurHandler: () => void;
  private checkIntervalId: number | null = null;
  private mediaStream: MediaStream | null = null;

  constructor() {
    // Create handlers that will be attached and removed
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
    this.focusHandler = this.handleFocus.bind(this);
    this.blurHandler = this.handleBlur.bind(this);
  }

  // Initialize the proctoring system
  async initialize(
    videoElement: HTMLVideoElement,
    onViolation: (event: ViolationEvent) => void
  ): Promise<boolean> {
    this.videoElement = videoElement;
    this.onViolationCallback = onViolation;
    this.violationEvents = [];
    
    try {
      console.log("Requesting camera access...");
      
      // First clean up any existing stream
      this.cleanupExistingStream();
      
      // Request camera access with lower resolution first to ensure compatibility
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },  // Lower initial resolution for better compatibility
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      // Store the media stream for later cleanup
      this.mediaStream = stream;
      
      console.log("Camera access granted, setting up video element");
      
      // Debug: Check if we have video tracks
      const videoTracks = stream.getVideoTracks();
      console.log(`Got ${videoTracks.length} video tracks`);
      if (videoTracks.length > 0) {
        console.log("Video track settings:", videoTracks[0].getSettings());
      }
      
      // Clear any previous source
      if (this.videoElement.srcObject) {
        this.videoElement.srcObject = null;
      }
      
      // Make sure video element is properly set up with EXPLICIT attributes
      this.videoElement.setAttribute('autoplay', 'true');
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.setAttribute('muted', 'true');
      this.videoElement.style.transform = 'scaleX(-1)'; // Mirror effect
      
      // Ensure video visibility with explicit styling
      this.videoElement.style.display = 'block';
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = 'auto';
      this.videoElement.style.backgroundColor = '#000'; // Makes it obvious if video element is showing
      this.videoElement.style.objectFit = 'cover'; // Ensure video fills the element
      
      // Set the video source to the webcam stream
      this.videoElement.srcObject = stream;
      
      // Force a layout recalculation
      void this.videoElement.offsetHeight;
      
      // Add debugging event listeners
      this.addVideoDebugListeners();
      
      // Ensure the video is displayed by properly handling the play promise
      try {
        await this.videoElement.play();
        console.log("Camera video playback started successfully");
      } catch (playError) {
        console.error("Error playing video:", playError);
        // Try with a timeout to let the browser stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        this.reinitializeVideo();
      }
      
      // Add event listeners for tab switching and minimizing
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      window.addEventListener('focus', this.focusHandler);
      window.addEventListener('blur', this.blurHandler);
      
      // Start periodic monitoring (every 2 seconds)
      this.startPeriodicMonitoring();
      
      this.active = true;
      console.log("ProctorService initialized successfully");
      return true;
    } catch (error) {
      console.error('Failed to initialize ProctorService:', error);
      // Try with lowest possible constraints as a fallback
      return this.initializeWithFallback();
    }
  }

  // Add debug event listeners to video element
  private addVideoDebugListeners(): void {
    if (!this.videoElement) return;
    
    this.videoElement.addEventListener('loadedmetadata', () => {
      console.log(`Video dimensions: ${this.videoElement?.videoWidth}x${this.videoElement?.videoHeight}`);
    });
    
    this.videoElement.addEventListener('playing', () => {
      console.log("Video is now playing");
    });
    
    this.videoElement.addEventListener('canplay', () => {
      console.log("Video can play");
    });
    
    this.videoElement.addEventListener('error', (e) => {
      console.error("Video error:", e);
    });
  }

  // Fallback initialization with minimal constraints
  private async initializeWithFallback(): Promise<boolean> {
    if (!this.videoElement) return false;
    
    try {
      console.log("Attempting fallback camera initialization...");
      
      // Clean up first
      this.cleanupExistingStream();
      
      // Try with minimal constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,  // Just request any video
        audio: false
      });
      
      this.mediaStream = stream;
      
      // Set up video element with explicit attributes
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      this.videoElement.style.transform = 'scaleX(-1)';
      
      // Ensure visibility
      this.videoElement.style.display = 'block';
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = 'auto';
      this.videoElement.style.backgroundColor = '#000';
      this.videoElement.style.objectFit = 'cover';
      
      this.videoElement.srcObject = stream;
      
      await this.videoElement.play();
      
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      window.addEventListener('focus', this.focusHandler);
      window.addEventListener('blur', this.blurHandler);
      
      this.startPeriodicMonitoring();
      
      this.active = true;
      console.log("ProctorService fallback initialization successful");
      return true;
    } catch (error) {
      console.error("Fallback initialization failed:", error);
      return false;
    }
  }

  // Clean up existing stream
  private cleanupExistingStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log("Stopped existing track");
      });
      this.mediaStream = null;
    }
    
    if (this.videoElement?.srcObject) {
      this.videoElement.srcObject = null;
      console.log("Cleared existing srcObject");
    }
  }

  // Helper method to reinitialize video when there are issues
  private reinitializeVideo(): void {
    if (!this.videoElement || !this.mediaStream) return;
    
    console.log("Reinitializing video element");
    
    // Try forcing video tracks to be enabled
    const videoTracks = this.mediaStream.getVideoTracks();
    if (videoTracks.length > 0) {
      videoTracks.forEach(track => {
        if (!track.enabled) {
          track.enabled = true;
          console.log("Re-enabled video track");
        }
      });
    } else {
      console.warn("No video tracks found in stream!");
    }
    
    // Reset the stream with a small delay
    setTimeout(() => {
      if (this.videoElement && this.mediaStream) {
        // Reset the stream
        this.videoElement.srcObject = null;
        this.videoElement.srcObject = this.mediaStream;
        
        // Force a layout recalculation
        void this.videoElement.offsetHeight;
        
        // Try playing again
        this.videoElement.play().catch(e => {
          console.error("Retry play failed:", e);
          // As a last resort, completely restart the stream
          setTimeout(() => this.restartStream(), 1000);
        });
      }
    }, 500);
  }

  // Completely restart the media stream if all else fails
  private async restartStream(): Promise<void> {
    if (!this.videoElement) return;
    
    console.log("Completely restarting media stream");
    
    // Clean up old stream
    this.cleanupExistingStream();
    
    try {
      // Request a new stream with minimal constraints
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      this.mediaStream = newStream;
      this.videoElement.srcObject = newStream;
      
      // Log track information
      const videoTracks = newStream.getVideoTracks();
      console.log(`Got ${videoTracks.length} video tracks in restarted stream`);
      if (videoTracks.length > 0) {
        console.log("Video track settings:", videoTracks[0].getSettings());
      }
      
      await this.videoElement.play();
      console.log("Stream completely restarted");
    } catch (error) {
      console.error("Failed to restart stream:", error);
    }
  }

  // Start periodic monitoring of webcam feed
  private startPeriodicMonitoring(): void {
    if (this.checkIntervalId) {
      window.clearInterval(this.checkIntervalId);
    }
    
    // Set up periodic checks
    this.checkIntervalId = window.setInterval(() => {
      this.checkForViolations();
      this.checkVideoStatus(); // Add video health check
    }, 2000);
  }
  
  // Check if video is displaying properly
  private checkVideoStatus(): void {
    if (!this.active || !this.videoElement || !this.mediaStream) return;
    
    const videoTracks = this.mediaStream.getVideoTracks();
    
    // Debug track status
    if (videoTracks.length > 0) {
      console.log("Video track status:", {
        enabled: videoTracks[0].enabled,
        muted: videoTracks[0].muted,
        readyState: videoTracks[0].readyState
      });
    }
    
    // Check if video tracks exist and are active
    if (videoTracks.length === 0 || !videoTracks[0].enabled) {
      console.warn("Video track not active, attempting to fix");
      
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = true;
      } else {
        // No tracks found, need to restart stream
        this.restartStream();
        return;
      }
    }
    
    // Check if video is actually displaying frames
    if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
      console.warn("Video dimensions are zero, attempting to fix");
      this.reinitializeVideo();
      return;
    }
    
    // Verify video is playing
    if (this.videoElement.paused || this.videoElement.ended) {
      console.warn("Video is paused or ended, attempting to restart");
      this.videoElement.play().catch(e => {
        console.warn("Could not restart video:", e);
        this.reinitializeVideo();
      });
    }
  }
  
  // Check webcam feed for violations
  private checkForViolations(): void {
    if (!this.active || !this.videoElement) return;
    
    // Simulate detection of common violations randomly
    // In a real implementation, this would use computer vision to detect:
    // 1. Multiple people in frame
    // 2. Mobile phone usage
    // 3. Looking away from screen
    
    const simulateDetection = Math.random() < 0.03; // 3% chance of detecting violation
    
    if (simulateDetection) {
      // For demo purposes, randomly choose a violation type
      const violations = ['multiple_people', 'mobile_detected', 'looking_away'];
      const randomViolation = violations[Math.floor(Math.random() * violations.length)] as ViolationEvent['type'];
      
      this.recordViolation({
        type: randomViolation,
        timestamp: Date.now(),
        details: `Simulated detection of ${randomViolation}`
      });
    }
  }

  // Stop proctoring
  stop(): void {
    if (!this.active) return;
    
    // Stop periodic monitoring
    if (this.checkIntervalId) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    window.removeEventListener('focus', this.focusHandler);
    window.removeEventListener('blur', this.blurHandler);
    
    // Stop using the webcam
    this.cleanupExistingStream();
    
    this.active = false;
    this.videoElement = null;
    console.log("ProctorService stopped");
  }

  // Get all recorded violations
  getViolations(): ViolationEvent[] {
    return [...this.violationEvents];
  }

  // Handle visibility change (tab switching, minimizing)
  private handleVisibilityChange(): void {
    if (document.hidden && this.active) {
      this.recordViolation({
        type: 'tab_switch',
        timestamp: Date.now(),
        details: 'User switched tabs or minimized the browser'
      });
    }
  }

  // Handle window blur (switching to another application)
  private handleBlur(): void {
    if (this.active) {
      this.recordViolation({
        type: 'browser_minimize',
        timestamp: Date.now(),
        details: 'User switched to another application'
      });
    }
  }

  // Handle window focus (returning to the exam)
  private handleFocus(): void {
    // We don't record this as a violation, but could use it for logging
    console.log('User returned to the exam at:', new Date());
  }

  // Record a violation and trigger the callback
  private recordViolation(event: ViolationEvent): void {
    console.log("Violation recorded:", event);
    this.violationEvents.push(event);
    
    if (this.onViolationCallback) {
      this.onViolationCallback(event);
    }
  }

  // Simulate a violation (for testing)
  simulateViolation(type: ViolationEvent['type'], details?: string): void {
    this.recordViolation({
      type,
      timestamp: Date.now(),
      details
    });
  }

  // Check if the proctoring system is active
  isActive(): boolean {
    return this.active;
  }
}

// Create a singleton instance
const proctorService = new ProctorService();
export default proctorService;
