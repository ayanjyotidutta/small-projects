/* =============================================
   ASCII Art Studio — script.js
   ============================================= */

(function () {
    'use strict';

    // ─── TAB SWITCHING ──────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // ─── UTILITIES ──────────────────────────────
    function showToast(msg, type = 'success') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        toast.style.backgroundColor = type === 'success' ? 'var(--success)' : 'var(--danger)';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copied to clipboard!');
        });
    }

    function downloadText(filename, text) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ─── ASCII CHARACTER SETS ───────────────────
    const CHARSET_HIGH = '@#S%?*+;:,.  ';
    const CHARSET_MED = '@#%=+*:-. ';
    const CHARSET_LOW = '@#*+:. ';

    function pixelToChar(brightness, charset) {
        const index = Math.floor((brightness / 255) * (charset.length - 1));
        return charset[index];
    }

    // ========================================================
    //   IMAGE TO ASCII
    // ========================================================

    let currentImageData = null;
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d');

    function convertImageToAscii(imgEl, width, charset, brightnessAdj) {
        const aspectRatio = imgEl.naturalHeight / imgEl.naturalWidth;
        const height = Math.floor(width * aspectRatio * 0.45);

        hiddenCanvas.width = width;
        hiddenCanvas.height = height;
        hiddenCtx.drawImage(imgEl, 0, 0, width, height);

        const imageData = hiddenCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        let result = '';

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const idx = (row * width + col) * 4;
                let lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
                lum = Math.min(255, Math.max(0, lum + brightnessAdj));
                result += pixelToChar(lum, charset);
            }
            result += '\n';
        }
        return result;
    }

    document.getElementById('imageUpload').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImageData = img;
                const preview = document.getElementById('imagePreview');
                preview.innerHTML = '';
                const previewImg = document.createElement('img');
                previewImg.src = e.target.result;
                preview.appendChild(previewImg);
                showToast('Image loaded! Click "Convert Image".');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('convertImage').addEventListener('click', () => {
        if (!currentImageData) { showToast('Please upload an image first!', 'error'); return; }

        const density = document.getElementById('asciiDensity').value;
        const width = parseInt(document.getElementById('imageWidth').value) || 100;
        const brightnessAdj = parseInt(document.getElementById('brightness').value) || 0;
        const charset = density === 'high' ? CHARSET_HIGH : density === 'medium' ? CHARSET_MED : CHARSET_LOW;

        const result = convertImageToAscii(currentImageData, width, charset, brightnessAdj);
        document.getElementById('imageResult').textContent = result;
        showToast('Conversion complete!');
    });

    document.getElementById('downloadImage').addEventListener('click', () => {
        const text = document.getElementById('imageResult').textContent;
        if (!text.trim()) { showToast('Nothing to download yet!', 'error'); return; }
        downloadText('ascii-image.txt', text);
        showToast('Downloaded!');
    });

    document.getElementById('copyImage').addEventListener('click', () => {
        const text = document.getElementById('imageResult').textContent;
        if (!text.trim()) { showToast('Nothing to copy yet!', 'error'); return; }
        copyToClipboard(text);
    });

    // ========================================================
    //   WEBCAM TO ASCII (Enhanced)
    // ========================================================

    // --- Palette Definitions ---
    const WC_PALETTES = {
        singleblock: '█',
        solidblock: '█▓▒░ ',
        minimalist: '@#:. ',
        medium: '@#S%?*+;:,. ',
        longer: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`. ',
        fullset: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`.\' ',
        max: '@%#*+=-:. ',
        alphabetic: 'MWBHAQOZDXYKUPGFESCLINJAmwbhaqozdxykupgfesclinja ',
        alphanumeric: 'MW8B6H9AQ0OD5XZYK2UP3GF4ES7CL1IN0JA ',
        extendedhigh: '█▉▊▋▌▍▎▏ ',
        mathsymbols: '∑∏∫∂√∞≈≠≤∝∈∅ ',
        numerical: '8906534721 '
    };

    // --- State ---
    let webcamStream = null;
    let animFrameId = null;
    let wcFlipped = true; // mirror by default
    let wcLastHtml = '';
    let wcLastText = '';

    const webcamVideo = document.getElementById('webcamVideo');
    const webcamCanvas = document.getElementById('webcamCanvas');
    const webcamCtx = webcamCanvas.getContext('2d');
    const webcamResult = document.getElementById('webcamResult');

    // --- Slider value display binding ---
    const wcSliders = [
        ['wcBrightness', 'wcBrightnessVal', ''],
        ['wcContrast', 'wcContrastVal', ''],
        ['wcCharacters', 'wcCharactersVal', ''],
        ['wcFontSize', 'wcFontSizeVal', '']
    ];

    wcSliders.forEach(([id, valId, suffix]) => {
        const slider = document.getElementById(id);
        const valEl = document.getElementById(valId);
        if (slider && valEl) {
            slider.addEventListener('input', () => {
                // Show as multiplier for brightness/contrast
                if (id === 'wcBrightness' || id === 'wcContrast') {
                    valEl.textContent = (slider.value / 100).toFixed(1);
                } else {
                    valEl.textContent = slider.value + suffix;
                }
            });
        }
    });

    // Font size binding
    document.getElementById('wcFontSize').addEventListener('input', function () {
        webcamResult.style.fontSize = this.value + 'px';
    });

    // --- Start / Stop ---
    document.getElementById('startWebcam').addEventListener('click', async () => {
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamVideo.srcObject = webcamStream;
            await webcamVideo.play();
            document.getElementById('startWebcam').disabled = true;
            document.getElementById('stopWebcam').disabled = false;
            document.getElementById('screenshotWebcam').disabled = false;
            startWebcamLoop();
        } catch (err) {
            showToast('Could not access webcam. Check browser permissions.', 'error');
        }
    });

    document.getElementById('stopWebcam').addEventListener('click', stopWebcam);

    function stopWebcam() {
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null; }
        webcamVideo.srcObject = null;
        document.getElementById('startWebcam').disabled = false;
        document.getElementById('stopWebcam').disabled = true;
        document.getElementById('screenshotWebcam').disabled = true;
    }

    function startWebcamLoop() {
        let lastTime = 0;
        function loop(time) {
            if (!webcamStream) return;
            // Throttle to ~20fps for performance
            if (time - lastTime > 50) {
                renderWebcamFrame();
                lastTime = time;
            }
            animFrameId = requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    }

    // --- Effects Engine ---
    function applyEffect(imageData, effect, w, h) {
        if (effect === 'none') return imageData;
        const d = imageData.data;
        const len = d.length;

        switch (effect) {
            case 'mirror': {
                const copy = new Uint8ClampedArray(d);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const src = (y * w + (w - 1 - x)) * 4;
                        const dst = (y * w + x) * 4;
                        d[dst] = copy[src]; d[dst + 1] = copy[src + 1]; d[dst + 2] = copy[src + 2]; d[dst + 3] = copy[src + 3];
                    }
                }
                break;
            }
            case 'flip': {
                const copy = new Uint8ClampedArray(d);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const src = ((h - 1 - y) * w + x) * 4;
                        const dst = (y * w + x) * 4;
                        d[dst] = copy[src]; d[dst + 1] = copy[src + 1]; d[dst + 2] = copy[src + 2]; d[dst + 3] = copy[src + 3];
                    }
                }
                break;
            }
            case 'negative':
                for (let i = 0; i < len; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
                break;
            case 'pixelate': {
                const bs = 4;
                for (let y = 0; y < h; y += bs) {
                    for (let x = 0; x < w; x += bs) {
                        const idx = (y * w + x) * 4;
                        const r = d[idx], g = d[idx + 1], b = d[idx + 2];
                        for (let dy = 0; dy < bs && y + dy < h; dy++) {
                            for (let dx = 0; dx < bs && x + dx < w; dx++) {
                                const i = ((y + dy) * w + (x + dx)) * 4;
                                d[i] = r; d[i + 1] = g; d[i + 2] = b;
                            }
                        }
                    }
                }
                break;
            }
            case 'blur': {
                const copy = new Uint8ClampedArray(d);
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        for (let c = 0; c < 3; c++) {
                            let sum = 0;
                            for (let dy = -1; dy <= 1; dy++)
                                for (let dx = -1; dx <= 1; dx++)
                                    sum += copy[((y + dy) * w + (x + dx)) * 4 + c];
                            d[(y * w + x) * 4 + c] = sum / 9;
                        }
                    }
                }
                break;
            }
            case 'emboss': {
                const copy = new Uint8ClampedArray(d);
                const k = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        for (let c = 0; c < 3; c++) {
                            let sum = 128;
                            let ki = 0;
                            for (let dy = -1; dy <= 1; dy++)
                                for (let dx = -1; dx <= 1; dx++)
                                    sum += k[ki++] * copy[((y + dy) * w + (x + dx)) * 4 + c];
                            d[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, sum));
                        }
                    }
                }
                break;
            }
            case 'posterize': {
                const levels = 4;
                for (let i = 0; i < len; i += 4) {
                    d[i] = Math.round(d[i] / 255 * (levels - 1)) / (levels - 1) * 255;
                    d[i + 1] = Math.round(d[i + 1] / 255 * (levels - 1)) / (levels - 1) * 255;
                    d[i + 2] = Math.round(d[i + 2] / 255 * (levels - 1)) / (levels - 1) * 255;
                }
                break;
            }
            case 'solarize':
                for (let i = 0; i < len; i += 4) {
                    if (d[i] > 128) d[i] = 255 - d[i];
                    if (d[i + 1] > 128) d[i + 1] = 255 - d[i + 1];
                    if (d[i + 2] > 128) d[i + 2] = 255 - d[i + 2];
                }
                break;
            case 'noise':
                for (let i = 0; i < len; i += 4) {
                    const n = (Math.random() - 0.5) * 60;
                    d[i] = Math.min(255, Math.max(0, d[i] + n));
                    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
                    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
                }
                break;
            case 'vignette': {
                const cx = w / 2, cy = h / 2, maxR = Math.sqrt(cx * cx + cy * cy);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR;
                        const factor = 1 - dist * dist * 0.8;
                        const i = (y * w + x) * 4;
                        d[i] *= factor; d[i + 1] *= factor; d[i + 2] *= factor;
                    }
                }
                break;
            }
            case 'infrared':
                for (let i = 0; i < len; i += 4) {
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = Math.min(255, lum * 1.5);
                    d[i + 1] = lum * 0.3;
                    d[i + 2] = lum * 0.3;
                }
                break;
            case 'blueprint':
                for (let i = 0; i < len; i += 4) {
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = lum * 0.2;
                    d[i + 1] = lum * 0.4;
                    d[i + 2] = Math.min(255, lum * 1.2 + 50);
                }
                break;
            case 'nightvision':
                for (let i = 0; i < len; i += 4) {
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = lum * 0.2;
                    d[i + 1] = Math.min(255, lum * 1.5);
                    d[i + 2] = lum * 0.2;
                }
                break;
            case 'thermal': {
                for (let i = 0; i < len; i += 4) {
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    const t = lum / 255;
                    d[i] = Math.min(255, t < 0.5 ? 0 : (t - 0.5) * 2 * 255);
                    d[i + 1] = Math.min(255, t < 0.33 ? t * 3 * 255 : t > 0.66 ? (1 - t) * 3 * 255 : 255);
                    d[i + 2] = Math.min(255, t < 0.5 ? (0.5 - t) * 2 * 255 : 0);
                }
                break;
            }
            case 'xray':
                for (let i = 0; i < len; i += 4) {
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    const inv = 255 - lum;
                    d[i] = inv * 0.8 + 40;
                    d[i + 1] = inv * 0.9 + 20;
                    d[i + 2] = Math.min(255, inv + 30);
                }
                break;
            case 'comic': {
                const levels = 6;
                for (let i = 0; i < len; i += 4) {
                    d[i] = Math.round(d[i] / 255 * (levels - 1)) / (levels - 1) * 255;
                    d[i + 1] = Math.round(d[i + 1] / 255 * (levels - 1)) / (levels - 1) * 255;
                    d[i + 2] = Math.round(d[i + 2] / 255 * (levels - 1)) / (levels - 1) * 255;
                    // Boost saturation
                    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
                    d[i] = Math.min(255, d[i] + (d[i] - avg) * 0.5);
                    d[i + 1] = Math.min(255, d[i + 1] + (d[i + 1] - avg) * 0.5);
                    d[i + 2] = Math.min(255, d[i + 2] + (d[i + 2] - avg) * 0.5);
                }
                break;
            }
            case 'sketch': {
                const copy = new Uint8ClampedArray(d);
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        const i = (y * w + x) * 4;
                        const gx = -copy[((y - 1) * w + x - 1) * 4] + copy[((y - 1) * w + x + 1) * 4]
                            - 2 * copy[(y * w + x - 1) * 4] + 2 * copy[(y * w + x + 1) * 4]
                            - copy[((y + 1) * w + x - 1) * 4] + copy[((y + 1) * w + x + 1) * 4];
                        const gy = -copy[((y - 1) * w + x - 1) * 4] - 2 * copy[((y - 1) * w + x) * 4] - copy[((y - 1) * w + x + 1) * 4]
                            + copy[((y + 1) * w + x - 1) * 4] + 2 * copy[((y + 1) * w + x) * 4] + copy[((y + 1) * w + x + 1) * 4];
                        const edge = 255 - Math.min(255, Math.sqrt(gx * gx + gy * gy));
                        d[i] = edge; d[i + 1] = edge; d[i + 2] = edge;
                    }
                }
                break;
            }
            case 'oilpaint': {
                const copy = new Uint8ClampedArray(d);
                const radius = 2;
                for (let y = radius; y < h - radius; y++) {
                    for (let x = radius; x < w - radius; x++) {
                        let maxCount = 0, maxR = 0, maxG = 0, maxB = 0;
                        const bins = {};
                        for (let dy = -radius; dy <= radius; dy++) {
                            for (let dx = -radius; dx <= radius; dx++) {
                                const si = ((y + dy) * w + (x + dx)) * 4;
                                const key = (copy[si] >> 4) * 256 + (copy[si + 1] >> 4) * 16 + (copy[si + 2] >> 4);
                                bins[key] = (bins[key] || 0) + 1;
                                if (bins[key] > maxCount) {
                                    maxCount = bins[key]; maxR = copy[si]; maxG = copy[si + 1]; maxB = copy[si + 2];
                                }
                            }
                        }
                        const i = (y * w + x) * 4;
                        d[i] = maxR; d[i + 1] = maxG; d[i + 2] = maxB;
                    }
                }
                break;
            }
            case 'mosaic': {
                const bs = 6;
                for (let y = 0; y < h; y += bs) {
                    for (let x = 0; x < w; x += bs) {
                        let tr = 0, tg = 0, tb = 0, cnt = 0;
                        for (let dy = 0; dy < bs && y + dy < h; dy++)
                            for (let dx = 0; dx < bs && x + dx < w; dx++) {
                                const si = ((y + dy) * w + (x + dx)) * 4;
                                tr += d[si]; tg += d[si + 1]; tb += d[si + 2]; cnt++;
                            }
                        tr /= cnt; tg /= cnt; tb /= cnt;
                        for (let dy = 0; dy < bs && y + dy < h; dy++)
                            for (let dx = 0; dx < bs && x + dx < w; dx++) {
                                const si = ((y + dy) * w + (x + dx)) * 4;
                                d[si] = tr; d[si + 1] = tg; d[si + 2] = tb;
                            }
                    }
                }
                break;
            }
            case 'kaleidoscope': {
                const copy = new Uint8ClampedArray(d);
                const cx = w / 2, cy = h / 2;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const sx = Math.abs(x - cx);
                        const sy = Math.abs(y - cy);
                        const srcX = Math.min(w - 1, Math.floor(cx + sx));
                        const srcY = Math.min(h - 1, Math.floor(cy + sy));
                        const si = (srcY * w + srcX) * 4;
                        const di = (y * w + x) * 4;
                        d[di] = copy[si]; d[di + 1] = copy[si + 1]; d[di + 2] = copy[si + 2];
                    }
                }
                break;
            }
            case 'glitch': {
                const copy = new Uint8ClampedArray(d);
                for (let i = 0; i < 8; i++) {
                    const y = Math.floor(Math.random() * h);
                    const shift = Math.floor(Math.random() * 20) - 10;
                    for (let x = 0; x < w; x++) {
                        const sx = Math.min(w - 1, Math.max(0, x + shift));
                        const di = (y * w + x) * 4;
                        const si = (y * w + sx) * 4;
                        d[di] = copy[si]; d[di + 1] = copy[si + 1]; d[di + 2] = copy[si + 2];
                    }
                }
                break;
            }
            case 'matrix':
                for (let i = 0; i < len; i += 4) {
                    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = 0;
                    d[i + 1] = Math.min(255, lum * 1.2);
                    d[i + 2] = lum * 0.1;
                }
                break;
            case 'halftone': {
                const bs = 3;
                for (let y = 0; y < h; y += bs) {
                    for (let x = 0; x < w; x += bs) {
                        const i = (y * w + x) * 4;
                        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                        const val = lum > 128 ? 255 : 0;
                        for (let dy = 0; dy < bs && y + dy < h; dy++)
                            for (let dx = 0; dx < bs && x + dx < w; dx++) {
                                const si = ((y + dy) * w + (x + dx)) * 4;
                                d[si] = val; d[si + 1] = val; d[si + 2] = val;
                            }
                    }
                }
                break;
            }
            case 'crosshatch': {
                const copy = new Uint8ClampedArray(d);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = (y * w + x) * 4;
                        const lum = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
                        let val = 255;
                        if (lum < 200 && (x + y) % 4 === 0) val -= 60;
                        if (lum < 150 && (x - y + h) % 4 === 0) val -= 60;
                        if (lum < 100 && x % 3 === 0) val -= 60;
                        if (lum < 50) val -= 60;
                        d[i] = Math.max(0, val); d[i + 1] = Math.max(0, val); d[i + 2] = Math.max(0, val);
                    }
                }
                break;
            }
            case 'bulge': {
                const copy = new Uint8ClampedArray(d);
                const cx = w / 2, cy = h / 2;
                const maxR = Math.min(cx, cy);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const dx = x - cx, dy = y - cy;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const di = (y * w + x) * 4;
                        if (dist < maxR) {
                            const factor = Math.pow(dist / maxR, 0.5);
                            const sx = Math.floor(cx + dx * factor);
                            const sy = Math.floor(cy + dy * factor);
                            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                                const si = (sy * w + sx) * 4;
                                d[di] = copy[si]; d[di + 1] = copy[si + 1]; d[di + 2] = copy[si + 2];
                            }
                        }
                    }
                }
                break;
            }
            case 'swirl': {
                const copy = new Uint8ClampedArray(d);
                const cx = w / 2, cy = h / 2;
                const maxR = Math.min(cx, cy);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const dx = x - cx, dy = y - cy;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const di = (y * w + x) * 4;
                        if (dist < maxR) {
                            const angle = (1 - dist / maxR) * 3;
                            const cos = Math.cos(angle), sin = Math.sin(angle);
                            const sx = Math.floor(cx + dx * cos - dy * sin);
                            const sy = Math.floor(cy + dx * sin + dy * cos);
                            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                                const si = (sy * w + sx) * 4;
                                d[di] = copy[si]; d[di + 1] = copy[si + 1]; d[di + 2] = copy[si + 2];
                            }
                        }
                    }
                }
                break;
            }
            case 'ripple': {
                const copy = new Uint8ClampedArray(d);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const sx = Math.floor(x + Math.sin(y / 5) * 5);
                        const sy = Math.floor(y + Math.cos(x / 5) * 5);
                        const di = (y * w + x) * 4;
                        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                            const si = (sy * w + sx) * 4;
                            d[di] = copy[si]; d[di + 1] = copy[si + 1]; d[di + 2] = copy[si + 2];
                        }
                    }
                }
                break;
            }
            case 'fisheye': {
                const copy = new Uint8ClampedArray(d);
                const cx = w / 2, cy = h / 2;
                const maxR = Math.min(cx, cy);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const dx = (x - cx) / maxR, dy = (y - cy) / maxR;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const di = (y * w + x) * 4;
                        if (dist < 1) {
                            const r = dist * dist;
                            const sx = Math.floor(cx + dx * r * maxR);
                            const sy = Math.floor(cy + dy * r * maxR);
                            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                                const si = (sy * w + sx) * 4;
                                d[di] = copy[si]; d[di + 1] = copy[si + 1]; d[di + 2] = copy[si + 2];
                            }
                        }
                    }
                }
                break;
            }
            case 'ansi16': {
                const palette = [
                    [0,0,0],[170,0,0],[0,170,0],[170,170,0],[0,0,170],[170,0,170],[0,170,170],[170,170,170],
                    [85,85,85],[255,85,85],[85,255,85],[255,255,85],[85,85,255],[255,85,255],[85,255,255],[255,255,255]
                ];
                for (let i = 0; i < len; i += 4) {
                    let minDist = Infinity, best = palette[0];
                    for (const c of palette) {
                        const dist = (d[i]-c[0])**2 + (d[i+1]-c[1])**2 + (d[i+2]-c[2])**2;
                        if (dist < minDist) { minDist = dist; best = c; }
                    }
                    d[i] = best[0]; d[i+1] = best[1]; d[i+2] = best[2];
                }
                break;
            }
            case 'ansi256': {
                const palette = [
                    [0,0,0],[170,0,0],[0,170,0],[170,170,0],[0,0,170],[170,0,170],[0,170,170],[170,170,170],
                    [85,85,85],[255,85,85],[85,255,85],[255,255,85],[85,85,255],[255,85,255],[85,255,255],[255,255,255]
                ];
                const cv = [0, 95, 135, 175, 215, 255];
                for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++)
                    palette.push([cv[r], cv[g], cv[b]]);
                for (let i = 0; i < 24; i++) { const v = 8 + 10 * i; palette.push([v, v, v]); }
                for (let i = 0; i < len; i += 4) {
                    let minDist = Infinity, best = palette[0];
                    for (const c of palette) {
                        const dist = (d[i]-c[0])**2 + (d[i+1]-c[1])**2 + (d[i+2]-c[2])**2;
                        if (dist < minDist) { minDist = dist; best = c; }
                    }
                    d[i] = best[0]; d[i+1] = best[1]; d[i+2] = best[2];
                }
                break;
            }
            case 'blackwhite': {
                for (let i = 0; i < len; i += 4) {
                    const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
                    const val = lum > 128 ? 255 : 0;
                    d[i] = val; d[i+1] = val; d[i+2] = val;
                }
                break;
            }
            case 'hazydays': {
                for (let i = 0; i < len; i += 4) {
                    d[i]   = Math.min(255, d[i]   * 0.6 + 100);
                    d[i+1] = Math.min(255, d[i+1] * 0.6 + 90);
                    d[i+2] = Math.min(255, d[i+2] * 0.5 + 80);
                }
                break;
            }
            case 'mirrorleft': {
                const copy = new Uint8ClampedArray(d);
                const half = Math.floor(w / 2);
                for (let y = 0; y < h; y++) {
                    for (let x = half; x < w; x++) {
                        const si = (y * w + (w - 1 - x)) * 4;
                        const di = (y * w + x) * 4;
                        d[di] = copy[si]; d[di+1] = copy[si+1]; d[di+2] = copy[si+2]; d[di+3] = copy[si+3];
                    }
                }
                break;
            }
            case 'spycam': {
                const cx = w / 2, cy = h / 2;
                const maxR = Math.sqrt(cx * cx + cy * cy);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = (y * w + x) * 4;
                        const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
                        d[i]   = lum * 0.7 + d[i]   * 0.3;
                        d[i+1] = Math.min(255, lum * 0.8 + d[i+1] * 0.3 + 10);
                        d[i+2] = lum * 0.6 + d[i+2] * 0.3;
                        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR;
                        const vf = 1 - dist * dist * 0.7;
                        d[i] *= vf; d[i+1] *= vf; d[i+2] *= vf;
                        const n = (Math.random() - 0.5) * 25;
                        d[i]   = Math.min(255, Math.max(0, d[i]   + n));
                        d[i+1] = Math.min(255, Math.max(0, d[i+1] + n));
                        d[i+2] = Math.min(255, Math.max(0, d[i+2] + n));
                    }
                }
                break;
            }
        }
        return imageData;
    }

    // --- Sharpness convolution ---
    function applySharpen(imageData, amount, w, h) {
        const d = imageData.data;
        const copy = new Uint8ClampedArray(d);
        const f = amount / 10;
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    const i = (y * w + x) * 4 + c;
                    const center = copy[i] * 5 * f;
                    const neighbors = copy[((y - 1) * w + x) * 4 + c] + copy[((y + 1) * w + x) * 4 + c]
                        + copy[(y * w + x - 1) * 4 + c] + copy[(y * w + x + 1) * 4 + c];
                    const val = copy[i] + (center - neighbors * f);
                    d[i] = Math.min(255, Math.max(0, val));
                }
            }
        }
        return imageData;
    }

    // --- Edge detection (Sobel) ---
    function applyEdgeDetection(imageData, strength, w, h) {
        const d = imageData.data;
        const copy = new Uint8ClampedArray(d);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const getLum = (px, py) => {
                    const i = (py * w + px) * 4;
                    return 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
                };
                const gx = -getLum(x - 1, y - 1) + getLum(x + 1, y - 1)
                    - 2 * getLum(x - 1, y) + 2 * getLum(x + 1, y)
                    - getLum(x - 1, y + 1) + getLum(x + 1, y + 1);
                const gy = -getLum(x - 1, y - 1) - 2 * getLum(x, y - 1) - getLum(x + 1, y - 1)
                    + getLum(x - 1, y + 1) + 2 * getLum(x, y + 1) + getLum(x + 1, y + 1);
                const edge = Math.min(255, Math.sqrt(gx * gx + gy * gy) * strength);
                const i = (y * w + x) * 4;
                // Blend edge with original
                d[i] = Math.min(255, copy[i] * 0.5 + edge * 0.5);
                d[i + 1] = Math.min(255, copy[i + 1] * 0.5 + edge * 0.5);
                d[i + 2] = Math.min(255, copy[i + 2] * 0.5 + edge * 0.5);
            }
        }
        return imageData;
    }

    // --- Main Render ---
    function renderWebcamFrame() {
        if (webcamVideo.readyState < 2) return;

        const width = parseInt(document.getElementById('wcCharacters').value) || 75;
        const palette = document.getElementById('wcPalette').value;
        const charset = WC_PALETTES[palette] || WC_PALETTES.medium;
        const colorMode = document.getElementById('wcColorMode').value;
        const effect = document.getElementById('wcEffect').value;

        // CSS filter string (brightness & contrast only)
        const brightness = document.getElementById('wcBrightness').value;
        const contrast = document.getElementById('wcContrast').value;

        const vw = webcamVideo.videoWidth;
        const vh = webcamVideo.videoHeight;
        if (!vw || !vh) return;

        const height = Math.floor(width * (vh / vw) * 0.45);
        webcamCanvas.width = width;
        webcamCanvas.height = height;

        // Build CSS filter
        webcamCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

        // Draw with optional flip
        webcamCtx.save();
        if (wcFlipped) {
            webcamCtx.scale(-1, 1);
            webcamCtx.drawImage(webcamVideo, -width, 0, width, height);
        } else {
            webcamCtx.drawImage(webcamVideo, 0, 0, width, height);
        }
        webcamCtx.restore();
        webcamCtx.filter = 'none';

        let imageData = webcamCtx.getImageData(0, 0, width, height);

        // Apply effect
        if (effect !== 'none') imageData = applyEffect(imageData, effect, width, height);

        // Put processed data back
        webcamCtx.putImageData(imageData, 0, 0);

        const pixels = imageData.data;
        const isColored = (colorMode === 'fullcolor' || colorMode === 'grayscale');

        if (isColored) {
            // Render with color spans
            let html = '';
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const idx = (row * width + col) * 4;
                    const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    const ch = pixelToChar(lum, charset);
                    const displayCh = ch === ' ' ? '&nbsp;' : escapeHtml(ch);

                    if (colorMode === 'fullcolor') {
                        html += `<span style="color:rgb(${r},${g},${b})">${displayCh}</span>`;
                    } else {
                        const gray = Math.round(lum);
                        html += `<span style="color:rgb(${gray},${gray},${gray})">${displayCh}</span>`;
                    }
                }
                html += '\n';
            }
            wcLastHtml = html;
            webcamResult.innerHTML = html;
        } else {
            // Plain text - use theme class
            let result = '';
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const idx = (row * width + col) * 4;
                    const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
                    result += pixelToChar(lum, charset);
                }
                result += '\n';
            }
            wcLastHtml = '';
            webcamResult.textContent = result;
        }

        wcLastText = webcamResult.textContent;

        // Apply theme class
        webcamResult.className = 'wc-ascii-fullscreen';
        const themeMap = {
            blackwhite: 'wc-theme-blackwhite',
            whiteblack: 'wc-theme-whiteblack',
            commodore: 'wc-theme-commodore',
            dosblue: 'wc-theme-dosblue',
            amber: 'wc-theme-amber',
            green: 'wc-theme-green',
            neonpink: 'wc-theme-neonpink',
            retroorange: 'wc-theme-retroorange'
        };
        if (themeMap[colorMode]) {
            webcamResult.classList.add(themeMap[colorMode]);
        }
    }

    // --- Flip ---
    document.getElementById('flipWebcam').addEventListener('click', () => {
        wcFlipped = !wcFlipped;
        showToast(wcFlipped ? 'Mirrored' : 'Normal');
    });

    // --- Screenshot (export as PNG) ---
    document.getElementById('screenshotWebcam').addEventListener('click', () => {
        // Create a canvas from the ASCII output
        const pre = webcamResult;
        const fontSize = parseInt(document.getElementById('wcFontSize').value) || 10;
        const lines = (pre.textContent || '').split('\n').filter(l => l.length > 0);
        if (lines.length === 0) { showToast('Nothing to screenshot!', 'error'); return; }

        const charW = fontSize * 0.6;
        const charH = fontSize * 1.15;
        const maxCols = Math.max(...lines.map(l => l.length));
        const canvasW = Math.ceil(maxCols * charW) + 20;
        const canvasH = Math.ceil(lines.length * charH) + 20;

        const ssCanvas = document.createElement('canvas');
        ssCanvas.width = canvasW;
        ssCanvas.height = canvasH;
        const ctx = ssCanvas.getContext('2d');

        // Background
        const bgColors = {
            blackwhite: '#ffffff', whiteblack: '#000000', dosblue: '#0000AA',
            commodore: '#40318D', amber: '#1a0800', green: '#001100',
            neonpink: '#1a0018', retroorange: '#1a0a00'
        };
        const colorMode = document.getElementById('wcColorMode').value;
        ctx.fillStyle = bgColors[colorMode] || '#0a0e27';
        ctx.fillRect(0, 0, canvasW, canvasH);

        ctx.font = `${fontSize}px "Courier New", monospace`;
        ctx.textBaseline = 'top';

        if (wcLastHtml && (colorMode === 'fullcolor' || colorMode === 'grayscale')) {
            // Parse color info from the canvas pixel data
            const charset = WC_PALETTES[document.getElementById('wcPalette').value] || WC_PALETTES.medium;
            const imgData = webcamCtx.getImageData(0, 0, webcamCanvas.width, webcamCanvas.height);
            const pixels = imgData.data;
            const w = webcamCanvas.width, h = webcamCanvas.height;
            let row = 0;
            for (let y = 0; y < h; y++) {
                let col = 0;
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    if (colorMode === 'fullcolor') {
                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                    } else {
                        const gray = Math.round(lum);
                        ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
                    }
                    const ch = pixelToChar(lum, charset);
                    ctx.fillText(ch, 10 + col * charW, 10 + row * charH);
                    col++;
                }
                row++;
            }
        } else {
            const textColors = {
                blackwhite: '#000000', whiteblack: '#ffffff', dosblue: '#AAAAAA',
                commodore: '#7B71D5', amber: '#FFB000', green: '#33FF00',
                neonpink: '#FF00FF', retroorange: '#FF6600'
            };
            ctx.fillStyle = textColors[colorMode] || '#00d4ff';
            lines.forEach((line, i) => {
                ctx.fillText(line, 10, 10 + i * charH);
            });
        }

        ssCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ascii-webcam-screenshot.png';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Screenshot saved!');
        });
    });

    // --- Copy ---
    document.getElementById('copyWebcam').addEventListener('click', () => {
        if (!wcLastText.trim()) { showToast('Nothing to copy!', 'error'); return; }
        copyToClipboard(wcLastText);
    });

    // --- Fullscreen ---
    document.getElementById('wcFullscreen').addEventListener('click', () => {
        const area = document.getElementById('webcamOutputArea');
        if (area.classList.contains('wc-fullscreen')) {
            area.classList.remove('wc-fullscreen');
            if (document.exitFullscreen) document.exitFullscreen();
        } else {
            area.classList.add('wc-fullscreen');
            if (area.requestFullscreen) area.requestFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.getElementById('webcamOutputArea').classList.remove('wc-fullscreen');
        }
    });

    // --- Export ---
    document.getElementById('wcExport').addEventListener('change', function () {
        const format = this.value;
        this.selectedIndex = 0; // reset to placeholder

        if (!wcLastText.trim()) { showToast('Nothing to export!', 'error'); return; }

        if (format === 'text') {
            downloadText('ascii-webcam.txt', wcLastText);
            showToast('Exported as text!');
        } else if (format === 'html') {
            const colorMode = document.getElementById('wcColorMode').value;
            const fontSize = document.getElementById('wcFontSize').value;
            const bgColors = {
                blackwhite: '#ffffff', whiteblack: '#000000', dosblue: '#0000AA',
                commodore: '#40318D', amber: '#1a0800', green: '#001100',
                neonpink: '#1a0018', retroorange: '#1a0a00'
            };
            const bg = bgColors[colorMode] || '#0a0e27';
            const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>ASCII Webcam Export</title>
<style>body{margin:0;padding:20px;background:${bg};font-family:'Courier New',monospace;}
pre{font-size:${fontSize}px;line-height:1.1;white-space:pre;}</style></head>
<body><pre>${wcLastHtml || escapeHtml(wcLastText)}</pre></body></html>`;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'ascii-webcam.html'; a.click();
            URL.revokeObjectURL(url);
            showToast('Exported as HTML!');
        } else if (format === 'image') {
            // Trigger screenshot
            document.getElementById('screenshotWebcam').click();
        }
    });

    // --- Reset Filters ---
    document.getElementById('wcResetFilters').addEventListener('click', () => {
        const defaults = {
            wcBrightness: 100, wcContrast: 100, wcCharacters: 130, wcFontSize: 10
        };
        for (const [id, val] of Object.entries(defaults)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }
        document.getElementById('wcEffect').value = 'none';
        document.getElementById('wcColorMode').value = 'fullcolor';
        document.getElementById('wcPalette').value = 'medium';
        webcamResult.style.fontSize = '10px';

        // Update display values
        wcSliders.forEach(([id, valId, suffix]) => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(valId);
            if (el && valEl) {
                if (id === 'wcBrightness' || id === 'wcContrast') {
                    valEl.textContent = (el.value / 100).toFixed(1);
                } else {
                    valEl.textContent = el.value + suffix;
                }
            }
        });

        showToast('Filters reset!');
    });

    // ========================================================
    //   ASCII LIBRARY
    // ========================================================

    const BUILT_IN_LIBRARY = [
        {
            id: 'builtin-cat', name: 'Cat', category: 'animals',
            art: `  /\\_____/\\
 /  o   o  \\
( ==  ^  == )
 )         (
(           )
 \\         /
  )       (
 /         \\
  \\_|\\_/|_/`
        },
        {
            id: 'builtin-dog', name: 'Dog', category: 'animals',
            art: `  / \\__
 (    @\\___
 /         O
/   (_____/
/_____/   U`
        },
        {
            id: 'builtin-rabbit', name: 'Rabbit', category: 'animals',
            art: `  (\\ /)
  ( . .)
 C(") (")`
        },
        {
            id: 'builtin-fish', name: 'Fish', category: 'animals',
            art: `    ><>
   / ><>
  /   ><>
><>         ><>
  \\   ><>
   \\ ><>
    ><>`
        },
        {
            id: 'builtin-bear', name: 'Bear', category: 'animals',
            art: `  (•‿•)
  /|oo|\\
 (_|  |_)
   |  |
  /|  |\\
 /_\\  /_\\`
        },
        {
            id: 'builtin-owl', name: 'Owl', category: 'animals',
            art: `  ,_,
 (O,O)
 (   )
 -"-"-`
        },
        {
            id: 'builtin-pc', name: 'Computer', category: 'objects',
            art: `  ___________
 |           |
 |  [=====]  |
 |    ___    |
 |   |   |  |
 |___|___|__|
      | |
  ____|_|____
 |___________|`
        },
        {
            id: 'builtin-rocket', name: 'Rocket', category: 'objects',
            art: `    /\\
   /  \\
  /----\\
 / [  ] \\
|  [  ]  |
 \\ [  ] /
  \\----/
  / || \\
 /  ||  \\`
        },
        {
            id: 'builtin-house', name: 'House', category: 'objects',
            art: `      /\\
     /  \\
    / /\\ \\
   /_/  \\_\\
  |  |--|  |
  |  |  |  |
  |__|__|__|`
        },
        {
            id: 'builtin-coffee', name: 'Coffee Cup', category: 'objects',
            art: `  ) ) )
 ( ( (
+-------+
|  : :  |
|  : :  |
+-------+
 \\_____/`
        },
        {
            id: 'builtin-stars', name: 'Stars & Banner', category: 'decorations',
            art: `  *    .  *     .   *
     .    *  .
.  *    .    *   .
 ╔═════════════╗
 ║  ASCII ART  ║
 ╚═════════════╝
*   .   *    .   *`
        },
        {
            id: 'builtin-border', name: 'Fancy Border', category: 'decorations',
            art: `╔══════════════════╗
║                  ║
║   Your Text      ║
║   Goes Here      ║
║                  ║
╚══════════════════╝`
        },
        {
            id: 'builtin-heart', name: 'Heart', category: 'decorations',
            art: `  ##   ##
 #### ####
##########
 ########
  ######
   ####
    ##`
        },
        {
            id: 'builtin-tree', name: 'Christmas Tree', category: 'decorations',
            art: `    *
   /|\\
  / | \\
 /  |  \\
----+----
   /|\\
  / | \\
 /  |  \\
---------
   [  ]`
        },
        {
            id: 'builtin-skull', name: 'Skull', category: 'decorations',
            art: `  ___
 /   \\
| () () |
 \\ ^  /
  |||||
  |||||`
        },
        {
            id: 'builtin-sun', name: 'Sun', category: 'decorations',
            art: `    \\   |   /
      \\ | /
  --( O O )--
      / | \\
    /   |   \\`
        },
    ];

    let customLibrary = JSON.parse(localStorage.getItem('ascii_custom_library') || '[]');
    let allLibrary = [...BUILT_IN_LIBRARY, ...customLibrary];

    function renderLibrary(items) {
        const container = document.getElementById('libraryItems');
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);padding:20px;">No items found.</p>';
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'library-item';
            el.innerHTML = `
                <div class="library-item-name">${escapeHtml(item.name)}</div>
                <div class="library-item-category">${item.category}</div>
                <pre class="library-item-content">${escapeHtml(item.art)}</pre>
                <div class="library-item-actions">
                    <button class="btn btn-primary" data-id="${item.id}" data-action="copy">Copy</button>
                    <button class="btn btn-success" data-id="${item.id}" data-action="download">Download</button>
                    ${item.id.startsWith('custom-') ? `<button class="btn" data-id="${item.id}" data-action="delete" style="background:var(--danger);color:#fff;">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(el);
        });

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = allLibrary.find(i => i.id === btn.dataset.id);
                if (!item) return;

                if (btn.dataset.action === 'copy') {
                    copyToClipboard(item.art);
                } else if (btn.dataset.action === 'download') {
                    downloadText(`${item.name.toLowerCase().replace(/\s+/g, '-')}.txt`, item.art);
                    showToast('Downloaded!');
                } else if (btn.dataset.action === 'delete') {
                    customLibrary = customLibrary.filter(i => i.id !== item.id);
                    localStorage.setItem('ascii_custom_library', JSON.stringify(customLibrary));
                    allLibrary = [...BUILT_IN_LIBRARY, ...customLibrary];
                    applyLibraryFilters();
                    showToast('Deleted!');
                }
            });
        });
    }

    function applyLibraryFilters() {
        const query = document.getElementById('searchLibrary').value.trim().toLowerCase();
        const category = document.getElementById('filterCategory').value;
        let filtered = allLibrary;
        if (query) filtered = filtered.filter(i => i.name.toLowerCase().includes(query) || i.category.toLowerCase().includes(query));
        if (category) filtered = filtered.filter(i => i.category === category);
        renderLibrary(filtered);
    }

    document.getElementById('searchLibrary').addEventListener('input', applyLibraryFilters);
    document.getElementById('filterCategory').addEventListener('change', applyLibraryFilters);

    document.getElementById('saveCustom').addEventListener('click', () => {
        const name = document.getElementById('customName').value.trim();
        const art = document.getElementById('customArt').value.trim();
        const category = document.getElementById('customCategory').value;

        if (!name) { showToast('Please enter a name.', 'error'); return; }
        if (!art) { showToast('Please enter some ASCII art.', 'error'); return; }

        const newItem = { id: 'custom-' + Date.now(), name, category, art };
        customLibrary.push(newItem);
        localStorage.setItem('ascii_custom_library', JSON.stringify(customLibrary));
        allLibrary = [...BUILT_IN_LIBRARY, ...customLibrary];

        document.getElementById('customName').value = '';
        document.getElementById('customArt').value = '';
        applyLibraryFilters();
        showToast('Saved to library!');
    });

    // ─── INIT ───────────────────────────────────
    renderLibrary(allLibrary);

})();
