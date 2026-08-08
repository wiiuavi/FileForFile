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
        
        // Add click listener to open the info page
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

// --- New Info Page Logic ---

async function loadFormatInfo(formatTitle) {
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('infoView').classList.remove('hidden');
    
    // Find description from loaded formats
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
        
        // Clicking a bubble loads its own info page
        bubble.addEventListener('click', () => loadFormatInfo(fmt.toUpperCase()));
        
        container.appendChild(bubble);
    });
}

function showMainView() {
    document.getElementById('infoView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
}

document.getElementById('searchInput').addEventListener('input', handleSearch);
document.getElementById('toggleDetailsBtn').addEventListener('click', toggleDetails);
document.getElementById('backBtn').addEventListener('click', showMainView);
document.getElementById('navConversions').addEventListener('click', (e) => {
    e.preventDefault();
    showMainView();
});

initializeApp();