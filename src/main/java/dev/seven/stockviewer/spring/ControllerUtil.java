package dev.seven.stockviewer.spring;

import dev.seven.stockviewer.stock.Stock;
import org.json.JSONArray;
import org.json.JSONObject;
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
    private final RestTemplate restTemplate = new RestTemplate();

    //Funzione fetch azione
    @GetMapping("/search")
    public Object getSearch(@RequestParam("ticker") String symbol,
                            @RequestParam(value = "range", defaultValue = "1mo") String range,
                            @RequestParam(value = "dataType", required = false) String dataType,
                            Model model) {

        Stock stock = null;
        String errorMessage = null;

        try {
            String intervallo = (range.equals("1d") || range.equals("5d")) ? "5m" : "1d";
            String url = "https://query2.finance.yahoo.com/v8/finance/chart/" + symbol + "?range=" + range + "&interval=" + intervallo;

            String responseBody = cercaUrl(url);
            stock = parseJsonToStock(responseBody);

        } catch (Exception e) {
            errorMessage = "Errore nel recupero dati per " + symbol + ": " + e.getMessage();
        }

        if ("json".equalsIgnoreCase(dataType)) {
            if (stock != null) return ResponseEntity.ok(stock);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorMessage);
        }

        model.addAttribute("azioneDettagli", stock);
        model.addAttribute("periodo", range);
        model.addAttribute("errorMessage", errorMessage);
        return "search";
    }

    //Funzione fetch lista azioni
    @GetMapping(value = "/suggest", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public String searchSuggestions(@RequestParam("query") String query) {
        try {
            String q = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = "https://query2.finance.yahoo.com/v1/finance/search?q=" + q;
            return cercaUrl(url);
        } catch (IOException e) {
            return "{\"error\": \"Errore nel recupero suggerimenti: " + e.getMessage() + "\"}";
        }
    }


    //Metodo ricerca HTTP
    private String cercaUrl(String url) throws IOException {
        HttpHeaders headers = new HttpHeaders();
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

    //Parsing da JSON a classe Stock
    public static Stock parseJsonToStock(String json) {
        JSONObject root = new JSONObject(json);
        if (root.getJSONObject("chart").get("error") != JSONObject.NULL) {
            JSONObject error = root.getJSONObject("chart").getJSONObject("error");
            throw new RuntimeException("Errore nel recupero dati da Yahoo Finance: " + error.optString("description", "Dati non disponibili."));
        }

        JSONObject result = root.getJSONObject("chart").getJSONArray("result").getJSONObject(0);
        JSONObject meta = result.getJSONObject("meta");

        String nome = meta.optString("longName", meta.optString("shortName", ""));
        String simbolo = meta.optString("symbol", "");
        String valuta = meta.optString("currency", "");
        String borsa = meta.optString("exchangeName", "");
        double valore = meta.optDouble("regularMarketPrice", Double.NaN);
        double valoreIeri = meta.optDouble("previousClose", Double.NaN);
        double precedentiAlto = meta.optDouble("fiftyTwoWeekHigh", Double.NaN);
        double precedentiBasso = meta.optDouble("fiftyTwoWeekLow", Double.NaN);
        double oggiAlto = meta.optDouble("regularMarketDayHigh", Double.NaN);
        double oggiBasso = meta.optDouble("regularMarketDayLow", Double.NaN);

        JSONArray timestampArray = result.optJSONArray("timestamp");
        if (timestampArray == null || timestampArray.length() == 0) {
            return new Stock(new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>(),
                    nome, simbolo, valuta, borsa, valore, valoreIeri, precedentiAlto, precedentiBasso, oggiAlto, oggiBasso);
        }

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

        ArrayList<Date> date = new ArrayList<>();
        ArrayList<Double> apertura = new ArrayList<>();
        ArrayList<Double> massimo = new ArrayList<>();
        ArrayList<Double> minimo = new ArrayList<>();
        ArrayList<Double> chiusura = new ArrayList<>();
        ArrayList<Double> adjClose = new ArrayList<>();

        for (int i = 0; i < timestampArray.length(); i++) {
            long epochSeconds = timestampArray.getLong(i);
            Date d = new Date(epochSeconds * 1000L);

            if (openArray != null && !openArray.isNull(i) &&
                    highArray != null && !highArray.isNull(i) &&
                    lowArray != null && !lowArray.isNull(i) &&
                    closeArray != null && !closeArray.isNull(i)) {

                double open = openArray.getDouble(i);
                double high = highArray.getDouble(i);
                double low = lowArray.getDouble(i);
                double close = closeArray.getDouble(i);
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

        Stock stock = new Stock(date, apertura, massimo, minimo, chiusura, adjClose,
                nome, simbolo, valuta, borsa, valore, valoreIeri, precedentiAlto, precedentiBasso, oggiAlto, oggiBasso);

        //Debugging
        //System.out.println("✅ Parsed JSON successfully for: " + simbolo);
        //System.out.println(stock.toString());

        return stock;
    }
}