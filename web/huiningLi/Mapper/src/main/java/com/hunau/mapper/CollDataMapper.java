package com.hunau.mapper;
import com.hunau.domain.CollData;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CollDataMapper {
    List<CollData> selectAllCollData();
    int insertCollData(CollData row);
}
