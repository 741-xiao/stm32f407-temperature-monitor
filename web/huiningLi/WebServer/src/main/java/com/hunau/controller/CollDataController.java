package com.hunau.controller;

import com.hunau.domain.CollData;
import com.hunau.service.CollDataService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import java.util.List;

@Controller
public class CollDataController {
    private final CollDataService service;
    @Value("${sensor.developer-name}") private String developerName;
    @Value("${sensor.student-id}") private String studentId;

    public CollDataController(CollDataService service) { this.service = service; }

    @GetMapping({"/", "/index"})
    public String index(Model model) {
        model.addAttribute("developerName", developerName);
        model.addAttribute("studentId", studentId);
        return "index";
    }

    @GetMapping("/chart")
    public String chart(Model model) {
        model.addAttribute("developerName", developerName);
        model.addAttribute("studentId", studentId);
        return "chart";
    }

    @ResponseBody
    @GetMapping("/selectAllCollData")
    public List<CollData> selectAllCollData() { return service.selectAllCollData(); }
}
