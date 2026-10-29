package com.hunau;

import com.hunau.domain.CollData;
import com.hunau.netty.TcpServerHandler;
import com.hunau.service.CollDataService;
import io.netty.buffer.Unpooled;
import io.netty.channel.embedded.EmbeddedChannel;
import io.netty.handler.codec.DelimiterBasedFrameDecoder;
import io.netty.handler.codec.Delimiters;
import io.netty.handler.codec.string.StringDecoder;
import io.netty.util.CharsetUtil;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class Sht30PipelineTest {
    private final List<CollData> rows = new ArrayList<>();
    private final CollDataService service = new CollDataService() {
        public List<CollData> selectAllCollData() { return rows; }
        public int insertCollData(CollData row) { rows.add(row); return 1; }
    };

    private EmbeddedChannel channel(CollDataService target) {
        return new EmbeddedChannel(new DelimiterBasedFrameDecoder(128, Delimiters.lineDelimiter()),
            new StringDecoder(CharsetUtil.UTF_8), new TcpServerHandler(target));
    }

    @Test void fragmentedAndCoalescedFramesAreStoredOnceEach() {
        EmbeddedChannel channel = channel(service);
        try {
            channel.writeInbound(Unpooled.copiedBuffer("SHT30,27.50,", CharsetUtil.UTF_8));
            assertEquals(0, rows.size());
            channel.writeInbound(Unpooled.copiedBuffer("60.00,26.00,1\r\nSHT30,25.00,58.50,26.00,0\r\n", CharsetUtil.UTF_8));
            assertEquals(2, rows.size());
            assertEquals("27.50", rows.get(0).getTemp());
            assertEquals("60.00", rows.get(0).getHum());
            assertEquals(1, rows.get(0).getAlarm());
            assertEquals(0, rows.get(1).getAlarm());
            assertNotNull(rows.get(0).getColltime());
        } finally { channel.finishAndReleaseAll(); }
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "1,2,3,4,5,6", "SHT30,25,50,26", "SHT30,NaN,50,26,0",
        "SHT30,Infinity,50,26,0", "SHT30,25,101,26,0", "SHT30,-41,50,26,0",
        "SHT30,126,50,26,0", "SHT30,25,-1,26,0", "SHT30,25,50,126,0",
        "SHT30,25,50,26,2", "SHT30,25.123,50,26,0", "SHT30,<script>,50,26,0"})
    void invalidDataIsRejected(String frame) {
        assertThrows(IllegalArgumentException.class, () -> TcpServerHandler.parseFrame(frame));
    }

    @Test void exactThresholdPreservesReportedAlarmAndChangedThreshold() {
        CollData row = TcpServerHandler.parseFrame("SHT30,28.00,50.00,28.00,1");
        assertEquals("28.00", row.getThreshold());
        assertEquals(1, row.getAlarm());
        assertEquals(0, TcpServerHandler.parseFrame("SHT30,28,50,28,0").getAlarm());
        assertEquals("-40.00", TcpServerHandler.parseFrame("SHT30,-40,0,125,0").getTemp());
        assertEquals("100.00", TcpServerHandler.parseFrame("SHT30,125,100,-40,1").getHum());
    }

    @Test void badFrameDoesNotBreakNextValidFrame() {
        EmbeddedChannel channel = channel(service);
        try {
            channel.writeInbound(Unpooled.copiedBuffer("invalid\r\nSHT30,24,40,26,0\r\n", CharsetUtil.UTF_8));
            assertEquals(1, rows.size());
            assertTrue(channel.isActive());
        } finally { channel.finishAndReleaseAll(); }
    }

    @Test void databaseFailureClosesConnectionInsteadOfClaimingSuccess() {
        CollDataService failing = new CollDataService() {
            public List<CollData> selectAllCollData() { return rows; }
            public int insertCollData(CollData row) { throw new IllegalStateException("database offline"); }
        };
        EmbeddedChannel channel = channel(failing);
        try {
            channel.writeInbound(Unpooled.copiedBuffer("SHT30,24,40,26,0\r\n", CharsetUtil.UTF_8));
            assertFalse(channel.isActive());
            assertTrue(rows.isEmpty());
        } finally { channel.finishAndReleaseAll(); }
    }
}
