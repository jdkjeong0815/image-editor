const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const ledToggleBtn = document.getElementById('led-toggle-btn');
const setPointsBtn = document.getElementById('set-points-btn');
const playAnimBtn = document.getElementById('play-animation-btn');
const animSpeedSlider = document.getElementById('anim-speed');
const animSpeedVal = document.getElementById('anim-speed-val');
const canvasWrapper = document.querySelector('.canvas-wrapper');
const dualMonitorBtn = document.getElementById('dual-monitor-btn');
const slideIntervalSlider = document.getElementById('slide-interval');
const slideIntervalVal = document.getElementById('slide-interval-val');
const ledOverlay = document.getElementById('led-overlay');
const slideProgressBar = document.getElementById('slide-progress-bar');
const slideProgressContainer = document.getElementById('slide-progress-container');

const sliders = {
    brightness: document.getElementById('brightness'),
    contrast: document.getElementById('contrast'),
    saturation: document.getElementById('saturation'),
    neonThreshold: document.getElementById('neon-threshold'),
    neonIntensity: document.getElementById('neon-intensity')
};

const valueDisplays = {
    brightness: document.getElementById('brightness-val'),
    contrast: document.getElementById('contrast-val'),
    saturation: document.getElementById('saturation-val'),
    neonThreshold: document.getElementById('neon-threshold-val'),
    neonIntensity: document.getElementById('neon-intensity-val')
};

let originalImage = null;

// Initialize
resetBtn.addEventListener('click', resetSliders);
ledToggleBtn.addEventListener('click', toggleLEDMode);
setPointsBtn.addEventListener('click', togglePointSelection);
playAnimBtn.addEventListener('click', toggleAnimation);
dualMonitorBtn.addEventListener('click', openDisplayWindow);
animSpeedSlider.addEventListener('input', (e) => animSpeedVal.textContent = e.target.value);
slideIntervalSlider.addEventListener('input', (e) => {
    slideIntervalVal.textContent = `${e.target.value}s`;
    if (!isAnimating) startStaticSlideTimer(); // 간격 변경 시 타이머 재설정
});
downloadBtn.addEventListener('click', downloadImage);
canvas.addEventListener('mousedown', handleCanvasClick);

let animPoints = [];
let isSelecting = false;
let isAnimating = false;
let animRequest = null;
let animStartTime = 0;

let displayWindow = null;
let displayCanvas = null;
let displayCtx = null;

let staticSlideTimer = null;
let imagePool = [];
let isTransitioning = false;
let transitionPhase = 'none'; // 'out', 'wait', 'in'
let transitionStartTime = 0;
const FADE_HALF_DURATION = 2000; // 2초 페이드로 증가 (매우 부드러운 전환)
let progressRequest = null;
let slideStartTime = 0;
let currentImageIdx = 0;
let isFirstImageLoaded = false;

// Load default image and fetch slideshow pool
window.addEventListener('DOMContentLoaded', () => {
    fetch('image_list.json')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            imagePool = data.map(name => `image/${name}`);
            if (imagePool.length > 0) {
                loadImage(imagePool[0]);
                startStaticSlideTimer(); // 초기 로드 후 타이머 시작
            } else {
                console.warn('Image pool is empty.');
                loadDefault();
            }
        })
        .catch(err => {
            console.error('Failed to load image_list.json:', err.message);
            loadDefault();
        });
});

function startStaticSlideTimer() {
    stopStaticSlideTimer();
    if (imagePool.length > 1 && !isAnimating) {
        const interval = parseInt(slideIntervalSlider.value) * 1000;
        staticSlideTimer = setTimeout(startTransitionOut, interval);

        // 프로그레스 바 애니메이션 시작
        slideStartTime = performance.now();
        slideProgressContainer.classList.add('active');
        if (progressRequest) cancelAnimationFrame(progressRequest);
        progressRequest = requestAnimationFrame(updateProgressBar);
    } else {
        slideProgressContainer.classList.remove('active');
    }
}

function updateProgressBar(time) {
    if (!staticSlideTimer || isAnimating || isTransitioning) {
        slideProgressContainer.classList.remove('active');
        return;
    }

    const interval = parseInt(slideIntervalSlider.value) * 1000;
    const elapsed = time - slideStartTime;
    const progress = Math.min(100, (elapsed / interval) * 100);

    slideProgressBar.style.width = `${progress}%`;

    if (elapsed < interval) {
        progressRequest = requestAnimationFrame(updateProgressBar);
    }
}

function stopStaticSlideTimer() {
    if (staticSlideTimer) {
        clearTimeout(staticSlideTimer);
        staticSlideTimer = null;
    }
    if (progressRequest) {
        cancelAnimationFrame(progressRequest);
        progressRequest = null;
    }
    slideProgressContainer.classList.remove('active');
}

function loadDefault() {
    // Use an existing image from the directory as a foolproof fallback
    const fallbackImage = 'image/van_gogh_s_bedroom_in_arles_led_optimized.webp';
    console.log('Attempting to load fallback:', fallbackImage);
    loadImage(fallbackImage);
}

function loadImage(path) {
    const img = new Image();
    img.src = path;
    img.onload = () => {
        originalImage = img;
        initCanvas();
        if (displayWindow && !displayWindow.closed) initDisplayCanvas();
        applyFilters();
    };
    img.onerror = () => {
        console.error("Image load fail (404/Error):", path);
        // If an image fails to load during slideshow, skip to next
        if (isAnimating && imagePool.length > 1) {
            console.warn("Skipping to next image due to load failure...");
            switchToNextImage();
        }
    };
}

function initCanvas() {
    if (!originalImage) return;

    // DECISION: Decouple physical resolution from display size
    // We set the canvas to the FULL image resolution for crystal clear zoom
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;

    // Ensure highest interpolation quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1프레임 튀는 현상(Flash)의 주범이었으므로, 여기서 강제 drawImage를 수행하지 않음.
    // 렌더링 루프(applyFilters / renderFrame)가 바로 뒤이어 오버레이와 함께 정상적으로 그려줌.
}

function handleCanvasClick(e) {
    if (!isSelecting || !originalImage) return;

    // With high-res canvas, we must get coordinates relative to display size
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    animPoints.push({ x, y });
    setPointsBtn.textContent = `포인트 지정 (${animPoints.length}/4)`;

    applyFilters(); // Redraw to show points

    if (animPoints.length === 4) {
        finishSelection();
    }
}

function togglePointSelection() {
    if (isAnimating) stopAnimation();

    isSelecting = !isSelecting;
    if (isSelecting) {
        animPoints = [];
        setPointsBtn.classList.add('active');
        setPointsBtn.textContent = '이미지 클릭 (0/4)';
        canvasWrapper.classList.add('selecting');
        playAnimBtn.disabled = true;
    } else {
        cancelSelection();
    }
}

function cancelSelection() {
    isSelecting = false;
    setPointsBtn.classList.remove('active');
    setPointsBtn.textContent = '포인트 지정 (0/4)';
    canvasWrapper.classList.remove('selecting');
    animPoints = [];
}

function finishSelection() {
    isSelecting = false;
    setPointsBtn.classList.remove('active');
    canvasWrapper.classList.remove('selecting');
    playAnimBtn.disabled = false;
    setPointsBtn.textContent = '포인트 재설정';
}

function toggleAnimation() {
    if (isAnimating) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

function startAnimation() {
    if (animPoints.length < 4) return;
    isAnimating = true;
    playAnimBtn.textContent = '애니메이션 정지';
    playAnimBtn.classList.add('active');
    animStartTime = 0; // Reset to 0 to capture on first frame
    stopStaticSlideTimer(); // 애니메이션 중에는 정지 타이머 중지
    animRequest = requestAnimationFrame(animationLoop);
}

function stopAnimation() {
    isAnimating = false;
    playAnimBtn.textContent = '애니메이션 재생';
    playAnimBtn.classList.remove('active');
    cancelAnimationFrame(animRequest);
    applyFilters(); // Reset to static view
    startStaticSlideTimer(); // 애니메이션 멈추면 정지 타이머 재시작
}

function animationLoop(time) {
    if (!isAnimating || animPoints.length < 2) {
        stopAnimation();
        return;
    }

    if (animStartTime === 0) animStartTime = time;

    // --- PAUSE & TRANSITION LOGIC ---
    // We now have 4 segments: P1-P2, P2-P3, P3-Global, Global-P1
    // Each segment consists of: [Movement (T)] + [Pause (3s)]

    const pauseDuration = 3000; // 3 seconds pause
    const moveDuration = (10 - parseFloat(animSpeedSlider.value)) * 15000; // 15x slower: 25s to 75s (base 50s)
    const totalStepDuration = moveDuration + pauseDuration;

    const segmentCount = animPoints.length + 1; // Points + Global View
    const elapsedTotal = Math.max(0, time - animStartTime);
    const loopDuration = totalStepDuration * segmentCount;
    const loopCount = Math.floor(elapsedTotal / loopDuration);

    // If one loop completes and we have a slideshow pool, move to next image
    if (imagePool.length > 1 && loopCount > 0) {
        if (!isTransitioning) {
            startTransitionOut();
        }
        // return 하지 않고 애니메이션(줌/이동)이 페이드아웃 중에도 계속되게 함 (화면이 블랙이 될때까지)
    }

    const elapsed = elapsedTotal % loopDuration;
    const segmentIdx = Math.floor(elapsed / totalStepDuration);
    const segmentElapsed = elapsed % totalStepDuration;

    let centerX, centerY, zoom;

    // Loop logic to match: [0: Global to P1], [1: P1 to P2], [2: P2 to P3], [3: P3 to P4], [4: P4 to Global]
    const pStartIdx = (segmentIdx - 1 + segmentCount) % segmentCount;
    const pEndIdx = segmentIdx % segmentCount;

    const pStartSource = getAnimationTarget(pStartIdx);
    const pEndTarget = getAnimationTarget(pEndIdx);

    if (segmentElapsed < moveDuration) {
        // --- MOVEMENT PHASE ---
        const t = segmentElapsed / moveDuration;
        // Premium Cubic Easing for seamless speed transitions
        const smoothT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const pStartSource = getAnimationTarget(pStartIdx);
        const pEndTarget = getAnimationTarget(pEndIdx);

        centerX = pStartSource.x * (1 - smoothT) + pEndTarget.x * smoothT;
        centerY = pStartSource.y * (1 - smoothT) + pEndTarget.y * smoothT;

        // Dynamic Zoom logic: Using smooth sine curve for the dip
        if (pStartSource.z === pEndTarget.z && pStartSource.z > 1.0) {
            const zoomDip = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
            zoom = pStartSource.z - (pStartSource.z - 1.0) * zoomDip;
        } else {
            zoom = pStartSource.z * (1 - smoothT) + pEndTarget.z * smoothT;
        }
    } else {
        // --- PAUSE PHASE (with Breathing Effect) ---
        const target = getAnimationTarget(pEndIdx);
        const pauseT = (segmentElapsed - moveDuration) / pauseDuration;

        centerX = target.x;
        centerY = target.y;

        // Subtle Breathing: Slight 3% expansion/contraction during the pause
        const breathing = 1 + 0.03 * Math.sin(pauseT * Math.PI);
        zoom = target.z * breathing;
    }

    renderFrame(centerX, centerY, zoom);
    animRequest = requestAnimationFrame(animationLoop);
}

function startTransitionOut() {
    stopStaticSlideTimer();
    isTransitioning = true;
    transitionPhase = 'out';
    transitionStartTime = performance.now();

    if (!isAnimating) {
        requestAnimationFrame(staticFadeLoop);
    }
}

function proceedToNextImage() {
    currentImageIdx = (currentImageIdx + 1) % imagePool.length;
    const path = imagePool[currentImageIdx];

    const img = new Image();
    img.src = path;
    img.onload = () => {
        originalImage = img;
        initCanvas();
        if (displayWindow && !displayWindow.closed) initDisplayCanvas();

        transitionPhase = 'in';
        transitionStartTime = performance.now();

        if (isAnimating) {
            // 애니메이션이 돌고 있으면 시작 시간 리셋, loop가 자연스럽게 이어짐
            animStartTime = 0;
        } else {
            // 새 이미지가 로드되었으므로 블랙에서 이미지로 서서히 밝아짐
            requestAnimationFrame(staticFadeLoop);
        }
    };
    img.onerror = () => proceedToNextImage();
}

function staticFadeLoop(time) {
    if (isAnimating) return; // 애니메이션 구동 중이면 animationLoop 에서 처리됨

    applyFilters();
    if (isTransitioning) {
        requestAnimationFrame(staticFadeLoop);
    }
}

function drawTransitionOverlay() {
    if (!isTransitioning) return;

    if (transitionPhase === 'wait') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const elapsed = performance.now() - transitionStartTime;
    const fadeT = Math.min(1, Math.max(0, elapsed / FADE_HALF_DURATION));
    const alpha = (transitionPhase === 'out') ? fadeT : (1 - fadeT);

    // Ease-InOut 부드러운 전환을 위한 곡선
    const smoothAlpha = alpha * alpha * (3 - 2 * alpha);

    ctx.filter = 'none';
    ctx.fillStyle = `rgba(0, 0, 0, ${smoothAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (fadeT >= 1.0) {
        if (transitionPhase === 'out') {
            transitionPhase = 'wait';
            proceedToNextImage();
        } else if (transitionPhase === 'in') {
            isTransitioning = false;
            transitionPhase = 'none';
            if (!isAnimating) startStaticSlideTimer();
        }
    }
}

// Helper to get coordinates/zoom for points or global view
function getAnimationTarget(idx) {
    if (idx < animPoints.length) {
        return {
            x: animPoints[idx].x,
            y: animPoints[idx].y,
            z: 2.0 // Zoom level changed to 2x
        };
    } else {
        return { x: 0.5, y: 0.5, z: 1.0 }; // Global View (Center, Zoom 1)
    }
}

function renderFrame(centerX, centerY, zoom) {
    if (!originalImage) return;

    // Enable High Quality Smoothing to prevent jittering at slow speeds
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Apply filters (same logic as applyFilters)
    const b = sliders.brightness.value;
    const c = sliders.contrast.value;
    const s = sliders.saturation.value;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `
        brightness(${b}%) 
        contrast(${c}%) 
        saturate(${s}%) 
    `;

    // Calculate source rectangle
    const sw = originalImage.width / zoom;
    const sh = originalImage.height / zoom;

    // Clamp coordinates to keep image in view (no empty spaces)
    let sx = (centerX * originalImage.width) - (sw / 2);
    let sy = (centerY * originalImage.height) - (sh / 2);

    sx = Math.max(0, Math.min(sx, originalImage.width - sw));
    sy = Math.max(0, Math.min(sy, originalImage.height - sh));

    ctx.drawImage(originalImage, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);



    const ni = sliders.neonIntensity.value;
    const nt = sliders.neonThreshold.value;
    if (ni > 0) applyNeonGlow(nt, ni / 100);

    // --- Fade to Black Transition ---
    drawTransitionOverlay();

    // Now Sync to display window (Draw the already-processed 'canvas' to displayCtx)
    if (displayCtx && displayCanvas) {
        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.filter = 'none'; // Filters are already in 'canvas'
        displayCtx.imageSmoothingEnabled = true;
        displayCtx.imageSmoothingQuality = 'high';

        const winW = displayCanvas.width;
        const winH = displayCanvas.height;
        const imgRatio = originalImage.width / originalImage.height;
        const winRatio = winW / winH;

        let dx, dy, dw, dh;
        if (imgRatio > winRatio) {
            dw = winW;
            dh = winW / imgRatio;
            dx = 0;
            dy = (winH - dh) / 2;
        } else {
            dh = winH;
            dw = winH * imgRatio;
            dx = (winW - dw) / 2;
            dy = 0;
        }

        // Draw the main 'canvas' (which has filters, edge, neon) to display
        displayCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, dx, dy, dw, dh);
    }
}

function applyFilters() {
    // --- 1. UI 값 디스플레이 업데이트 (슬라이더와 숫자 항상 동기화) ---
    const b = sliders.brightness.value;
    const c = sliders.contrast.value;
    const s = sliders.saturation.value;
    const nt = sliders.neonThreshold.value;
    const ni = sliders.neonIntensity.value;

    valueDisplays.brightness.textContent = `${b}%`;
    valueDisplays.contrast.textContent = `${c}%`;
    valueDisplays.saturation.textContent = `${s}%`;
    valueDisplays.neonThreshold.textContent = nt;
    valueDisplays.neonIntensity.textContent = `${ni}%`;

    // --- 2. 캔버스 렌더링 조기 종료 조건 ---
    if (!originalImage || isAnimating) return;

    // --- 3. 기본 필터 및 효과 적용 ---

    // Reset and draw base filters
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `
        brightness(${b}%) 
        contrast(${c}%) 
        saturate(${s}%) 
    `;

    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);



    // Apply Neon Glow
    if (ni > 0) {
        applyNeonGlow(nt, ni / 100);
    }

    // --- Fade to Black Transition ---
    drawTransitionOverlay();

    // --- 4. 듀얼 모니터 동기화 (모든 효과가 적용된 메인 'canvas'를 복제) ---
    if (displayCtx && displayCanvas) {
        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.filter = 'none'; // 필터가 이미 캔버스에 베이킹됨
        displayCtx.imageSmoothingEnabled = true;
        displayCtx.imageSmoothingQuality = 'high';

        const winW = displayCanvas.width;
        const winH = displayCanvas.height;
        const imgRatio = originalImage.width / originalImage.height;
        const winRatio = winW / winH;

        let dx, dy, dw, dh;
        if (imgRatio > winRatio) {
            dw = winW;
            dh = winW / imgRatio;
            dx = 0;
            dy = (winH - dh) / 2;
        } else {
            dh = winH;
            dw = winH * imgRatio;
            dx = (winW - dw) / 2;
            dy = 0;
        }

        displayCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, dx, dy, dw, dh);
    }

    // Draw points if selecting
    if (isSelecting || animPoints.length > 0) {
        drawPoints();
    }
}

function drawPoints() {
    // Points are stored as 0-1 normalized coordinates
    animPoints.forEach((p, i) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;

        // Scale point size based on image resolution so they remain visible
        const baseSize = Math.max(canvas.width, canvas.height) * 0.01;
        const dotSize = Math.max(10, baseSize);

        // Circle
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = Math.max(2, dotSize / 5);
        ctx.stroke();

        // Number
        ctx.fillStyle = 'white';
        ctx.font = `bold ${dotSize}px Outfit`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, x, y);
    });
}

function applyNeonGlow(threshold, intensity) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // 밝기 계산 (단순 최대값 방식을 써서 원본 색상을 더 잘 반영하도록 함)
        const brightness = Math.max(r, g, b);

        if (brightness >= threshold) {
            // 강도에 따른 부스팅 (intensity가 높을수록 더 밝고 선명하게)
            const boost = 1 + (intensity * 2);

            pixels[i] = Math.min(255, r * boost);
            pixels[i + 1] = Math.min(255, g * boost);
            pixels[i + 2] = Math.min(255, b * boost);

            // 채도 강화 (네온 느낌을 위해)
            const saturationBoost = 1 + intensity;
            const avg = (r + g + b) / 3;
            pixels[i] = Math.min(255, avg + (pixels[i] - avg) * saturationBoost);
            pixels[i + 1] = Math.min(255, avg + (pixels[i + 1] - avg) * saturationBoost);
            pixels[i + 2] = Math.min(255, avg + (pixels[i + 2] - avg) * saturationBoost);
        }
    }
    ctx.putImageData(imgData, 0, 0);
}



function resetSliders() {
    sliders.brightness.value = 100;
    sliders.contrast.value = 100;
    sliders.saturation.value = 100;
    sliders.neonThreshold.value = 200;
    sliders.neonIntensity.value = 0;
    ledToggleBtn.classList.remove('active');
    applyFilters();
}

function toggleLEDMode() {
    const isActive = ledToggleBtn.classList.toggle('active');
    ledOverlay.classList.toggle('active', isActive);

    if (isActive) {
        // LED 전광판 최적화 값 세팅
        sliders.brightness.value = 105; // 110 -> 105
        sliders.contrast.value = 130;
        sliders.saturation.value = 140;
        sliders.neonThreshold.value = 200; // 디폴트
        sliders.neonIntensity.value = 0;   // 디폴트
    } else {
        resetSliders();
    }
    applyFilters();
}

function downloadImage() {
    if (!originalImage) return;
    const link = document.createElement('a');
    link.download = 'ledcanvas-edited.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Add event listeners to all sliders
Object.values(sliders).forEach(slider => {
    slider.addEventListener('input', applyFilters);
});

// Resize handler
window.addEventListener('resize', () => {
    if (originalImage) initCanvas();
    if (displayWindow && !displayWindow.closed) initDisplayCanvas();
    applyFilters();
});

function openDisplayWindow() {
    if (displayWindow && !displayWindow.closed) {
        displayWindow.focus();
        return;
    }

    const features = 'width=1280,height=720,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=yes';
    displayWindow = window.open('display.html', 'AntigravityDisplay', features);

    displayWindow.onload = () => {
        initDisplayCanvas();
        applyFilters();
    };

    // Add resize listener to display window to handle resolution changes
    displayWindow.onresize = () => {
        initDisplayCanvas();
        applyFilters();
    };

    // Close display if main window closes
    window.onunload = () => {
        if (displayWindow) displayWindow.close();
    };
}

function initDisplayCanvas() {
    if (!displayWindow || displayWindow.closed || !originalImage) return;

    displayCanvas = displayWindow.document.getElementById('display-canvas');
    if (!displayCanvas) return;

    displayCtx = displayCanvas.getContext('2d');

    // CRITICAL: Set display canvas to pixel-perfect match with the display window resolution
    displayCanvas.width = displayWindow.innerWidth;
    displayCanvas.height = displayWindow.innerHeight;
}


