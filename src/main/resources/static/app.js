// Riferimenti agli elementi principali del DOM
const searchInput = document.getElementById('search-input');
const suggestionsContainer = document.getElementById('suggestions-container');
const detailsCard = document.getElementById('stock-details-card');
const periodSelector = document.getElementById('period-selector');

// Stato globale e utilità
let priceChart = null; // Istanza di Chart.js per il grafico
let currentTicker = ''; // Ticker attualmente visualizzato
let searchTimeout;      // Per la funzione di debounce nella ricerca
let lastSuggestions = []; // Ultimi suggerimenti mostrati
const periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"]; // Periodi API

// Riferimenti Dark Mode
const darkModeToggle = document.getElementById('dark-mode-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

// ------------------------------------------------------------------
// --- GESTIONE TEMA (DARK MODE) ---
// ------------------------------------------------------------------

/**
 * Commuta la classe 'dark' sul <body> e aggiorna le icone.
 * Se un grafico esiste, lo aggiorna per riflettere i nuovi colori del tema.
 */
function toggleDarkMode(isDark) {
    document.body.classList.toggle('dark', isDark);
    if (sunIcon) sunIcon.classList.toggle('hidden', isDark);
    if (moonIcon) moonIcon.classList.toggle('hidden', !isDark);

    // Se stiamo visualizzando i dettagli di un titolo, aggiorniamo il grafico
    if (priceChart && initialStockData && initialStockData.simbolo) {
        const currentPeriodButton = document.querySelector('.period-button.active');
        const currentPeriod = currentPeriodButton ? currentPeriodButton.getAttribute('data-period') : '1d';

        // Distruggiamo e ricreiamo il grafico per applicare i nuovi colori di Chart.js
        updateChart(initialStockData, currentPeriod);
    }
}

/**
 * Determina il tema iniziale (salvato o di sistema) e imposta i listener per il bottone.
 */
function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    // Tema iniziale: usa quello salvato, altrimenti usa la preferenza di sistema
    let initialIsDark = savedTheme ? (savedTheme === 'dark') : prefersDark;

    toggleDarkMode(initialIsDark);

    // Listener per il bottone di cambio tema
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const newIsDark = !document.body.classList.contains('dark');
            toggleDarkMode(newIsDark);
            localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
        });
    }

    // Ascolta i cambiamenti di tema del sistema operativo (se non abbiamo un tema salvato)
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            toggleDarkMode(e.matches);
        }
    });
}

// ------------------------------------------------------------------
// --- GESTIONE RICERCA E SUGGERIMENTI ---
// ------------------------------------------------------------------

/**
 * Chiama l'API per ottenere i suggerimenti di ticker e nomi.
 */
async function fetchSuggestions(query) {
    try {
        const response = await fetch(`/suggest?query=${encodeURIComponent(query)}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Errore di rete: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        renderSuggestions(data.quotes);

    } catch (error) {
        console.error("Errore nel recupero suggerimenti:", error);
        suggestionsContainer.innerHTML = `<div class="p-3 text-red-500 text-center">Impossibile trovare suggerimenti: ${error.message}</div>`;
        suggestionsContainer.classList.remove('hidden');
    }
}

/**
 * Inietta i suggerimenti ricevuti dall'API nel container.
 */
function renderSuggestions(quotes) {
    suggestionsContainer.innerHTML = '';
    lastSuggestions = quotes.filter(q => q.symbol).slice(0, 10);

    if (lastSuggestions.length === 0) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    suggestionsContainer.classList.remove('hidden');

    lastSuggestions.forEach(item => {
        const symbol = item.symbol;
        const name = item.longname || item.shortname || 'Nome Sconosciuto';
        const exchange = item.exchange;

        const suggestionItem = document.createElement('div');
        // Usiamo una classe per gestire l'hover anche in Dark Mode nel CSS
        suggestionItem.className = 'suggestion-item p-3 border-b border-gray-100 last:border-b-0 flex justify-between items-center cursor-pointer transition duration-100';
        suggestionItem.innerHTML = `
            <div>
                <span class="font-bold text-gray-800">${symbol}</span>
                <span class="text-sm text-gray-600 ml-2">${name}</span>
            </div>
            <span class="text-xs text-gray-400">${exchange}</span>
        `;
        suggestionItem.addEventListener('click', () => {
            window.location.href = `/search?ticker=${symbol}`;
        });

        suggestionsContainer.appendChild(suggestionItem);
    });
}


/**
 * Gestisce l'input dell'utente con una logica di 'debounce' (ritardo)
 * per non sovraccaricare il server ad ogni tasto premuto.
 */
function handleSuggestions(event) {
    if (!suggestionsContainer || event.key === 'Enter') return;

    const query = searchInput.value.trim();
    suggestionsContainer.classList.add('hidden');
    clearTimeout(searchTimeout);

    if (query.length < 2) return;

    // Richiesta dopo 300ms di inattività
    searchTimeout = setTimeout(() => {
        fetchSuggestions(query);
    }, 300);
}

/**
 * Gestisce la pressione del tasto Invio: reindirizza al primo suggerimento
 * o usa il testo inserito se non ci sono suggerimenti.
 */
function handleSearchSubmit(event) {
    if (event.key === 'Enter') {
        event.preventDefault();

        const query = searchInput.value.trim();

        if (lastSuggestions.length > 0) {
            // Usa il primo suggerimento
            window.location.href = `/search?ticker=${lastSuggestions[0].symbol}`;
        } else if (query.length >= 1) {
            // Usa il testo inserito come ticker (presupponendo sia valido)
            window.location.href = `/search?ticker=${query.toUpperCase()}`;
        }
    }
}


// ------------------------------------------------------------------
// --- GESTIONE GRAFICO E DATI (DETTAGLI) ---
// ------------------------------------------------------------------

/**
 * Formatta l'etichetta dell'asse X del grafico in base al periodo selezionato.
 */
function formatChartLabel(timestampMs, period) {
    const date = new Date(timestampMs);
    let options = {};
    if (['1d', '5d'].includes(period)) {
        options = { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' };
    } else if (period !== 'max') {
        options = { day: 'numeric', month: 'short' };
    } else {
        options = { month: 'short', year: 'numeric' };
    }
    return date.toLocaleDateString('it-IT', options);
}

/**
 * Distrugge il grafico esistente e ne crea uno nuovo con i dati e lo stile aggiornati.
 */
function updateChart(stockData, period) {
    const datesMs = stockData.date.map(d => new Date(d).getTime());
    const closingPrices = stockData.chiusura;
    const ctx = document.getElementById('price-chart').getContext('2d');

    if (priceChart) priceChart.destroy();
    if (!ctx) return;

    if (!closingPrices || closingPrices.length === 0) {
         // Mostra un messaggio se i dati mancano
         ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
         ctx.font = "16px sans-serif";
         ctx.fillStyle = document.body.classList.contains('dark') ? '#94a3b8' : '#6b7280';
         ctx.textAlign = "center";
         ctx.fillText("Nessun dato storico disponibile per questo periodo.", ctx.canvas.width/2, ctx.canvas.height/2);
         priceChart = null;
         return;
    }

    const labels = datesMs.map(ms => formatChartLabel(ms, period));
    const initialPrice = closingPrices[0];
    const finalPrice = closingPrices[closingPrices.length - 1];
    const isPositive = finalPrice >= initialPrice;
    const lineColor = isPositive ? '#059669' : '#dc2626'; // Verde/Rosso
    const axesTextColor = document.body.classList.contains('dark') ? '#cbd5e1' : '#4b5563'; // Colore assi basato sul tema


    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Prezzo (${stockData.valuta})`,
                data: closingPrices,
                borderColor: lineColor,
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (context) => `Prezzo: ${context.parsed.y.toFixed(2)} ${stockData.valuta}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 10, color: axesTextColor }
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: (value) => value.toFixed(2) + ' ' + stockData.valuta,
                        color: axesTextColor
                    }
                }
            }
        }
    };

    priceChart = new Chart(ctx, chartConfig);
}


/**
 * Effettua la richiesta dei dati storici (dettagli) per un periodo specifico.
 */
async function fetchStockData(ticker, period) {
    const response = await fetch(`/search?ticker=${ticker}&range=${period}&dataType=json`);

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Errore di rete (${response.status}).`;

        try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorText;
        } catch (e) {
             errorMessage = errorText || `Errore sconosciuto nel recupero dati.`;
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Renderizza le statistiche principali del titolo (nome, prezzo, cambio giornaliero).
 */
function renderResults(data) {
    // Gestione dati di prezzo e fallback
    const valoreRaw = data.valore;
    const valoreIeriRaw = data.valoreIeri;

    // Usiamo 0 come fallback se i dati sono malformati, ma ci assicuriamo che siano numeri
    const valore = typeof valoreRaw === 'number' && !isNaN(valoreRaw) ? valoreRaw : 0;
    const valoreIeri = typeof valoreIeriRaw === 'number' && !isNaN(valoreIeriRaw) ? valoreIeriRaw : 0;

    const change = valore - valoreIeri;
    const changePercent = (valoreIeri !== 0) ? (change / valoreIeri) : 0;

    // Variabili per l'aspetto visuale
    const isPositive = change >= 0;
    const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
    const changeSymbol = isPositive ? '▲' : '▼';
    const currency = data.valuta || 'EUR';

    // Funzione per formattare la valuta (es. 35,45 €)
    const euroFormatter = (value) => {
        if (isNaN(value) || value === null || value === 0) return 'N/A';
        let formatted = new Intl.NumberFormat('it-IT', { style: 'currency', currency: currency }).format(value);
        // Estrae il simbolo della valuta per posizionarlo correttamente
        const symbol = new Intl.NumberFormat('it-IT', { style: 'currency', currency: currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(0).replace(/[0,\s]/g, '').trim();
        return formatted.replace(symbol, '').trim() + ' ' + symbol;
    };

    const priceFormatted = euroFormatter(valore);

    let changeDisplay;

    // Logica per mostrare il cambio (assoluto + percentuale o N/A)
    const changeValueFormatted = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2 }).format(Math.abs(change));

    if (valoreIeri !== 0) {
        // Percentuale calcolabile
        changeDisplay = `${changeSymbol} ${changeValueFormatted} (${(changePercent * 100).toFixed(2)}%)`;
    } else if (valore !== 0) {
        // ValoreIeri è 0, ma abbiamo un valore corrente: mostriamo il cambio, ma N/A per la percentuale
        changeDisplay = `${changeSymbol} ${changeValueFormatted} (N/A)`;
    } else {
        // Dati non disponibili
        changeDisplay = `N/A`;
    }

    // Funzione helper per formattare le statistiche secondarie
    const formatCurrencyStat = (value) => {
        if (isNaN(value) || value === null) return 'N/A';
        return euroFormatter(value);
    }

    // Iniezione dell'HTML nella card
    detailsCard.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6">
            <h3 class="text-4xl font-extrabold text-gray-900">${data.nome} <span class="text-gray-500 font-medium text-2xl">(${data.simbolo})</span></h3>
            <div class="mt-3 sm:mt-0 text-right">
                <p class="text-5xl font-extrabold ${changeColor} leading-none">${priceFormatted}</p>
                <p class="text-xl font-bold ${changeColor} mt-1">
                    ${changeDisplay}
                </p>
            </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-6 text-gray-700">
            <div class="flex flex-col">
                <span class="text-sm font-medium uppercase text-gray-500">Max oggi</span>
                <span class="text-xl font-semibold">${formatCurrencyStat(data.oggiAlto)}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-sm font-medium uppercase text-gray-500">Min oggi</span>
                <span class="text-xl font-semibold">${formatCurrencyStat(data.oggiBasso)}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-sm font-medium uppercase text-gray-500">Max 52 settimane</span>
                <span class="text-xl font-semibold">${formatCurrencyStat(data.precedentiAlto)}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-sm font-medium uppercase text-gray-500">Min 52 settimane</span>
                <span class="text-xl font-semibold">${formatCurrencyStat(data.precedentiBasso)}</span>
            </div>
        </div>
    `;
    currentTicker = data.simbolo;
}

function setupPeriodSelector(ticker, initialPeriod) {
    if (!periodSelector) return;

    periodSelector.innerHTML = '';

    periods.forEach(period => {
        const button = document.createElement('button');

        button.setAttribute('type', 'button');

        // Mappa le etichette per la visualizzazione (es. 1MO -> 1M)
        const displayLabel = period.toUpperCase().replace('MO', 'M').replace('Y', 'Y').replace('D', 'D');

        button.textContent = displayLabel;

        const isActive = period === initialPeriod;
        // ⭐ CLASSI IMPORTANTI: 'period-button' è la classe che gestisce il cambio di colore in Dark Mode in styles.css
        button.className = `period-button px-4 py-2 text-sm rounded-lg shadow transition duration-150 ${isActive ? 'active' : ''}`;
        button.setAttribute('data-period', period);

        button.addEventListener('click', async (e) => {
            e.preventDefault();

            const savedScrollPosition = window.scrollY;

            // Rimuove la classe 'active' da tutti i bottoni
            document.querySelectorAll('.period-button').forEach(btn => btn.classList.remove('active'));
            // Aggiunge la classe 'active' solo al bottone cliccato
            button.classList.add('active');

            const selectedPeriod = button.getAttribute('data-period');

            // Effetto di caricamento
            detailsCard.style.opacity = 0.5;

            try {
                const stockData = await fetchStockData(ticker, selectedPeriod);
                // Aggiorna il grafico con i nuovi dati e periodo
                updateChart(stockData, selectedPeriod);
            } catch (error) {
                 console.error("Errore nel cambio periodo:", error);
                 alert("Impossibile caricare i dati per " + displayLabel + ": " + error.message);
            } finally {
                // Rimuove l'effetto di caricamento
                detailsCard.style.opacity = 1;
                window.scrollTo(0, savedScrollPosition);
            }
        });

        periodSelector.appendChild(button);
    });
}

/**
 * Funzione di bootstrap: inizializza la vista dettagli con i dati ricevuti dal server.
 */
function initializeDetailsView() {
    if (!detailsCard) return;

    const hasError = typeof initialErrorMessage !== 'undefined' && initialErrorMessage;
    const hasData = typeof initialStockData !== 'undefined' && initialStockData && initialStockData.simbolo;

    if (hasError) {
        detailsCard.innerHTML = `<div class="p-8 text-red-600 font-semibold text-center">${initialErrorMessage}</div>`;
        if (periodSelector) periodSelector.innerHTML = '';
        if (priceChart) priceChart = priceChart && priceChart.destroy();
        return;
    }

    if (hasData) {
        const ticker = initialStockData.simbolo;
        // Periodo predefinito: Giornaliero (1d)
        const defaultPeriod = '1d';

        try {
            renderResults(initialStockData);
            setupPeriodSelector(ticker, defaultPeriod);

            // Il problema di NaN suggerisce che i dati 1d iniziali (initialStockData) sono vuoti.
            // Li passiamo comunque, ma se l'utente cambia periodo, la chiamata AJAX (fetchStockData)
            // risolverà il problema caricando dati freschi.
            updateChart(initialStockData, defaultPeriod);

        } catch (error) {
            console.error("Errore nel rendering iniziale:", error);
            detailsCard.innerHTML = `<div class="p-8 text-red-600 font-semibold text-center">Errore critico durante la visualizzazione dei dati.</div>`;
        }
    }
}

/**
 * Funzione principale che parte al caricamento completo della pagina.
 */
window.onload = () => {
     // Settaggio dei default del grafico (font, colore)
     Chart.defaults.font.family = 'Inter';
     Chart.defaults.color = document.body.classList.contains('dark') ? '#cbd5e1' : '#4b5563';

     // Inizializza la modalità scura (Dark Mode)
     initializeDarkMode();

     // Logica per la pagina di ricerca (se gli elementi esistono)
     if (searchInput) {
        searchInput.addEventListener('input', handleSuggestions);
        searchInput.addEventListener('keypress', handleSearchSubmit);
     }

     // Logica per la pagina dei dettagli (se gli elementi esistono)
     if (detailsCard) {
        initializeDetailsView();
     }
};