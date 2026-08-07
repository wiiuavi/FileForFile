let allFormats = [];
let detailsVisible = false;

async function initializeApp() {
    if (window.eel) {
        allFormats = await eel.getFileFormats()();
    } else {
        allFormats = [
            {title: "PDF", description: ""},
            {title: "MP3", description: ""},
            {title: "DOCX", description: ""}
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

document.getElementById('searchInput').addEventListener('input', handleSearch);
document.getElementById('toggleDetailsBtn').addEventListener('click', toggleDetails);

initializeApp();