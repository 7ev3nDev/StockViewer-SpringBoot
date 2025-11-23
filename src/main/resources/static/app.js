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

    //Centralizziamo le costanti per i temi per evitare duplicati
    const THEME_COLORS = {
        light: { text: '#4b5563', grid: '#e5e7eb' }, // gray-600, gray-200
        dark:  { text: '#cbd5e1', grid: '#374151' }  // gray-300, gray-700
    };

    //Li creiamo qua per evitare ripetizioni e miglioriamo le performance
    //Formattazione valute
    const currencyFormatter = new Intl.NumberFormat('it-IT', { 
        minimumFractionDigits: 2, maximumFractionDigits: 2 
    });

    //Formattazione percentuali
    const percentFormatter = new Intl.NumberFormat('it-IT', { 
        style: 'percent', minimumFractionDigits: 2 
    });

    //Per asse X
    const axisTimeFormatter = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
    const axisDateFormatter = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

    //Per Tooltip (data/data+ora)
    const tooltipDateFormatter = new Intl.DateTimeFormat('it-IT', { 
        day: 'numeric', month: 'long', year: 'numeric' 
    });
    const tooltipDateTimeFormatter = new Intl.DateTimeFormat('it-IT', { 
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    /** Funzioni helper */

    const getCurrencySymbol = (currencyCode) => {
        const symbols = { 'EUR': '€', 'USD': '$', 'GBP': '£' };
        return symbols[currencyCode] || currencyCode;
    };

    const getCurrentThemeColors = () => {
        return document.body.classList.contains('dark') ? THEME_COLORS.dark : THEME_COLORS.light;
    };

    /** Gestione dark mode */

    //Attiva/disattiva dark mode aggiornando classi CSS e icone
    const setDarkMode = (isDark) => {
        document.body.classList.toggle('dark', isDark);

        //Gestione icone sole/luna
        if (domElements.sunIcon) domElements.sunIcon.classList.toggle('hidden', isDark);
        if (domElements.moonIcon) domElements.moonIcon.classList.toggle('hidden', !isDark);

        //Aggiorna i colori del grafico (se esiste)
        if (priceChart) {
            const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
            ['x', 'y'].forEach(axis => {
                //Aggiorniamo direttamente le opzioni delle scale
                if (priceChart.options.scales[axis]) {
                    priceChart.options.scales[axis].ticks.color = colors.text;
                    priceChart.options.scales[axis].grid.color = colors.grid;
                }
            });
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
        const colors = getCurrentThemeColors();
        const currencySymbol = getCurrencySymbol(stockData.valuta);

        //Distruggiamo il grafico se esiste già
        if (priceChart) priceChart.destroy();

        //Controlliamo se ci sono dati da mostrare
        if (!stockData.chiusura || stockData.chiusura.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = colors.text;
            ctx.textAlign = "center";
            ctx.fillText("Nessun dato disponibile", ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        //Formattazione asse X (Orario per 1g/5g, Data per periodi lunghi)
        const isIntraday = (period === '1d' || period === '5d');
        const labels = stockData.date.map(dateString => {
            const date = new Date(dateString);

            //Utilizziamo i formattatori pronti invece di crearne di nuovi
            return isIntraday ? axisTimeFormatter.format(date) : axisDateFormatter.format(date);
        });

        //Configurazione Chart.js
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Prezzo',
                    data: stockData.chiusura,
                    borderColor: stockData.positivo ? '#059669' : '#dc2626', //Verde o Rosso
                    borderWidth: 2,
                    pointRadius: 0, //Nascondiamo i puntini per una linea pulita
                    tension: 0.1    //Leggera curvatura della linea
                }]
            },
            options: {
                responsive: true,
                plugins: { 
                    legend: { display: false },
                    tooltip: { 
                        mode: 'index', intersect: false,
                        callbacks: {
                            title: (tooltipItems) => {
                                const index = tooltipItems[0].dataIndex;
                                const date = new Date(stockData.date[index]);
                                
                                // Usiamo i due formatter separati che abbiamo già per evitare testi extra
                                if (isIntraday) {
                                    return `${tooltipDateFormatter.format(date)}, ${axisTimeFormatter.format(date)}`;
                                }
                                
                                return tooltipDateFormatter.format(date);
                            },
                            label: (context) => {
                                const val = context.parsed.y;
                                return val !== null ? `Prezzo: ${val.toFixed(2)} ${currencySymbol}` : '';
                            }
                        }
                    } 
                },
                scales: { 
                    x: { 
                        ticks: { maxTicksLimit: 8, color: colors.text },
                        grid: { color: colors.grid }
                    }, 
                    y: { 
                        ticks: { callback: v => v.toFixed(2), color: colors.text },
                        grid: { color: colors.grid }
                    } 
                }
            }
        });
    };

    /** Visalizzazione dettagli */

    //Aggiornamento HTML della card con i dettagli dell'azione
    const renderStockDetails = (stockData) => {
        if (!domElements.detailsCard) return;

        const isPos = stockData.positivo;

        //Determinazione classi e simboli per il colore (Verde/Rosso)
        const colorClass = isPos ? 'text-green-600' : 'text-red-600';
        const symbol = getCurrencySymbol(stockData.valuta);

        //Funzione helper per generare i blocchi delle statistiche
        const statHtml = (label, val) => `
            <div>
                <span class="text-sm font-medium text-gray-500 uppercase">${label}</span>
                <div class="text-xl font-semibold">${val ? currencyFormatter.format(val) : 'N/A'} ${symbol}</div>
            </div>`;

        //Injecting nell'HTML
        domElements.detailsCard.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-center border-b border-gray-200 pb-4 mb-6">
                <h3 class="text-4xl font-extrabold text-gray-900">
                    ${stockData.nome} 
                    <span class="text-gray-500 text-2xl">(${stockData.simbolo})</span>
                </h3>
                <div class="text-right">
                    <p class="text-5xl font-extrabold ${colorClass}">
                        ${currencyFormatter.format(stockData.valore)} ${symbol}
                    </p>
                    <p class="text-xl font-bold ${colorClass}">
                        ${isPos ? '▲' : '▼'} ${currencyFormatter.format(Math.abs(stockData.variazione))} (${percentFormatter.format(stockData.variazionePercentuale)})
                    </p>
                </div>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                ${statHtml('Max oggi', stockData.oggiAlto)}
                ${statHtml('Min oggi', stockData.oggiBasso)}
                ${statHtml('Max 52w', stockData.precedentiAlto)}
                ${statHtml('Min 52w', stockData.precedentiBasso)}
            </div>`;
    };

    //Caricamento dati per periodo specifico tramite AJAX
    const loadPeriodData = async (ticker, period) => {
        //Aggiungiamo classe CSS per l'effetto "caricamento" (trasparenza)
        domElements.detailsCard.classList.add('loading');
        try {
            const res = await fetch(`/search?ticker=${ticker}&range=${period}&dataType=json`);
            if (!res.ok) throw new Error("Errore API");
            renderChart(await res.json(), period); //Aggiorna solo il grafico
        } catch (err) {
            console.error(err);
            alert("Errore caricamento grafico.");
        } finally {
            domElements.detailsCard.classList.remove('loading');
        }
    };

    //Creazione bottoni per selezione periodo
    const initializePeriodButtons = (ticker, currentPeriod) => {
        if (!domElements.periodSelector) return;
        domElements.periodSelector.innerHTML = '';  //Pulizia bottoni precedenti

        ["1d", "5d", "1mo", "6mo", "1y", "5y", "max"].forEach(p => {
            const btn = document.createElement('button');
            //Trasformiamo caratteri minuscoli in maiuscoli per l'etichetta
            btn.textContent = p.toUpperCase().replace('MO','M');
            btn.className = `period-button px-4 py-2 text-sm rounded-lg shadow ${p === currentPeriod ? 'active' : ''}`;
            
            btn.onclick = async (e) => {
                e.preventDefault();
                const savedScrollPosition = window.scrollY;

                //Rimozione 'active' dagli altri e inserimento all'attuale
                document.querySelectorAll('.period-button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                await loadPeriodData(ticker, p);
                window.scrollTo(0, savedScrollPosition);
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
                    const res = await fetch(`/suggest?query=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    const quotes = (data.quotes || []).slice(0, 8); //Selezione massimo 8 risultati
            
                    if (!quotes.length) {
                        domElements.suggestionsBox.classList.add('hidden');
                        return;
                    }

                    //Generazione suggerimenti nell'HTML
                    domElements.suggestionsBox.innerHTML = quotes.map(item => `
                        <div class="suggestion-item p-3 border-b border-gray-100 cursor-pointer flex justify-between" 
                             onclick="window.location.href='/search?ticker=${item.symbol}'">
                            <div>
                                <span class="font-bold">${item.symbol}</span> 
                                <span class="text-sm opacity-80">${item.shortname || item.longname || ''}</span>
                            </div>
                            <span class="text-xs opacity-60">${item.exchange}</span>
                        </div>
                    `).join('');
                    domElements.suggestionsBox.classList.remove('hidden');
                } catch (e) { console.error(e); }
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
    if (typeof initialStockData !== 'undefined' && initialStockData?.simbolo) {
        renderStockDetails(initialStockData);
        initializePeriodButtons(initialStockData.simbolo, '1d');
        renderChart(initialStockData, '1d');
    } else if (typeof initialErrorMessage !== 'undefined' && initialErrorMessage && domElements.detailsCard) { //Gestione errore iniziale
        domElements.detailsCard.innerHTML = `<div class="p-8 text-red-600 text-center font-bold">${initialErrorMessage}</div>`;
    }
});