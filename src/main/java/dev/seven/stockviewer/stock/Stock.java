package dev.seven.stockviewer.stock;

import java.util.ArrayList;
import java.util.Date;

public class Stock {
    private ArrayList<Date> date;
    private ArrayList<Double> apertura;
    private ArrayList<Double> massimo;
    private ArrayList<Double> minimo;
    private ArrayList<Double> chiusura;
    private ArrayList<Double> adjClose;

    private String nome;
    private String simbolo;
    private String valuta;
    private String borsa;
    private double valore;
    private double valoreIeri;
    private double precedentiAlto;
    private double precedentiBasso;
    private double oggiAlto;
    private double oggiBasso;


    public Stock(ArrayList<Date> date,
                 ArrayList<Double> apertura,
                 ArrayList<Double> massimo,
                 ArrayList<Double> minimo,
                 ArrayList<Double> chiusura,
                 ArrayList<Double> adjClose,
                 String nome, String simbolo, String valuta, String borsa, double valore, double valoreIeri, double precedentiAlto, double precedentiBasso, double oggiAlto,double oggiBasso
    ) {
        this.date = date;
        this.apertura = apertura;
        this.massimo = massimo;
        this.minimo = minimo;
        this.chiusura = chiusura;
        this.adjClose = adjClose;

        this.nome = nome;
        this.simbolo = simbolo;
        this.valuta = valuta;
        this.borsa = borsa;
        this.valore =  valore;
        this.valoreIeri = valoreIeri;
        this.precedentiAlto = precedentiAlto;
        this.precedentiBasso = precedentiBasso;
        this.oggiAlto = oggiAlto;
        this.oggiBasso = oggiBasso;

    }

    public ArrayList<Date> getDate() {
        return date;
    }

    public ArrayList<Double> getApertura() {
        return apertura;
    }

    public ArrayList<Double> getMassimo() {
        return massimo;
    }

    public ArrayList<Double> getMinimo() {
        return minimo;
    }

    public ArrayList<Double> getChiusura() {
        return chiusura;
    }

    public ArrayList<Double> getAdjClose() {
        return adjClose;
    }

    public String getNome() {
        return nome;
    }

    public String getSimbolo() {
        return simbolo;
    }

    public String getValuta() {
        return valuta;
    }

    public String getBorsa() {
        return borsa;
    }

    public double getValore() {
        return valore;
    }

    public double getValoreIeri() {
        return valoreIeri;
    }

    public double getPrecedentiAlto() {
        return precedentiAlto;
    }

    public double getPrecedentiBasso() {
        return precedentiBasso;
    }

    public double getOggiAlto() {
        return oggiAlto;
    }

    public double getOggiBasso() {
        return oggiBasso;
    }

    public void setDate(ArrayList<Date> date) {
        this.date = date;
    }

    public void setApertura(ArrayList<Double> apertura) {
        this.apertura = apertura;
    }

    public void setMassimo(ArrayList<Double> massimo) {
        this.massimo = massimo;
    }

    public void setMinimo(ArrayList<Double> minimo) {
        this.minimo = minimo;
    }

    public void setChiusura(ArrayList<Double> chiusura) {
        this.chiusura = chiusura;
    }

    public void setAdjClose(ArrayList<Double> adjClose) {
        this.adjClose = adjClose;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public void setSimbolo(String simbolo) {
        this.simbolo = simbolo;
    }

    public void setValuta(String valuta) {
        this.valuta = valuta;
    }

    public void setBorsa(String borsa) {
        this.borsa = borsa;
    }

    public void setValore(double valore) {
        this.valore = valore;
    }

    public void setValoreIeri(double valoreIeri) {
        this.valoreIeri = valoreIeri;
    }

    public void setPrecedentiAlto(double precedentiAlto) {
        this.precedentiAlto = precedentiAlto;
    }

    public void setPrecedentiBasso(double precedentiBasso) {
        this.precedentiBasso = precedentiBasso;
    }

    public void setOggiAlto(double oggiAlto) {
        this.oggiAlto = oggiAlto;
    }

    public void setOggiBasso(double oggiBasso) {
        this.oggiBasso = oggiBasso;
    }

    @Override
    public String toString() {
        //Calcolo cambio assoluto (rotto, ho bestemmiato molto per farlo funzionare ma nada)
        double delta = valore - valoreIeri;
        double deltaPercentuale = (valoreIeri != 0) ? (delta / valoreIeri) * 100 : 0.0;
        String freccia = (delta >= 0) ? "▲" : "▼";

        return "\n--- Parsed Stock Object Summary ---" +
                "\nNome: " + nome +
                "\nSimbolo: " + simbolo +
                "\nValuta: " + valuta +
                "\n" +
                // Prezzo Corrente con Cambio
                "\nValore Corrente: " + String.format("%.2f", valore) + " " + valuta +
                "\nCambio Giornaliero: " + freccia + String.format(" %.2f (%.2f%%)", Math.abs(delta), deltaPercentuale) +
                "\nValore Ieri (Chiusura Precedente): " + String.format("%.2f", valoreIeri) +
                "\n" +
                // Dati Giornalieri e 52 Settimane
                "\nMax/Min Oggi: " + String.format("%.2f", oggiAlto) + " / " + String.format("%.2f", oggiBasso) +
                "\nMax/Min 52 Settimane: " + String.format("%.2f", precedentiAlto) + " / " + String.format("%.2f", precedentiBasso) +
                "\n" +
                // Riepilogo Serie Storica
                "\nSerie Temporale (Date):" +
                "\n  Punti Dati Totali: " + date.size() +
                "\n------------------------------------\n";
    }
}
