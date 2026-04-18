package com.polygon2goorm.domain.model;

import java.util.List;

public record TestSuite(
        List<TestCaseRef> tests
) {
}
