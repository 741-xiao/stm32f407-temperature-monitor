package com.hunau.service;
import com.hunau.domain.CollData;
import java.util.List;

public interface CollDataService {
    List<CollData> selectAllCollData();
    int insertCollData(CollData row);
}
