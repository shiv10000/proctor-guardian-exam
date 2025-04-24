
// This service manages the proctoring functionality

export interface ViolationEvent {
  type: 'tab_switch' | 'browser_minimize' | 'multiple_people' | 'mobile_detected' | 'looking_away' | 'other';
  timestamp: number;
  details?: string;
}

class ProctorService {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private violationEvents: ViolationEvent[] = [];
  private onViolationCallback: ((event: ViolationEvent) => void) | null = null;
  private active = false;
  private visibilityChangeHandler: () => void;
  private focusHandler: () => void;
  private blurHandler: () => void;
  private checkIntervalId: number | null = null;
  private mediaStream: MediaStream | null = null;
  private consecutiveNoFace: number = 0;
  private readonly FACE_DETECTION_VIOLATIONS_LIMIT = 3;

  constructor() {
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
    this.focusHandler = this.handleFocus.bind(this);
    this.blurHandler = this.handleBlur.bind(this);
  }

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
      
      // Request camera access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      this.mediaStream = stream;
      console.log("Camera access granted, setting up video element");
      
      if (!this.videoElement) {
        console.error("Video element not found");
        return false;
      }

      // Set up video element properties
      this.videoElement.srcObject = stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.autoplay = true;
      this.videoElement.style.transform = 'scaleX(-1)';
      
      // Setup video element visibility
      this.videoElement.style.display = 'block';
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = 'auto';
      this.videoElement.style.backgroundColor = '#000';
      this.videoElement.style.objectFit = 'cover';

      // Add debug event listeners
      this.addVideoDebugListeners();

      // Start video playback
      try {
        await this.videoElement.play();
        console.log("Camera video playback started successfully");
      } catch (playError) {
        console.error("Error starting video playback:", playError);
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.reinitializeVideo();
      }

      // Add visibility event listeners
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      window.addEventListener('focus', this.focusHandler);
      window.addEventListener('blur', this.blurHandler);
      
      // Start monitoring
      this.startPeriodicMonitoring();
      
      this.active = true;
      console.log("ProctorService initialized successfully");
      return true;
    } catch (error) {
      console.error('Failed to initialize ProctorService:', error);
      return false;
    }
  }

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

  private async reinitializeVideo(): Promise<void> {
    if (!this.videoElement || !this.mediaStream) return;
    
    console.log("Reinitializing video element");
    
    const videoTracks = this.mediaStream.getVideoTracks();
    if (videoTracks.length > 0) {
      videoTracks.forEach(track => {
        if (!track.enabled) {
          track.enabled = true;
          console.log("Re-enabled video track");
        }
      });
    }
    
    // Reset stream
    this.videoElement.srcObject = null;
    this.videoElement.srcObject = this.mediaStream;
    
    try {
      await this.videoElement.play();
      console.log("Video play successful after reinitialization");
    } catch (e) {
      console.error("Retry play failed:", e);
      await this.restartStream();
    }
  }

  private async restartStream(): Promise<void> {
    if (!this.videoElement) return;
    
    console.log("Completely restarting media stream");
    this.cleanupExistingStream();
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      this.mediaStream = newStream;
      this.videoElement.srcObject = newStream;
      await this.videoElement.play();
      console.log("Stream completely restarted");
    } catch (error) {
      console.error("Failed to restart stream:", error);
    }
  }

  private startPeriodicMonitoring(): void {
    if (this.checkIntervalId) {
      window.clearInterval(this.checkIntervalId);
    }
    
    this.checkIntervalId = window.setInterval(() => {
      this.checkForViolations();
      this.checkVideoStatus();
    }, 2000);
  }
  
  private checkVideoStatus(): void {
    if (!this.active || !this.videoElement || !this.mediaStream) return;
    
    const videoTracks = this.mediaStream.getVideoTracks();
    console.log("Video track status:", {
      enabled: videoTracks[0]?.enabled,
      readyState: videoTracks[0]?.readyState
    });
    
    if (this.videoElement.paused || this.videoElement.ended) {
      console.warn("Video is paused or ended, attempting to restart");
      this.videoElement.play().catch(e => {
        console.warn("Could not restart video:", e);
        this.reinitializeVideo();
      });
    }
    
    // Check if camera actually has content
    if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
      console.warn("Video dimensions are zero, attempting to fix");
      this.reinitializeVideo();
    }
  }

  private checkForViolations(): void {
    if (!this.active || !this.videoElement) return;
    
    // Simulate random violations (3% chance)
    if (Math.random() < 0.03) {
      const violations = ['multiple_people', 'mobile_detected', 'looking_away'] as ViolationEvent['type'][];
      const randomViolation = violations[Math.floor(Math.random() * violations.length)];
      
      this.recordViolation({
        type: randomViolation,
        timestamp: Date.now(),
        details: `Simulated detection of ${randomViolation}`
      });
    }
  }

  stop(): void {
    if (!this.active) return;
    
    if (this.checkIntervalId) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    
    this.cleanupExistingStream();
    
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    window.removeEventListener('focus', this.focusHandler);
    window.removeEventListener('blur', this.blurHandler);
    
    this.active = false;
    this.videoElement = null;
    console.log("ProctorService stopped");
  }

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

const proctorService = new ProctorService();
export default proctorService;
