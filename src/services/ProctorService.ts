import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

// This service manages the proctoring functionality

export interface ViolationEvent {
  type: 'tab_switch' | 'browser_minimize' | 'multiple_people' | 'mobile_detected' | 'looking_away' | 'other';
  timestamp: number;
  details?: string;
}

class ProctorService {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private model: blazeface.BlazeFaceModel | null = null;
  private violationEvents: ViolationEvent[] = [];
  private onViolationCallback: ((event: ViolationEvent) => void) | null = null;
  private active = false;
  private visibilityChangeHandler: () => void;
  private focusHandler: () => void;
  private blurHandler: () => void;
  private checkIntervalId: number | null = null;
  private mediaStream: MediaStream | null = null;
  private detectionIntervalId: number | null = null;

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
      console.log("Loading TensorFlow model...");
      await tf.ready();
      this.model = await blazeface.load();
      console.log("TensorFlow model loaded successfully");

      console.log("Requesting camera access...");
      this.cleanupExistingStream();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      this.mediaStream = stream;
      
      if (!this.videoElement) {
        console.error("Video element not found");
        return false;
      }

      // Set up video element with improved properties
      this.videoElement.srcObject = stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.autoplay = true;
      
      // Improve video visibility
      this.videoElement.style.display = 'block';
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = 'auto';
      this.videoElement.style.transform = 'scaleX(-1)';
      this.videoElement.style.objectFit = 'cover';
      this.videoElement.style.backgroundColor = 'transparent';

      this.addVideoDebugListeners();

      try {
        await this.videoElement.play();
        console.log("Camera video playback started successfully");
        this.startDetection();
      } catch (playError) {
        console.error("Error starting video playback:", playError);
        await this.reinitializeVideo();
      }

      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      window.addEventListener('focus', this.focusHandler);
      window.addEventListener('blur', this.blurHandler);
      
      this.startPeriodicMonitoring();
      
      this.active = true;
      console.log("ProctorService initialized successfully");
      return true;
    } catch (error) {
      console.error('Failed to initialize ProctorService:', error);
      return false;
    }
  }

  private async startDetection() {
    if (!this.model || !this.videoElement || this.detectionIntervalId) return;

    this.detectionIntervalId = window.setInterval(async () => {
      if (!this.videoElement || !this.model) return;

      try {
        const predictions = await this.model.estimateFaces(this.videoElement, false);
        
        if (predictions.length === 0) {
          this.recordViolation({
            type: 'looking_away',
            timestamp: Date.now(),
            details: 'No face detected in frame'
          });
        } else if (predictions.length > 1) {
          this.recordViolation({
            type: 'multiple_people',
            timestamp: Date.now(),
            details: `Detected ${predictions.length} faces in frame`
          });
        } else {
          // Single face detected, check for head movement
          const face = predictions[0];
          const rotation = this.estimateHeadRotation(face);
          if (rotation > 30) { // 30 degrees threshold
            this.recordViolation({
              type: 'looking_away',
              timestamp: Date.now(),
              details: 'Significant head rotation detected'
            });
          }
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
    }, 1000); // Check every second
  }

  private estimateHeadRotation(face: blazeface.NormalizedFace): number {
    // Simple head rotation estimation based on landmark positions
    const leftEye = face.landmarks[0];
    const rightEye = face.landmarks[1];
    if (leftEye && rightEye) {
      const dx = rightEye[0] - leftEye[0];
      const dy = rightEye[1] - leftEye[1];
      return Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
    }
    return 0;
  }

  private cleanupExistingStream(): void {
    if (this.detectionIntervalId) {
      window.clearInterval(this.detectionIntervalId);
      this.detectionIntervalId = null;
    }
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

    if (this.detectionIntervalId) {
      window.clearInterval(this.detectionIntervalId);
      this.detectionIntervalId = null;
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
}

const proctorService = new ProctorService();
export default proctorService;
