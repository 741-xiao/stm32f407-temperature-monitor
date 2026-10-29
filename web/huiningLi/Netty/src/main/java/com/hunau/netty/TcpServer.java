package com.hunau.netty;

import com.hunau.service.CollDataService;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.Channel;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.DelimiterBasedFrameDecoder;
import io.netty.handler.codec.Delimiters;
import io.netty.handler.codec.string.StringDecoder;
import io.netty.util.CharsetUtil;
import io.netty.util.concurrent.DefaultEventExecutorGroup;

public class TcpServer implements AutoCloseable {
    private final int port;
    private final CollDataService service;
    private EventLoopGroup boss;
    private EventLoopGroup workers;
    private DefaultEventExecutorGroup databaseWorkers;
    private Channel channel;

    public TcpServer(int port, CollDataService service) {
        this.port = port;
        this.service = java.util.Objects.requireNonNull(service, "service");
    }

    public void start() throws InterruptedException {
        boss = new NioEventLoopGroup(1);
        workers = new NioEventLoopGroup(2);
        databaseWorkers = new DefaultEventExecutorGroup(2);
        try {
            channel = new ServerBootstrap().group(boss, workers)
                .channel(NioServerSocketChannel.class)
                .childOption(ChannelOption.SO_KEEPALIVE, true)
                .childHandler(new ChannelInitializer<SocketChannel>() {
                    @Override protected void initChannel(SocketChannel socket) {
                        socket.pipeline()
                            .addLast(new DelimiterBasedFrameDecoder(128, Delimiters.lineDelimiter()))
                            .addLast(new StringDecoder(CharsetUtil.UTF_8))
                            .addLast(databaseWorkers, new TcpServerHandler(service));
                    }
                }).bind(port).sync().channel();
        } catch (InterruptedException | RuntimeException ex) {
            close();
            throw ex;
        }
    }

    @Override public void close() {
        if (channel != null) channel.close().syncUninterruptibly();
        if (workers != null) workers.shutdownGracefully().syncUninterruptibly();
        if (databaseWorkers != null) databaseWorkers.shutdownGracefully().syncUninterruptibly();
        if (boss != null) boss.shutdownGracefully().syncUninterruptibly();
    }
}
