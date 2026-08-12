let allFormats = [];
let detailsVisible = false;

async function initializeApp() {
    if (window.eel) {
        allFormats = await eel.getFileFormats()();
    } else {
        allFormats = [
            {title: "PDF", description: "Portable Document Format"},
            {title: "MP3", description: "Standard audio file"},
            {title: "DOCX", description: "Word document"}
        ];
    }
    renderGrid(allFormats);
}

function renderGrid(dataToRender) {
    const gridElement = document.getElementById('formatGrid');
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

function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
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
    if (detailsVisible) {
        btn.textContent = 'Hide Details';
    } else {
        btn.textContent = 'Show Details';
    }
    handleSearch();
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

function hideAllViews() {
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('infoView').classList.add('hidden');
    document.getElementById('convertView').classList.add('hidden');
    document.getElementById('otherView').classList.add('hidden');
}

function showMainView() {
    hideAllViews();
    document.getElementById('mainView').classList.remove('hidden');
}

document.getElementById('searchInput').addEventListener('input', handleSearch);
document.getElementById('toggleDetailsBtn').addEventListener('click', toggleDetails);
document.getElementById('backBtn').addEventListener('click', showMainView);
document.getElementById('navConversions').addEventListener('click', (e) => {
    e.preventDefault();
    showMainView();
});

let currentSelectedFiles = [];
let possibleConvertTargets = [];
let selectedTargetFormat = "";
let customSaveFolderPath = "";
let systemDownloadsPath = "";
let scriptFolderPath = "";

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
    
    renderGrid(allFormats);
    updatePathDisplay();
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

const navConvertBtn = document.getElementById('navConvert');
if (navConvertBtn) {
    navConvertBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        document.getElementById('convertView').classList.remove('hidden');
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

const selectFilesBtn = document.getElementById('selectFilesBtn') || document.getElementById('selectFilesText');
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
        if (currentSelectedFiles.length === 0) {
            alert("Please select files first.");
            return;
        }
        if (!selectedTargetFormat) {
            alert("Please select a format to convert to.");
            return;
        }
        
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

initializeApp();