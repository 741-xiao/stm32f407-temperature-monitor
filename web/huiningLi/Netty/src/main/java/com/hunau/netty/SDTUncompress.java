package com.hunau.netty;

//<!--
//        * @Description:
//        * @Version: 1.0
//        * @Autor: 李慧宁-Huining Li777
//        * @Date: 2024-04-04 14:57:07
//        * @LastEditors: 李慧宁-Huining Li777
//        * @LastEditTime: 2024-04-09 18:24:54
//        * @mailbox:: 776903782@qq.com
//-->
public class SDTUncompress {
    public double[] tempUncompress(double lastTemp, double currentTemp, int tempIntervalTimes){
        double[] updateTemp = new double[(int)tempIntervalTimes];

        double k = (currentTemp - lastTemp) / tempIntervalTimes;

        for (int i = 1; i < tempIntervalTimes+1; i++) {

            updateTemp[i-1] = k*i + lastTemp;

        }
        return updateTemp;
    }

    public double[] humUncompress(double lastHum, double currentHum, int humIntervalTimes){
        double[] updateHum = new double[ (int)humIntervalTimes ];

        double k = (currentHum - lastHum) / humIntervalTimes;

        for (int i = 1; i < humIntervalTimes+1; i++) {

            updateHum[i-1] = k*i + lastHum;

        }
        return updateHum;
    }

    public double[] distUncompress(double lastDist, double currentDist, int distIntervalTimes){
        double[] updateDist = new double[(int)distIntervalTimes];

        double k = (currentDist - lastDist) / distIntervalTimes;

        for (int i = 1; i < distIntervalTimes+1; i++) {

            updateDist[i-1] = k*i + lastDist;

        }
        return updateDist;
    }

    public double[] lightUncompress(int lastLight, int currentLight, int lightIntervalTimes){
        double[] updateLight = new double[(int)lightIntervalTimes];

        double k = (currentLight - lastLight) / (double)lightIntervalTimes;

        for (int i = 1; i < lightIntervalTimes+1; i++) {

            updateLight[i-1] = k*i + lastLight;

        }
        return updateLight;
    }
}
