
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
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      // Set the video source to the webcam stream
      this.videoElement.srcObject = stream;
      this.videoElement.play();
      
      // Add event listeners for tab switching and minimizing
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      window.addEventListener('focus', this.focusHandler);
      window.addEventListener('blur', this.blurHandler);
      
      this.active = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize ProctorService:', error);
      return false;
    }
  }

  // Stop proctoring
  stop(): void {
    if (!this.active) return;
    
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
