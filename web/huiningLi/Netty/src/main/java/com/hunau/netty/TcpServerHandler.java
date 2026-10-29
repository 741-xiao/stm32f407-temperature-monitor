package com.hunau.netty;

import com.hunau.domain.CollData;
import com.hunau.service.CollDataService;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class TcpServerHandler extends SimpleChannelInboundHandler<String> {
    private static final Logger LOG = LoggerFactory.getLogger(TcpServerHandler.class);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final CollDataService service;

    public TcpServerHandler(CollDataService service) {
        this.service = java.util.Objects.requireNonNull(service, "service");
    }

    public static CollData parseFrame(String frame) {
        String[] fields = frame.trim().split(",", -1);
        if (fields.length != 5 || !"SHT30".equals(fields[0]))
            throw new IllegalArgumentException("需要 SHT30,温度,湿度,阈值,报警状态");
        double temperature = number(fields[1], -40, 125);
        double humidity = number(fields[2], 0, 100);
        double threshold = number(fields[3], -40, 125);
        if (!"0".equals(fields[4]) && !"1".equals(fields[4]))
            throw new IllegalArgumentException("报警状态必须为0或1");
        CollData row = new CollData();
        row.setTemp(String.format(Locale.ROOT, "%.2f", temperature));
        row.setHum(String.format(Locale.ROOT, "%.2f", humidity));
        row.setThreshold(String.format(Locale.ROOT, "%.2f", threshold));
        row.setAlarm(Integer.parseInt(fields[4]));
        return row;
    }

    private static double number(String value, double min, double max) {
        if (!value.matches("-?\\d{1,3}(\\.\\d{1,2})?"))
            throw new IllegalArgumentException("数值格式错误");
        double parsed = Double.parseDouble(value);
        if (!Double.isFinite(parsed) || parsed < min || parsed > max)
            throw new IllegalArgumentException("数值超出传感器范围");
        return parsed;
    }

    @Override
    public void channelActive(ChannelHandlerContext ctx) {
        LOG.info("采集设备已连接：{}", ctx.channel().remoteAddress());
    }

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, String frame) {
        final CollData row;
        try {
            row = parseFrame(frame);
        } catch (IllegalArgumentException ex) {
            LOG.warn("丢弃无效采集帧：{}", ex.getMessage());
            return;
        }
        if (ctx.channel().remoteAddress() instanceof InetSocketAddress) {
            InetSocketAddress remote = (InetSocketAddress) ctx.channel().remoteAddress();
            row.setIp(remote.getAddress().getHostAddress());
        } else {
            row.setIp("unknown");
        }
        row.setColltime(LocalDateTime.now().format(TIME));
        /* Database failures propagate to exceptionCaught, never masquerade as bad frames. */
        if (service.insertCollData(row) != 1) throw new IllegalStateException("采集数据未写入数据库");
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable error) {
        LOG.error("设备数据接收或入库失败", error);
        ctx.close();
    }
}
