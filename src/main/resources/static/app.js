document.addEventListener('DOMContentLoaded', () => {
    
    /** Riferimenti al DOM e creazione variabili globali */

    //Raccogliamo gli elementi HTML in un oggetto per trovarli facilmente
    const domElements = {
        searchInput: document.getElementById('search-input'),
        suggestionsBox: document.getElementById('suggestions-container'),
        detailsCard: document.getElementById('stock-details-card'),
        periodSelector: document.getElementById('period-selector'),
        chartCanvas: document.getElementById('price-chart'),
        darkModeToggle: document.getElementById('dark-mode-toggle'),
        sunIcon: document.getElementById('sun-icon'),
        moonIcon: document.getElementById('moon-icon')
    };

    //Variabili globali
    let priceChart = null;       //Istanza di Chart.js
    let searchDebounceTimer;     //Timer per ritardare la ricerca mentre si scrive


    //Li creiamo qua per evitare ripetizioni e miglioriamo le performance
    //Formattazione valute
    const currencyFormatter = new Intl.NumberFormat('it-IT', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });

    //Formattazione percentuali
    const percentFormatter = new Intl.NumberFormat('it-IT', { 
        style: 'percent', 
        minimumFractionDigits: 2 
    });

    //Formattazione data
    const timeFormatter = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
    const dateFormatter = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

    /** Gestione dark mode */

    //Attiva/disattiva dark mode aggiornando classi CSS e icone
    const setDarkMode = (isDark) => {
        document.body.classList.toggle('dark', isDark);
    
        //Gestione icone sole/luna
        if (domElements.sunIcon) domElements.sunIcon.classList.toggle('hidden', isDark);
        if (domElements.moonIcon) domElements.moonIcon.classList.toggle('hidden', !isDark);

        //Aggiorna i colori del grafico (se esiste)
        if (priceChart) {
            Chart.defaults.color = isDark ? '#cbd5e1' : '#4b5563';
            priceChart.update('none'); //Evitiamo l'animazione del ridisegno
        }

        //Salviamo la preferenza dell'utente
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    //Lettura tema salvato o utilizzo di quello di sistema all'avvio
    const initializeTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
        //Se c'è un tema salvato usalo, altrimenti usa preferenza sistema
        const shouldUseDark = savedTheme ? (savedTheme === 'dark') : systemPrefersDark;
        setDarkMode(shouldUseDark);

        //Listener sul bottone
        if (domElements.darkModeToggle) {
            domElements.darkModeToggle.addEventListener('click', () => {
                const isCurrentlyDark = document.body.classList.contains('dark');
                setDarkMode(!isCurrentlyDark);
            });
        }
    };

    /** Gestione grafico */

    //Disegna o aggiorna il grafico con nuovi dati
    const renderChart = (stockData, period) => {
        if (!domElements.chartCanvas) return;

        const ctx = domElements.chartCanvas.getContext('2d');
    
        //Distruggiamo il grafico se esiste già
        if (priceChart) priceChart.destroy();

        //Controlliamo se ci sono dati da mostrare
        if (!stockData.chiusura || stockData.chiusura.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillText("Nessun dato disponibile", ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        //Formattazione asse X (Orario per 1g/5g, Data per periodi lunghi)
        const labels = stockData.date.map(dateString => {
            const date = new Date(dateString);
            const isIntraday = (period === '1d' || period === '5d');
        
            //Utilizziamo i formattatori pronti invece di crearne di nuovi
            return isIntraday ? timeFormatter.format(date) : dateFormatter.format(date);
        });

        //Selezione colore linea Verde/Rosso (stockData.positivo calcolato lato server)
        const lineColor = stockData.positivo ? '#059669' : '#dc2626';

        //Configurazione Chart.js
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: stockData.valuta,
                    data: stockData.chiusura,
                    borderColor: lineColor,
                    borderWidth: 2,
                    pointRadius: 0, //Nascondiamo i puntini per una linea pulita
                    tension: 0.1    //Leggera curvatura della linea
                }]
            },
            options: {
                responsive: true,
                plugins: { 
                    legend: { display: false }, //Nascondiamo la legenda
                    tooltip: { mode: 'index', intersect: false } 
                },
                scales: { 
                    x: { ticks: { maxTicksLimit: 8 } }, 
                    y: { ticks: { callback: value => value.toFixed(2) } } 
                }
            }
        });
    };

    /** Visalizzazione dettagli */

    //Aggiornamento HTML della card con i dettagli dell'azione
    const renderStockDetails = (stockData) => {
        if (!domElements.detailsCard) return;
    
        //Determinazione classi e simboli per il colore (Verde/Rosso)
        const colorClass = stockData.positivo ? 'text-green-600' : 'text-red-600';
        const arrowSymbol = stockData.positivo ? '▲' : '▼';

        //Preparazione testi formattati (calcoli fatti dal server)
        const currentPrice = currencyFormatter.format(stockData.valore);
        const changeAmount = currencyFormatter.format(Math.abs(stockData.variazione));
        const changePercent = percentFormatter.format(stockData.variazionePercentuale);
    
        const changeText = `${arrowSymbol} ${changeAmount} (${changePercent})`;

        //Funzione helper per generare i blocchi delle statistiche
        const createStatBlock = (label, value) => {
            const displayValue = value ? currencyFormatter.format(value) : 'N/A';
            return `
                <div>
                    <span class="text-sm font-medium text-gray-500 uppercase">${label}</span>
                    <div class="text-xl font-semibold">${displayValue}</div>
                </div>`;
        };

        //Injecting nell'HTML
        domElements.detailsCard.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-center border-b pb-4 mb-6">
                <h3 class="text-4xl font-extrabold text-gray-900">
                    ${stockData.nome} 
                    <span class="text-gray-500 text-2xl">(${stockData.simbolo})</span>
                </h3>
                <div class="text-right">
                    <p class="text-5xl font-extrabold ${colorClass}">${currentPrice} ${stockData.valuta}</p>
                    <p class="text-xl font-bold ${colorClass}">${changeText}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                ${createStatBlock('Max oggi', stockData.oggiAlto)}
                ${createStatBlock('Min oggi', stockData.oggiBasso)}
                ${createStatBlock('Max 52w', stockData.precedentiAlto)}
                ${createStatBlock('Min 52w', stockData.precedentiBasso)}
            </div>`;
    };

    //Caricamento dati per periodo specifico tramite AJAX
    const loadPeriodData = async (ticker, period) => {
        //Aggiungiamo classe CSS per l'effetto "caricamento" (trasparenza)
        domElements.detailsCard.classList.add('loading');
    
        try {
            const response = await fetch(`/search?ticker=${ticker}&range=${period}&dataType=json`);
            if (!response.ok) throw new Error("Errore API");
        
            const data = await response.json();
            renderChart(data, period); //Aggiorna solo il grafico
        
        } catch (error) {
            console.error("Impossibile caricare il periodo:", error);
            alert("Errore nel caricamento del grafico.");
        } finally {
            domElements.detailsCard.classList.remove('loading');
        }
    };

    //Creazione bottoni per selezione periodo
    const initializePeriodButtons = (ticker, currentPeriod) => {
        if (!domElements.periodSelector) return;
    
        domElements.periodSelector.innerHTML = ''; //Pulizia bottoni precedenti
        const availablePeriods = ["1d", "5d", "1mo", "6mo", "1y", "5y", "max"];

        availablePeriods.forEach(periodCode => {
            const btn = document.createElement('button');
            //Trasformiamo caratteri minuscoli in maiuscoli per l'etichetta
            btn.textContent = periodCode.toUpperCase().replace('MO','M');
        
            //Gestione classi CSS (attivo/inattivo)
            const isActive = (periodCode === currentPeriod);
            btn.className = `period-button px-4 py-2 text-sm rounded-lg shadow ${isActive ? 'active' : ''}`;
            
            btn.onclick = (e) => {
                //Rimozione 'active' dagli altri e inserimento all'attuale
                document.querySelectorAll('.period-button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            
                loadPeriodData(ticker, periodCode);
            };
        
            domElements.periodSelector.appendChild(btn);
        });
    };

    /** Ricerca e suggerimento */

    if (domElements.searchInput) {
        //Evento chiamato mentre l'utente scrive
        domElements.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer); //Reset timer precedente
        
            const query = e.target.value.trim();
            if (query.length < 2) {
                domElements.suggestionsBox.classList.add('hidden');
                return;
            }
        
            //Attende 300ms prima della chiamata al server (Debounce)
            searchDebounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`/suggest?query=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    const quotes = (data.quotes || []).slice(0, 8); //Selezione massimo 8 risultati
                
                    if (quotes.length === 0) {
                        domElements.suggestionsBox.classList.add('hidden');
                        return;
                    }
                
                    //Generazione suggerimenti nell'HTML
                    domElements.suggestionsBox.innerHTML = quotes.map(item => `
                        <div class="suggestion-item p-3 border-b border-gray-100 cursor-pointer flex justify-between hover:bg-gray-100" 
                                onclick="window.location.href='/search?ticker=${item.symbol}'">
                            <div>
                                <span class="font-bold text-gray-800">${item.symbol}</span> 
                                <span class="text-sm text-gray-600">${item.shortname || item.longname || ''}</span>
                            </div>
                            <span class="text-xs text-gray-400">${item.exchange}</span>
                        </div>
                    `).join('');
                
                    domElements.suggestionsBox.classList.remove('hidden');
                } catch (error) { 
                    console.error("Errore ricerca:", error); 
                }
            }, 300);
        });

        //Evento dove se viene premuto l'invio parte la ricerca
        domElements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && domElements.searchInput.value) {
                window.location.href = `/search?ticker=${domElements.searchInput.value.toUpperCase()}`;
            }
        });
    }

    /** Inizializzazione app */

    //Impostazione font globale per Chart.js
    Chart.defaults.font.family = 'Inter';

    //Avvio tema (Dark/Light)
    initializeTheme();

    /* Se Thymeleaf ha iniettato dati iniziali (siamo nella pagina Dettagli)
        'initialStockData' è una variabile globale definita nel tag <script> dell'HTML */
    if (typeof initialStockData !== 'undefined' && initialStockData && initialStockData.simbolo) {
        renderStockDetails(initialStockData);
        initializePeriodButtons(initialStockData.simbolo, '1d');
        renderChart(initialStockData, '1d');
    } else if (typeof initialErrorMessage !== 'undefined' && initialErrorMessage && domElements.detailsCard) { //Gestione errore iniziale
        domElements.detailsCard.innerHTML = `<div class="p-8 text-red-600 text-center font-bold">${initialErrorMessage}</div>`;
    }
});