let allFormats = [];
let detailsVisible = false;
let currentSelectedFiles = [];
let possibleConvertTargets = [];
let selectedTargetFormat = "";
let customSaveFolderPath = "";
let systemDownloadsPath = "";
let scriptFolderPath = "";
let startupFilePollTimer = null;
let lastStartupFileSignature = "";

let activeTool = "eyedropper";
let imageToolsCanvas = null;
let imageToolsContext = null;
let overlayCanvas = null;
let overlayContext = null;
let originalImageObject = null;
let isDrawingState = false;
let startXCoordinate = 0;
let startYCoordinate = 0;
let cropBoxSelection = null;

async function initializeApp() {
    if (window.eel) {
        allFormats = await eel.getFileFormats()();
        systemDownloadsPath = await eel.getDownloadsPath()();
        scriptFolderPath = await eel.getScriptPath()();
    } else {
        allFormats = [
            {title: "PDF", description: "Portable Document Format"},
            {title: "MP3", description: "Standard audio file"},
            {title: "DOCX", description: "Word document"}
        ];
    }
    
    const savedTheme = localStorage.getItem('themeSelectPref');
    if (savedTheme) {
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.value = savedTheme;
        if (savedTheme === 'light') {
            document.body.classList.add('lightTheme');
        } else {
            document.body.classList.remove('lightTheme');
        }
    }
    
    const savedLoc = localStorage.getItem('saveLocationPref');
    if (savedLoc) {
        const saveLocationSelect = document.getElementById('saveLocationSelect');
        if (saveLocationSelect) saveLocationSelect.value = savedLoc;
    }
    
    const savedCustomPath = localStorage.getItem('customSaveFolderPathPref');
    if (savedCustomPath) {
        customSaveFolderPath = savedCustomPath;
    }
    
    const savedBg = localStorage.getItem('backgroundModePref') || 'no';
    const bgModeSelect = document.getElementById('backgroundModeSelect');
    if (bgModeSelect) bgModeSelect.value = savedBg;
    if (window.eel) eel.setBackgroundMode(savedBg === 'yes');

    const savedCtx = localStorage.getItem('contextMenuPref') || 'no';
    const ctxMenuSelect = document.getElementById('contextMenuSelect');
    if (ctxMenuSelect) ctxMenuSelect.value = savedCtx;
    if (window.eel) {
        try {
            await eel.toggleRegistryContextMenu(savedCtx === 'yes')();
        } catch (err) {
            console.warn('Failed to reapply saved context-menu preference:', err);
        }
    }

    renderGrid(allFormats);
    updatePathDisplay();
    setupImageTools();

    if (window.eel) {
        const startupFiles = await eel.getStartupFiles()();
        if (startupFiles && startupFiles.length > 0) {
            hideAllViews();
            document.getElementById('convertView').classList.remove('hidden');
            await processSelectedFiles(startupFiles);
        }

        if (!startupFilePollTimer) {
            startupFilePollTimer = setInterval(async () => {
                try {
                    const queuedFiles = await eel.getStartupFiles()();
                    const signature = queuedFiles && queuedFiles.length > 0 ? queuedFiles.join('|') : "";
                    if (signature && signature !== lastStartupFileSignature) {
                        lastStartupFileSignature = signature;
                        hideAllViews();
                        document.getElementById('convertView').classList.remove('hidden');
                        await processSelectedFiles(queuedFiles);
                        await eel.clearStartupFiles()();
                        lastStartupFileSignature = "";
                    }
                } catch (err) {
                    console.warn('Startup file poll failed:', err);
                }
            }, 1000);
        }
    }
}

function updatePathDisplay() {
    const pathDisplay = document.getElementById('saveLocationPath');
    const convertPathDisplay = document.getElementById('convertSavePathText');
    const val = document.getElementById('saveLocationSelect') ? document.getElementById('saveLocationSelect').value : 'downloads';
    
    let pathString = "";
    if (val === 'downloads') {
        pathString = systemDownloadsPath;
    } else if (val === 'scriptFolder') {
        pathString = scriptFolderPath;
    } else if (val === 'customFolder') {
        pathString = customSaveFolderPath || "No folder selected";
    }
    
    if (pathDisplay) {
        pathDisplay.textContent = pathString;
    }
    if (convertPathDisplay) {
        convertPathDisplay.textContent = "Files will be saved to: " + pathString;
    }
}

function renderGrid(dataToRender) {
    const gridElement = document.getElementById('formatGrid');
    if (!gridElement) return;
    gridElement.innerHTML = '';
    
    if (detailsVisible) {
        gridElement.classList.add('formatGridExpanded');
    } else {
        gridElement.classList.remove('formatGridExpanded');
    }
    
    dataToRender.forEach(formatObj => {
        const card = document.createElement('div');
        let cardClass = 'formatCard';
        if (detailsVisible) {
            cardClass += ' formatCardExpanded';
        }
        card.className = cardClass;
        card.addEventListener('click', () => loadFormatInfo(formatObj.title));
        
        const title = document.createElement('div');
        title.className = 'cardTitle';
        title.textContent = formatObj.title;
        
        const description = document.createElement('div');
        let descClass = 'cardDescription';
        if (detailsVisible) {
            descClass += ' cardDescriptionVisible cardDescriptionTruncate';
        }
        description.className = descClass;
        description.textContent = formatObj.description;
        
        card.appendChild(title);
        card.appendChild(description);
        gridElement.appendChild(card);
    });
}

async function loadFormatInfo(formatTitle) {
    hideAllViews();
    document.getElementById('infoView').classList.remove('hidden');
    
    const formatObj = allFormats.find(f => f.title === formatTitle);
    document.getElementById('infoTitle').textContent = formatTitle;
    document.getElementById('infoDesc').textContent = formatObj ? formatObj.description : "No description available.";
    
    let convertFrom = [];
    let convertTo = [];
    
    if (window.eel) {
        convertFrom = await eel.getFormatsICanConvertFrom(formatTitle)();
        convertTo = await eel.getFormatsICanConvertTo(formatTitle)();
    }
    
    renderBubbles('convertFromList', convertFrom);
    renderBubbles('convertToList', convertTo);
}

function renderBubbles(containerId, formatList) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (formatList.length === 0) {
        container.innerHTML = '<div style="color: #666;">None</div>';
        return;
    }
    
    formatList.forEach(fmt => {
        const bubble = document.createElement('div');
        bubble.className = 'formatBubble';
        bubble.textContent = fmt.toUpperCase();
        bubble.addEventListener('click', () => loadFormatInfo(fmt.toUpperCase()));
        container.appendChild(bubble);
    });
}

function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    const searchTerm = searchInput.value.toLowerCase();
    const filteredData = allFormats.filter(formatObj => {
        const titleMatch = formatObj.title.toLowerCase().includes(searchTerm);
        const descMatch = formatObj.description.toLowerCase().includes(searchTerm);
        return titleMatch || descMatch;
    });
    renderGrid(filteredData);
}

function toggleDetails() {
    detailsVisible = !detailsVisible;
    const btn = document.getElementById('toggleDetailsBtn');
    if (btn) {
        if (detailsVisible) {
            btn.textContent = 'Hide Details';
        } else {
            btn.textContent = 'Show Details';
        }
    }
    handleSearch();
}

function hideAllViews() {
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('infoView').classList.add('hidden');
    document.getElementById('convertView').classList.add('hidden');
    document.getElementById('imageToolsView').classList.add('hidden');
    document.getElementById('otherView').classList.add('hidden');
}

function showMainView() {
    hideAllViews();
    document.getElementById('mainView').classList.remove('hidden');
}

const searchInput = document.getElementById('searchInput');
if (searchInput) searchInput.addEventListener('input', handleSearch);

const toggleDetailsBtn = document.getElementById('toggleDetailsBtn');
if (toggleDetailsBtn) toggleDetailsBtn.addEventListener('click', toggleDetails);

const backBtn = document.getElementById('backBtn');
if (backBtn) backBtn.addEventListener('click', showMainView);

const navConversionsBtn = document.getElementById('navConversions');
if (navConversionsBtn) {
    navConversionsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showMainView();
    });
}

const navConvertBtn = document.getElementById('navConvert');
if (navConvertBtn) {
    navConvertBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        document.getElementById('convertView').classList.remove('hidden');
    });
}

const navImageToolsBtn = document.getElementById('navImageTools');
if (navImageToolsBtn) {
    navImageToolsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        document.getElementById('imageToolsView').classList.remove('hidden');
    });
}

const navOtherBtn = document.getElementById('navOther');
if (navOtherBtn) {
    navOtherBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        document.getElementById('otherView').classList.remove('hidden');
    });
}

const selectFilesBtn = document.getElementById('selectFilesText');
if (selectFilesBtn) {
    selectFilesBtn.addEventListener('click', async () => {
        if (window.eel) {
            const filePaths = await eel.askForFiles()();
            if (filePaths && filePaths.length > 0) {
                processSelectedFiles(filePaths);
            }
        }
    });
}

async function processSelectedFiles(paths) {
    if (paths.length === 0) return;
    
    let commonTargets = null;
    for (let path of paths) {
        let ext = path.split('.').pop().toLowerCase();
        let targetsForFile = [];
        if (window.eel) {
            targetsForFile = await eel.getFormatsICanConvertTo(ext)();
        }
        if (commonTargets === null) {
            commonTargets = targetsForFile;
        } else {
            commonTargets = commonTargets.filter(fmt => targetsForFile.includes(fmt));
        }
    }

    if (!commonTargets || commonTargets.length === 0) {
        alert("no common file type to convert to");
        return;
    }

    currentSelectedFiles = paths;
    selectedTargetFormat = "";
    
    const listElement = document.getElementById('selectedFilesList');
    if (listElement) {
        listElement.innerHTML = '';
        paths.forEach(p => {
            let name = p.split('\\').pop().split('/').pop();
            let el = document.createElement('div');
            el.className = 'fileItem';
            el.textContent = name;
            listElement.appendChild(el);
        });
    }

    possibleConvertTargets = allFormats.filter(f => commonTargets.includes(f.title.toLowerCase()));
    renderConvertTargets(possibleConvertTargets);
}

function renderConvertTargets(targetsToRender) {
    const container = document.getElementById('convertTargetList');
    if (!container) return;
    container.innerHTML = '';
    
    targetsToRender.forEach(fmt => {
        const bubble = document.createElement('div');
        let bubbleClass = 'formatBubble';
        if (selectedTargetFormat === fmt.title) {
            bubbleClass += ' formatBubbleSelected';
        }
        bubble.className = bubbleClass;
        bubble.textContent = fmt.title;
        bubble.addEventListener('click', () => {
            selectedTargetFormat = fmt.title;
            renderConvertTargets(targetsToRender);
        });
        container.appendChild(bubble);
    });
}

const convertSearchInput = document.getElementById('convertSearchInput');
if (convertSearchInput) {
    convertSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        let filtered = possibleConvertTargets.filter(fmt => {
            const titleMatch = fmt.title.toLowerCase().includes(term);
            const descMatch = fmt.description.toLowerCase().includes(term);
            return titleMatch || descMatch;
        });
        filtered.sort((a, b) => {
            const aTitleMatch = a.title.toLowerCase().includes(term) ? 1 : 0;
            const bTitleMatch = b.title.toLowerCase().includes(term) ? 1 : 0;
            return bTitleMatch - aTitleMatch;
        });
        renderConvertTargets(filtered);
    });
}

const executeConvertBtn = document.getElementById('executeConvertBtn');
if (executeConvertBtn) {
    executeConvertBtn.addEventListener('click', async () => {
        if (currentSelectedFiles.length === 0) return;
        if (!selectedTargetFormat) return;
        
        const statusMsg = document.getElementById('convertStatusMessage');
        statusMsg.textContent = "converting...";
        statusMsg.className = "convertStatus statusConverting";
        
        if (window.eel) {
            const saveLocType = document.getElementById('saveLocationSelect').value;
            const result = await eel.executeConversion(currentSelectedFiles, selectedTargetFormat, saveLocType, customSaveFolderPath)();
            if (result.status === 'success') {
                statusMsg.textContent = result.message;
                statusMsg.className = "convertStatus statusSuccess";
            } else {
                statusMsg.textContent = "Failed: " + result.message;
                statusMsg.className = "convertStatus statusError";
            }
        }
    });
}

const dropZone = document.getElementById('dropZone');
if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#66b3ff';
    });
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#444';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#444';
        let paths = Array.from(e.dataTransfer.files).map(f => f.name);
        processSelectedFiles(paths);
    });
}

const themeSelect = document.getElementById('themeSelect');
if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
        localStorage.setItem('themeSelectPref', e.target.value);
        if (e.target.value === 'light') {
            document.body.classList.add('lightTheme');
        } else {
            document.body.classList.remove('lightTheme');
        }
    });
}

const saveLocationSelect = document.getElementById('saveLocationSelect');
if (saveLocationSelect) {
    saveLocationSelect.addEventListener('change', async (e) => {
        if (e.target.value === 'customFolder') {
            if (window.eel) {
                const folder = await eel.askForFolder()();
                if (folder) {
                    customSaveFolderPath = folder;
                    localStorage.setItem('customSaveFolderPathPref', folder);
                    localStorage.setItem('saveLocationPref', e.target.value);
                } else {
                    saveLocationSelect.value = localStorage.getItem('saveLocationPref') || 'downloads';
                }
            }
        } else {
            localStorage.setItem('saveLocationPref', e.target.value);
        }
        updatePathDisplay();
    });
}

const backgroundModeSelect = document.getElementById('backgroundModeSelect');
if (backgroundModeSelect) {
    backgroundModeSelect.addEventListener('change', (e) => {
        localStorage.setItem('backgroundModePref', e.target.value);
        if (window.eel) eel.setBackgroundMode(e.target.value === 'yes');
    });
}

const contextMenuSelect = document.getElementById('contextMenuSelect');
const settingsStatusMessage = document.getElementById('settingsStatusMessage');
if (contextMenuSelect) {
    contextMenuSelect.addEventListener('change', async (e) => {
        if (window.eel) {
            settingsStatusMessage.textContent = "Updating registry...";
            settingsStatusMessage.style.color = "#ffaa00";
            
            const result = await eel.toggleRegistryContextMenu(e.target.value === 'yes')();
            const success = result[0];
            const errMsg = result[1];
            
            if (success) {
                localStorage.setItem('contextMenuPref', e.target.value);
                settingsStatusMessage.textContent = "Registry updated successfully.";
                settingsStatusMessage.style.color = "#00dd55";
            } else {
                settingsStatusMessage.textContent = "Failed: " + errMsg;
                settingsStatusMessage.style.color = "#ff3333";
                contextMenuSelect.value = localStorage.getItem('contextMenuPref') || 'no';
            }
            setTimeout(() => { settingsStatusMessage.textContent = ""; }, 3000);
        }
    });
}

function setupImageTools() {
    imageToolsCanvas = document.getElementById('imageToolsCanvas');
    if (!imageToolsCanvas) return;
    imageToolsContext = imageToolsCanvas.getContext('2d');
    overlayCanvas = document.getElementById('overlayCanvas');
    overlayContext = overlayCanvas.getContext('2d');

    const selectImageBtn = document.getElementById('selectImageBtn');
    const imageFileInput = document.getElementById('imageFileInput');
    if (selectImageBtn && imageFileInput) {
        selectImageBtn.addEventListener('click', () => imageFileInput.click());
        imageFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                loadImageFromFile(e.target.files[0]);
            }
        });
    }

    const pasteClipboardBtn = document.getElementById('pasteClipboardBtn');
    if (pasteClipboardBtn) {
        pasteClipboardBtn.addEventListener('click', handleClipboardPaste);
    }
    window.addEventListener('paste', handleClipboardPaste);

    const toolEyedropperBtn = document.getElementById('toolEyedropperBtn');
    const toolDrawRectBtn = document.getElementById('toolDrawRectBtn');
    const toolCropBtn = document.getElementById('toolCropBtn');

    if (toolEyedropperBtn) toolEyedropperBtn.addEventListener('click', () => setActiveTool('eyedropper'));
    if (toolDrawRectBtn) toolDrawRectBtn.addEventListener('click', () => setActiveTool('rectangle'));
    if (toolCropBtn) toolCropBtn.addEventListener('click', () => setActiveTool('crop'));

    const toleranceRange = document.getElementById('toleranceRange');
    const toleranceValDisplay = document.getElementById('toleranceValDisplay');
    if (toleranceRange && toleranceValDisplay) {
        toleranceRange.addEventListener('input', (e) => {
            toleranceValDisplay.textContent = e.target.value;
        });
    }

    const applyRemoveColorBtn = document.getElementById('applyRemoveColorBtn');
    if (applyRemoveColorBtn) {
        applyRemoveColorBtn.addEventListener('click', removeColorTransparency);
    }

    const applyCropBtn = document.getElementById('applyCropBtn');
    if (applyCropBtn) {
        applyCropBtn.addEventListener('click', applyCropSelection);
    }

    const resetImageBtn = document.getElementById('resetImageBtn');
    if (resetImageBtn) {
        resetImageBtn.addEventListener('click', resetCanvasImage);
    }

    const saveCanvasBtn = document.getElementById('saveCanvasBtn');
    if (saveCanvasBtn) {
        saveCanvasBtn.addEventListener('click', saveCanvasImage);
    }

    overlayCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    overlayCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    overlayCanvas.addEventListener('mouseup', handleCanvasMouseUp);

    setActiveTool('eyedropper');
}

function setActiveTool(toolName) {
    activeTool = toolName;
    const toolEyedropperBtn = document.getElementById('toolEyedropperBtn');
    const toolDrawRectBtn = document.getElementById('toolDrawRectBtn');
    const toolCropBtn = document.getElementById('toolCropBtn');

    if (toolEyedropperBtn) toolEyedropperBtn.classList.remove('activeToolBtn');
    if (toolDrawRectBtn) toolDrawRectBtn.classList.remove('activeToolBtn');
    if (toolCropBtn) toolCropBtn.classList.remove('activeToolBtn');

    const transparencyOptions = document.getElementById('transparencyOptions');
    const rectOptions = document.getElementById('rectOptions');
    const cropOptions = document.getElementById('cropOptions');

    if (transparencyOptions) transparencyOptions.classList.add('hidden');
    if (rectOptions) rectOptions.classList.add('hidden');
    if (cropOptions) cropOptions.classList.add('hidden');

    if (toolName === 'eyedropper') {
        if (toolEyedropperBtn) toolEyedropperBtn.classList.add('activeToolBtn');
        if (transparencyOptions) transparencyOptions.classList.remove('hidden');
    } else if (toolName === 'rectangle') {
        if (toolDrawRectBtn) toolDrawRectBtn.classList.add('activeToolBtn');
        if (rectOptions) rectOptions.classList.remove('hidden');
    } else if (toolName === 'crop') {
        if (toolCropBtn) toolCropBtn.classList.add('activeToolBtn');
        if (cropOptions) cropOptions.classList.remove('hidden');
    }
    clearOverlayCanvas();
}

function loadImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            originalImageObject = img;
            renderImageToCanvas(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function renderImageToCanvas(img) {
    imageToolsCanvas.width = img.width;
    imageToolsCanvas.height = img.height;
    overlayCanvas.width = img.width;
    overlayCanvas.height = img.height;
    
    imageToolsContext.clearRect(0, 0, img.width, img.height);
    imageToolsContext.drawImage(img, 0, 0);
    clearOverlayCanvas();
}

function removeColorTransparency() {
    if (!imageToolsCanvas.width) return;
    const colorHex = document.getElementById('removeColorPicker').value;
    const tolerance = parseInt(document.getElementById('toleranceRange').value, 10);
    
    const targetR = parseInt(colorHex.slice(1, 3), 16);
    const targetG = parseInt(colorHex.slice(3, 5), 16);
    const targetB = parseInt(colorHex.slice(5, 7), 16);

    const imgData = imageToolsContext.getImageData(0, 0, imageToolsCanvas.width, imageToolsCanvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
        if (diff <= tolerance) {
            data[i + 3] = 0;
        }
    }
    imageToolsContext.putImageData(imgData, 0, 0);
}

function handleCanvasMouseDown(e) {
    if (!imageToolsCanvas.width) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;

    startXCoordinate = (e.clientX - rect.left) * scaleX;
    startYCoordinate = (e.clientY - rect.top) * scaleY;
    isDrawingState = true;

    if (activeTool === 'eyedropper') {
        const pixel = imageToolsContext.getImageData(Math.floor(startXCoordinate), Math.floor(startYCoordinate), 1, 1).data;
        const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
        document.getElementById('removeColorPicker').value = hex;
        isDrawingState = false;
    }
}

function handleCanvasMouseMove(e) {
    if (!isDrawingState) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    clearOverlayCanvas();

    if (activeTool === 'rectangle') {
        const color = document.getElementById('rectColorPicker').value;
        const mode = document.getElementById('rectModeSelect').value;
        const width = parseInt(document.getElementById('rectLineWidth').value, 10);

        overlayContext.strokeStyle = color;
        overlayContext.fillStyle = color;
        overlayContext.lineWidth = width;

        const rectX = Math.min(startXCoordinate, currentX);
        const rectY = Math.min(startYCoordinate, currentY);
        const rectW = Math.abs(currentX - startXCoordinate);
        const rectH = Math.abs(currentY - startYCoordinate);

        if (mode === 'stroke') {
            overlayContext.strokeRect(rectX, rectY, rectW, rectH);
        } else {
            overlayContext.fillRect(rectX, rectY, rectW, rectH);
        }
    } else if (activeTool === 'crop') {
        const rectX = Math.min(startXCoordinate, currentX);
        const rectY = Math.min(startYCoordinate, currentY);
        const rectW = Math.abs(currentX - startXCoordinate);
        const rectH = Math.abs(currentY - startYCoordinate);

        cropBoxSelection = { x: rectX, y: rectY, w: rectW, h: rectH };

        overlayContext.strokeStyle = "#00ffff";
        overlayContext.lineWidth = 2;
        overlayContext.setLineDash([6, 6]);
        overlayContext.strokeRect(rectX, rectY, rectW, rectH);
        overlayContext.setLineDash([]);
    }
}

function handleCanvasMouseUp(e) {
    if (!isDrawingState) return;
    isDrawingState = false;

    if (activeTool === 'rectangle') {
        imageToolsContext.drawImage(overlayCanvas, 0, 0);
        clearOverlayCanvas();
    }
}

function applyCropSelection() {
    if (!cropBoxSelection || cropBoxSelection.w === 0 || cropBoxSelection.h === 0) return;

    const croppedData = imageToolsContext.getImageData(
        Math.floor(cropBoxSelection.x),
        Math.floor(cropBoxSelection.y),
        Math.floor(cropBoxSelection.w),
        Math.floor(cropBoxSelection.h)
    );

    imageToolsCanvas.width = cropBoxSelection.w;
    imageToolsCanvas.height = cropBoxSelection.h;
    overlayCanvas.width = cropBoxSelection.w;
    overlayCanvas.height = cropBoxSelection.h;

    imageToolsContext.putImageData(croppedData, 0, 0);
    cropBoxSelection = null;
    clearOverlayCanvas();
}

function handleClipboardPaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData || event.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf("image") === 0) {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    if (!imageToolsCanvas.width) {
                        originalImageObject = img;
                        renderImageToCanvas(img);
                    } else {
                        imageToolsContext.drawImage(img, 0, 0);
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
}

function clearOverlayCanvas() {
    if (overlayContext && overlayCanvas) {
        overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
}

function resetCanvasImage() {
    if (originalImageObject) {
        renderImageToCanvas(originalImageObject);
    }
}

async function saveCanvasImage() {
    if (!imageToolsCanvas.width) return;
    const dataUrl = imageToolsCanvas.toDataURL("image/png");
    const filename = "edited_image_" + Date.now() + ".png";

    if (window.eel) {
        const res = await eel.saveImageFromBase64(dataUrl, filename)();
        if (res[0]) {
            alert("Image saved successfully to Downloads!");
        } else {
            alert("Failed to save image: " + res[1]);
        }
    } else {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
    }
}

initializeApp();