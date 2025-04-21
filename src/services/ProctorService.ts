
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
      // Request camera access with higher resolution
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });
      
      // Set the video source to the webcam stream
      this.videoElement.srcObject = stream;
      
      // Ensure the video is visible by playing it explicitly
      this.videoElement.style.display = 'block';
      await this.videoElement.play().catch(e => {
        console.error('Video play failed:', e);
        // Try again with autoplay after user interaction
        const playPromise = this.videoElement?.play();
        if (playPromise) {
          playPromise.catch(() => {
            console.log('Waiting for user interaction to enable video');
          });
        }
      });
      
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
      return false;
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
    }, 2000);
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
    
    // Stop using the webcam
    if (this.videoElement?.srcObject) {
      const tracks = (this.videoElement.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    window.removeEventListener('focus', this.focusHandler);
    window.removeEventListener('blur', this.blurHandler);
    
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
