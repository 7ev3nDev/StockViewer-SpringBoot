package dev.seven.stockviewer.spring;

import dev.seven.stockviewer.stock.Stock;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;

@Controller
public class ControllerUtil {

    //Client HTTP fornito da Spring per fare chiamate esterne
    private final RestTemplate restTemplate;

    public ControllerUtil(RestTemplateBuilder builder) {
        this.restTemplate = builder.build();
    }

    /**
     * Gestione pagina di ricerca e visualizzazione dei dettagli di un'azione.
     *
     * @param symbol Il ticker dell'azione (es. AAPL, NVDA).
     * @param range L'intervallo temporale richiesto (es. 1d, 1mo, 1y). Default: 1 mese.
     * @param dataType Se vale "json", ritorna solo i dati grezzi (per aggiornare il grafico via JS),
     *                 altrimenti ritorna la pagina HTML completa.
     * @param model Il modello per passare dati alla vista Thymeleaf (HTML).
     */
    @GetMapping("/search")
    public Object getSearch(@RequestParam("ticker") String symbol, @RequestParam(value = "range", defaultValue = "1mo") String range, @RequestParam(value = "dataType", required = false) String dataType, Model model) {
        Stock stock = null;
        String errorMessage = null;

        try {
            //Determinazione intervallo in base ai giorni
            String intervallo = (range.equals("1d") || range.equals("5d")) ? "5m" : "1d";

            // Chiamata all'API di Yahoo Finance
            String url = "https://query2.finance.yahoo.com/v8/finance/chart/" + symbol + "?range=" + range + "&interval=" + intervallo;

            //Esecuzione chiamata e parsing
            String responseBody = cercaUrl(url);
            stock = parseJsonToStock(responseBody);

        } catch (Exception e) {
            errorMessage = "Errore nel recupero dati per " + symbol + ": " + e.getMessage();
        }

        //Se all'API viene richiesto un JSON gli rispondiamo con esso (per aggiornare il grafico via JS)
        if ("json".equalsIgnoreCase(dataType)) {
            if (stock != null) return ResponseEntity.ok(stock);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorMessage);
        }

        //Sennò rispondiamo con la pagina HTML completa
        model.addAttribute("azioneDettagli", stock);
        model.addAttribute("periodo", range);
        model.addAttribute("errorMessage", errorMessage);
        return "search";
    }

    /**
     * Fornisce suggerimenti di ricerca mentre l'utente digita.
     * @param query Testo digitato dall'utente.
     * @return JSON grezzo restituito da Yahoo Search.
     */
    @GetMapping(value = "/suggest", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public String searchSuggestions(@RequestParam("query") String query) {
        try {
            //Encode URL per gestione spazi e caratteri speciali
            String q = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = "https://query2.finance.yahoo.com/v1/finance/search?q=" + q;
            return cercaUrl(url);
        } catch (IOException e) {
            return "{\"error\": \"Errore nel recupero suggerimenti: " + e.getMessage() + "\"}";
        }
    }

    /** Esecuzione richiesta HTTP generica */
    private String cercaUrl(String url) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        //User-Agent simulato per sembrare un browser reale (evita errore 429)
        headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36");
        headers.set("Accept", "application/json");
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK) {
                return response.getBody();
            } else {
                throw new IOException("Risposta HTTP non OK: " + response.getStatusCode());
            }
        } catch (Exception e) {
            throw new IOException("Errore durante la chiamata API: " + e.getMessage());
        }
    }

    /** Conversione JSON di Yahoo Finance in oggetto Stock */
    public static Stock parseJsonToStock(String json) {
        JSONObject root = new JSONObject(json);

        //Controllo errori API
        if (root.getJSONObject("chart").get("error") != JSONObject.NULL) {
            JSONObject error = root.getJSONObject("chart").getJSONObject("error");
            throw new RuntimeException("Errore nel recupero dati da Yahoo Finance: " + error.optString("description", "Dati non disponibili."));
        }

        //Estrazione Metadati da JSON
        JSONObject result = root.getJSONObject("chart").getJSONArray("result").getJSONObject(0);
        JSONObject meta = result.getJSONObject("meta");

        String nome = meta.optString("longName", meta.optString("shortName", ""));
        String simbolo = meta.optString("symbol", "");
        String valuta = meta.optString("currency", "");
        String borsa = meta.optString("exchangeName", "");
        
        //Estrazione prezzi correnti e storici
        double valore = meta.optDouble("regularMarketPrice", Double.NaN);
        double valoreIeri = meta.optDouble("previousClose", Double.NaN);
        double precedentiAlto = meta.optDouble("fiftyTwoWeekHigh", Double.NaN);
        double precedentiBasso = meta.optDouble("fiftyTwoWeekLow", Double.NaN);
        double oggiAlto = meta.optDouble("regularMarketDayHigh", Double.NaN);
        double oggiBasso = meta.optDouble("regularMarketDayLow", Double.NaN);

        //Estrazione Serie Storica
        JSONArray timestampArray = result.optJSONArray("timestamp");
        
        //Se non ci sono dati storici, ritorna oggetto vuoto con soli metadati
        if (timestampArray == null || timestampArray.length() == 0) {
            return new Stock(new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(),
                    nome, simbolo, valuta, borsa, valore, valoreIeri, precedentiAlto, precedentiBasso, oggiAlto, oggiBasso);
        }

        //Pre-allochiamo dimensione liste per ottimizzazione performance
        int size = timestampArray.length();

        JSONObject indicators = result.getJSONObject("indicators");
        JSONObject quote = indicators.getJSONArray("quote").getJSONObject(0);

        JSONArray openArray = quote.optJSONArray("open");
        JSONArray highArray = quote.optJSONArray("high");
        JSONArray lowArray = quote.optJSONArray("low");
        JSONArray closeArray = quote.optJSONArray("close");

        JSONArray adjCloseArray = null;
        if (indicators.has("adjclose")) {
            adjCloseArray = indicators.getJSONArray("adjclose")
                    .getJSONObject(0)
                    .optJSONArray("adjclose");
        }

        //Creazione liste ottimizzate
        ArrayList<Date> date = new ArrayList<>(size);
        ArrayList<Double> apertura = new ArrayList<>(size);
        ArrayList<Double> massimo = new ArrayList<>(size);
        ArrayList<Double> minimo = new ArrayList<>(size);
        ArrayList<Double> chiusura = new ArrayList<>(size);
        ArrayList<Double> adjClose = new ArrayList<>(size);

        //Verifica preliminare integrità dati per evitare check ripetuti nel loop
        boolean hasData = openArray != null && highArray != null && lowArray != null && closeArray != null;

        //Ciclo di popolamento dati
        for (int i = 0; i < timestampArray.length(); i++) {
            long epochSeconds = timestampArray.getLong(i);
            Date d = new Date(epochSeconds * 1000L);

            //Filtriamo se i dati sono validi per evitare null
            if (hasData && !openArray.isNull(i) && !highArray.isNull(i) && !lowArray.isNull(i) && !closeArray.isNull(i)) {
                double open = openArray.getDouble(i);
                double high = highArray.getDouble(i);
                double low = lowArray.getDouble(i);
                double close = closeArray.getDouble(i);
                
                //Usa Adjusted Close se disponibile, altrimenti Close normale
                double adj = (adjCloseArray != null && i < adjCloseArray.length() && !adjCloseArray.isNull(i))
                        ? adjCloseArray.getDouble(i)
                        : close;

                date.add(d);
                apertura.add(open);
                massimo.add(high);
                minimo.add(low);
                chiusura.add(close);
                adjClose.add(adj);
            }
        }

        //Costruzione oggetto finale
        return new Stock(date, apertura, massimo, minimo, chiusura, adjClose,
                nome, simbolo, valuta, borsa, valore, valoreIeri, precedentiAlto, precedentiBasso, oggiAlto, oggiBasso);
    }
}