import os
import re

css_path = "../upload-viewer/style.css"
js_path = "../upload-viewer/script.js"

with open(css_path, "a", encoding="utf-8") as f:
    f.write('''
.drop-zone {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    color: var(--text-secondary);
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    transition: var(--transition);
    cursor: pointer;
    background: rgba(0, 0, 0, 0.2);
    z-index: 10;
}

#drop-zone.hidden {
    opacity: 0;
    pointer-events: none;
}

.drop-zone:hover,
.drop-zone.drag-over {
    background: rgba(99, 102, 241, 0.05);
    border-color: var(--accent-color);
    color: var(--text-primary);
}
''')

with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

js_insert = '''
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const dropZone = document.getElementById('drop-zone');

uploadBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', handleUpload);

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
});

function handleUpload(e) {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
}

function handleFiles(files) {
    let loadedCount = 0;
    const totalCount = files.length;
    
    // 비우기 (기존 영상 무시하고 새로 올린 것만 순환)
    imagePool = [];
    currentImageIdx = -1;

    for (let i = 0; i < totalCount; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
            loadedCount++;
            continue;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePool.push(e.target.result);
            loadedCount++;
            
            // 모든 파일이 로드되었으면 첫번째 이미지 바로 시작
            if (loadedCount === totalCount && imagePool.length > 0) {
                dropZone.classList.add('hidden');
                
                // 첫번째 이미지 띄우면서 슬라이더 강제 시작
                switchToNextImage(); 
                if (!isAnimating) startStaticSlideTimer();
            }
        };
        reader.readAsDataURL(file);
    }
}

// 초기 로딩 시 폴더 안의 이미지(기본 JSON) 읽는 것도 다 비활성화해도 무관하나
// 일단 빈 배열로 시작하도록 image_list fetch 부분을 덮어써도 됩니다.
// 기존 DOMContentLoaded를 대체합니다.
window.addEventListener('DOMContentLoaded', () => {
    dropZone.classList.remove('hidden'); // 처음에 무조건 띄우기
});
'''

# We append the JS insertion to the end of script.js
with open(js_path, "w", encoding="utf-8") as f:
    f.write(js + "\n" + js_insert)

