package com.hunau.domain;

/** One validated SHT30 reading. Threshold and alarm are reported by the board. */
public class CollData {
    private long id;
    private String temp;
    private String hum;
    private String threshold;
    private int alarm;
    private String ip;
    private String colltime;

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public String getTemp() { return temp; }
    public void setTemp(String temp) { this.temp = temp; }
    public String getHum() { return hum; }
    public void setHum(String hum) { this.hum = hum; }
    public String getThreshold() { return threshold; }
    public void setThreshold(String threshold) { this.threshold = threshold; }
    public int getAlarm() { return alarm; }
    public void setAlarm(int alarm) { this.alarm = alarm; }
    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }
    public String getColltime() { return colltime; }
    public void setColltime(String colltime) { this.colltime = colltime; }
}
