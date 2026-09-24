/**
 * Biometric Photo Capture via navigator.mediaDevices.getUserMedia (RF-05)
 */
const CameraModule = {
  videoElement: null,
  canvasElement: null,
  placeholderElement: null,
  stream: null,
  isAvailable: false,

  async init() {
    this.videoElement = document.getElementById('webcam');
    this.canvasElement = document.getElementById('photo-canvas');
    this.placeholderElement = document.getElementById('camera-placeholder');

    if (!this.videoElement) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
        this.videoElement.srcObject = this.stream;
        this.isAvailable = true;
        if (this.placeholderElement) this.placeholderElement.style.display = 'none';
        this.videoElement.style.display = 'block';
        console.log('Camera initialized successfully.');
      } else {
        throw new Error('getUserMedia not supported in browser environment.');
      }
    } catch (err) {
      console.warn('Camera access error/denied/headless:', err);
      this.isAvailable = false;
      if (this.videoElement) this.videoElement.style.display = 'none';
      if (this.placeholderElement) this.placeholderElement.style.display = 'flex';
    }
  },

  capturePhoto() {
    if (!this.canvasElement) return null;

    const canvas = this.canvasElement;
    const ctx = canvas.getContext('2d');

    if (this.isAvailable && this.videoElement && this.videoElement.videoWidth > 0) {
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;
      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } else {
      // Fallback placeholder image when camera is unavailable (e.g. headless browser or no webcam)
      canvas.width = 320;
      canvas.height = 240;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Biometria Capturada (Fallback)', canvas.width / 2, canvas.height / 2);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
  },

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
};

document.addEventListener('DOMContentLoaded', () => CameraModule.init());
