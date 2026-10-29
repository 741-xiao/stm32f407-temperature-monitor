package com.hunau.service.impl;
import com.hunau.domain.CollData;
import com.hunau.mapper.CollDataMapper;
import com.hunau.service.CollDataService;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CollDataServiceImpl implements CollDataService {
    private final CollDataMapper mapper;
    public CollDataServiceImpl(CollDataMapper mapper) { this.mapper = mapper; }
    public List<CollData> selectAllCollData() { return mapper.selectAllCollData(); }
    public int insertCollData(CollData row) { return mapper.insertCollData(row); }
}
