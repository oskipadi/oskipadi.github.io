// Módulo para comprobar webcam e iniciar detección de ojos cerrados
export async function comprobarWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // detener tracks inmediatamente
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (err) {
    return false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy);
}

function eyeAspectRatio(landmarks, indices) {
  // indices array: [p1, p2, p3, p4, p5, p6]
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];
  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);
  const horizontal = dist(p1, p4);
  if (horizontal === 0) return 1.0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

// Exported: inicia la detección y resuelve cuando se detecta cierre de ojos 0.5s
export async function iniciarDeteccionSalto(targetVideoId) {
  return new Promise(async (resolve, reject) => {
    let camera = null;
    let stream = null;
    try {
      // crear video oculto para la webcam
      const video = document.createElement('video');
      video.style.display = 'none';
      video.playsInline = true;
      video.muted = true;
      document.body.appendChild(video);

      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      await video.play();

      // Cargar MediaPipe FaceMesh y CameraUtils
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

      const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
      faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

      let closedStart = null;
      const CLOSED_MS = 500; // 0.5s
      const EAR_THRESHOLD = 0.20; // umbral aproximado

      faceMesh.onResults((results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          closedStart = null;
          return;
        }

        const lm = results.multiFaceLandmarks[0];

        // índices aproximados para MediaPipe FaceMesh
        const leftEyeIdx = [33, 160, 158, 133, 153, 144];
        const rightEyeIdx = [362, 385, 387, 263, 373, 380];

        const leftEAR = eyeAspectRatio(lm, leftEyeIdx);
        const rightEAR = eyeAspectRatio(lm, rightEyeIdx);

        const bothClosed = leftEAR < EAR_THRESHOLD && rightEAR < EAR_THRESHOLD;
        const now = performance.now();
        if (bothClosed) {
          if (closedStart === null) closedStart = now;
          else if (now - closedStart >= CLOSED_MS) {
            // detected closure long enough -> trigger
            cleanup();
            resolve();
          }
        } else {
          closedStart = null;
        }
      });

      // Iniciar cámara usando Camera util de MediaPipe
      camera = new Camera(video, {
        onFrame: async () => { await faceMesh.send({ image: video }); },
        width: 640,
        height: 480
      });
      camera.start();

      // Cuando la promesa se resuelva, la página reproductora se encargará de iniciar el vídeo destino.

      // cleanup interno
      function cleanup() {
        try { if (camera && camera.stop) camera.stop(); } catch (e) {}
        try { if (faceMesh && faceMesh.close) faceMesh.close(); } catch (e) {}
        try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        try { if (video && video.parentNode) video.parentNode.removeChild(video); } catch (e) {}
      }

      // Timeout de seguridad opcional (ej: 30s)
      const TIMEOUT_MS = 30000;
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('timeout')); 
      }, TIMEOUT_MS);

      // Asegurar que cuando se resuelva se limpia el timeout
      const originalResolve = resolve;
      resolve = (...args) => { clearTimeout(timeoutId); originalResolve(...args); };

    } catch (err) {
      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      reject(err);
    }
  });
}
