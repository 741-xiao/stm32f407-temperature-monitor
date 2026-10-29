package com.hunau;

import com.hunau.netty.TcpServer;
import com.hunau.service.CollDataService;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
@MapperScan("com.hunau.mapper")
public class WebServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(WebServerApplication.class, args);
    }

    @Bean(initMethod = "start", destroyMethod = "close")
    public TcpServer tcpServer(CollDataService service, @Value("${sensor.tcp-port:5107}") int port) {
        return new TcpServer(port, service);
    }
}
