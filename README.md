# 📈 StockViewer

**StockViewer** è un'applicazione web basata su **Spring Boot** e **Thymeleaf** che consente agli utenti di cercare informazioni in tempo reale e dati storici sui titoli azionari (stock) utilizzando l'API pubblica di Yahoo Finance. L'interfaccia utente è dinamica, implementata con **JavaScript (Chart.js)** per la visualizzazione dei grafici e **Tailwind CSS** per lo styling, includendo un supporto completo per il tema scuro.

## ✨ Caratteristiche Principali

  * **Ricerca Azioni:** Funzionalità di ricerca con suggerimenti dinamici in tempo reale (debounce) mentre l'utente digita il nome dell'azienda o il *ticker*.
  * **Visualizzazione Dettagli:** Mostra il prezzo corrente, la variazione giornaliera (percentuale e assoluta), i massimi/minimi di oggi e i massimi/minimi delle 52 settimane.
  * **Grafici Interattivi:** Utilizza **Chart.js** per visualizzare l'andamento storico del prezzo su intervalli di tempo selezionabili (*1d, 5d, 1mo, 6mo, 1y, 5y, max*).
  * **Tema Scuro (Dark Mode):** Interfaccia utente completamente responsiva con supporto per il tema scuro, persistente tramite `localStorage`.
  * **Architettura Moderna:** Backend basato su **Java/Spring Boot** che funge da intermediario (proxy) per l'API esterna, e un frontend leggero e dinamico.

## ⚙️ Tecnologie Utilizzate

  * **Backend:**
      * Java 17+
      * **Spring Boot 3.3.5** (per il framework e l'HTTP client `RestTemplate`)
      * `org.json` (per il parsing delle risposte API)
  * **Frontend:**
      * **Thymeleaf** (per il templating lato server)
      * **JavaScript (ES6+)** (per la logica frontend e i grafici)
      * **Chart.js 4.x** (per la generazione dei grafici)
      * **Tailwind CSS** (per lo styling utility-first)
  * **API Esterna:**
      * **Yahoo Finance API** (utilizzata tramite chiamate HTTP dirette per dati e suggerimenti).

-----

## 🚀 Guida all'Avvio Locale

Queste istruzioni ti permetteranno di avere una copia funzionante del progetto sulla tua macchina locale per lo sviluppo e il testing.

### Prerequisiti

Assicurati di avere installato:

  * **Java Development Kit (JDK) 17 o superiore.**
  * **Maven** (per la gestione del progetto e delle dipendenze).

### Installazione e Esecuzione

1.  **Clona il repository (simulato):**

    ```bash
    git clone https://github.com/7ev3nDev/StockViewer-SpringBoot.git
    cd StockViewer-SpringBoot
    ```

2.  **Compila il progetto con Maven:**

    ```bash
    mvn clean install
    ```

3.  **Esegui l'applicazione Spring Boot:**

    ```bash
    mvn spring-boot:run
    ```

4.  **Accedi all'applicazione:**
    Apri il tuo browser web e vai a: `http://localhost:8080` (la porta predefinita di Spring Boot).

-----

## 📂 Struttura del Codice

Il progetto segue una struttura standard Spring Boot con una chiara separazione tra backend e risorse frontend.

```
stockviewer/
├── src/main/java/dev/seven/stockviewer/
│   ├── Main.java              # Classe principale per l'avvio di Spring Boot.
│   ├── stock/
│   │   └── Stock.java         # Modello Java per i dati delle azioni.
│   └── spring/
│       └── ControllerUtil.java  # Controller Spring per gestire le richieste /search e /suggest.
└── src/main/resources/
    ├── static/
    │   ├── app.js             # Logica frontend (ricerca, grafico, dark mode).
    │   └── styles.css         # CSS principale (con Tailwind e variabili Dark Mode).
    └── templates/
        ├── fragments/
        │   └── layout.html    # Frammenti Thymeleaf (head, dark mode button).
        ├── index.html         # Pagina iniziale di ricerca.
        └── search.html        # Pagina dei dettagli azione e grafico.
```

-----

## 🤝 Contributi

Sentiti libero di inviare pull request, suggerire nuove funzionalità o segnalare bug.
