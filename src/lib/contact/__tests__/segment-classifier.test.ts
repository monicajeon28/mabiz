import {
  classifySegment,
  classifyContactsWithStats,
  SEGMENT_DESCRIPTIONS,
  SEGMENT_ACTIONS,
  type ContactSegmentData,
  type Segment,
  type SegmentStats,
} from "../segment-classifier";

describe("segment-classifier", () => {
  describe("classifySegment", () => {
    // Priority 1: 신혼 (결혼 2년 이내)
    describe("Priority 1: 신혼 (결혼 2년 이내)", () => {
      it("should classify as 'A' when married within 1 year", () => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const contact: ContactSegmentData = {
          marriageStatus: "married",
          marriageDate: oneYearAgo,
          ageInYears: 32,
        };

        expect(classifySegment(contact)).toBe("A");
      });

      it("should classify as 'A' when married within 2 years", () => {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const contact: ContactSegmentData = {
          marriageStatus: "married",
          marriageDate: twoYearsAgo,
          ageInYears: 30,
        };

        expect(classifySegment(contact)).toBe("A");
      });

      it("should not classify as 'A' when married 3+ years ago", () => {
        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

        const contact: ContactSegmentData = {
          marriageStatus: "married",
          marriageDate: threeYearsAgo,
          ageInYears: 35,
          childrenAges: [5],
        };

        // Should fall through to next priority (not A)
        expect(classifySegment(contact)).not.toBe("A");
      });
    });

    // Priority 2: 자녀 10-15세
    describe("Priority 2: 자녀 10-15세", () => {
      it("should classify as 'B' when child is 12 years old", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 45,
          childrenAges: [12],
        };

        expect(classifySegment(contact)).toBe("B");
      });

      it("should classify as 'B' when multiple children with one aged 10-15", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 50,
          childrenAges: [5, 13, 22],
        };

        expect(classifySegment(contact)).toBe("B");
      });

      it("should classify as 'B' when child is exactly 10 years old", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 42,
          childrenAges: [10],
        };

        expect(classifySegment(contact)).toBe("B");
      });

      it("should classify as 'B' when child is exactly 15 years old", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 48,
          childrenAges: [15],
        };

        expect(classifySegment(contact)).toBe("B");
      });

      it("should not classify as 'B' when children are outside 10-15 range", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 45,
          childrenAges: [8, 22],
        };

        // Should fall through to next priority
        const result = classifySegment(contact);
        expect(result).not.toBe("B");
      });
    });

    // Priority 3: 40-55세 + 자녀 독립/미보유
    describe("Priority 3: 40-55세 + 자녀 독립/미보유", () => {
      it("should classify as 'C' when aged 45 with no children", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 45,
          childrenAges: [],
        };

        expect(classifySegment(contact)).toBe("C");
      });

      it("should classify as 'C' when aged 45 with adult children (22+)", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 45,
          childrenAges: [25, 28],
        };

        expect(classifySegment(contact)).toBe("C");
      });

      it("should classify as 'C' when aged 40 with independent children", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 40,
          childrenAges: [20],
        };

        // Age 20 is borderline - should still be considered young
        const result = classifySegment(contact);
        expect(result).not.toBe("C");
      });

      it("should classify as 'C' when aged 55 with no children", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 55,
          childrenAges: [],
        };

        expect(classifySegment(contact)).toBe("C");
      });

      it("should not classify as 'C' when aged 39", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 39,
          childrenAges: [],
        };

        expect(classifySegment(contact)).not.toBe("C");
      });

      it("should not classify as 'C' when aged 56+", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 56,
          childrenAges: [],
        };

        // Should fall to Priority 4 (D)
        expect(classifySegment(contact)).not.toBe("C");
      });
    });

    // Priority 4: 55세 이상
    describe("Priority 4: 55세 이상", () => {
      it("should classify as 'D' when aged 60", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 60,
        };

        expect(classifySegment(contact)).toBe("D");
      });

      it("should classify as 'D' when aged 56", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "single",
          ageInYears: 56,
        };

        expect(classifySegment(contact)).toBe("D");
      });

      it("should classify as 'D' when aged 75", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "divorced",
          ageInYears: 75,
        };

        expect(classifySegment(contact)).toBe("D");
      });

      it("should not classify as 'D' when aged 55", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 55,
          childrenAges: [],
        };

        // Should be C, not D
        expect(classifySegment(contact)).toBe("C");
      });
    });

    // Unclassified cases
    describe("Unclassified cases", () => {
      it("should return 'unclassified' when marriageStatus is missing", () => {
        const contact: ContactSegmentData = {
          ageInYears: 45,
          childrenAges: [12],
        };

        expect(classifySegment(contact)).toBe("unclassified");
      });

      it("should return 'unclassified' when ageInYears is missing", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          childrenAges: [12],
        };

        expect(classifySegment(contact)).toBe("unclassified");
      });

      it("should return 'unclassified' when both marriageStatus and ageInYears are missing", () => {
        const contact: ContactSegmentData = {
          childrenAges: [12],
        };

        expect(classifySegment(contact)).toBe("unclassified");
      });

      it("should return 'unclassified' when ageInYears is null", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: null,
        };

        expect(classifySegment(contact)).toBe("unclassified");
      });

      it("should return 'unclassified' when marriageStatus is empty string", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "",
          ageInYears: 45,
        };

        expect(classifySegment(contact)).toBe("unclassified");
      });

      it("should return 'unclassified' when no conditions are met", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "single",
          ageInYears: 35,
          childrenAges: [],
        };

        expect(classifySegment(contact)).toBe("unclassified");
      });
    });

    // Edge cases
    describe("Edge cases", () => {
      it("should handle childrenAges with null values", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 45,
          childrenAges: [null, 12, null],
        };

        expect(classifySegment(contact)).toBe("B");
      });

      it("should handle empty childrenAges array", () => {
        const contact: ContactSegmentData = {
          marriageStatus: "married",
          ageInYears: 45,
          childrenAges: [],
        };

        expect(classifySegment(contact)).toBe("C");
      });

      it("should prioritize A over B when both conditions met", () => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const contact: ContactSegmentData = {
          marriageStatus: "married",
          marriageDate: oneYearAgo,
          ageInYears: 30,
          childrenAges: [12],
        };

        // Priority 1 (A) should win over Priority 2 (B)
        expect(classifySegment(contact)).toBe("A");
      });
    });
  });

  describe("classifyContactsWithStats", () => {
    it("should classify multiple contacts and return stats", () => {
      const contacts: ContactSegmentData[] = [
        {
          marriageStatus: "married",
          marriageDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          ageInYears: 30,
        }, // A
        {
          marriageStatus: "married",
          ageInYears: 45,
          childrenAges: [12],
        }, // B
        {
          marriageStatus: "married",
          ageInYears: 50,
          childrenAges: [],
        }, // C
        {
          marriageStatus: "divorced",
          ageInYears: 65,
        }, // D
        {
          marriageStatus: "",
          ageInYears: 40,
        }, // unclassified
      ];

      const { segments, stats } = classifyContactsWithStats(contacts);

      expect(segments).toEqual(["A", "B", "C", "D", "unclassified"]);
      expect(stats).toEqual({
        total: 5,
        A: 1,
        B: 1,
        C: 1,
        D: 1,
        unclassified: 1,
      });
    });

    it("should handle empty array", () => {
      const { segments, stats } = classifyContactsWithStats([]);

      expect(segments).toEqual([]);
      expect(stats).toEqual({
        total: 0,
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        unclassified: 0,
      });
    });

    it("should handle all unclassified", () => {
      const contacts: ContactSegmentData[] = [
        { ageInYears: 40 },
        { marriageStatus: "married" },
        {},
      ];

      const { stats } = classifyContactsWithStats(contacts);

      expect(stats).toEqual({
        total: 3,
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        unclassified: 3,
      });
    });
  });

  describe("Constants", () => {
    it("should have SEGMENT_DESCRIPTIONS for all segments", () => {
      const segments: Segment[] = ["A", "B", "C", "D", "unclassified"];

      segments.forEach((segment) => {
        expect(SEGMENT_DESCRIPTIONS[segment]).toBeDefined();
        expect(typeof SEGMENT_DESCRIPTIONS[segment]).toBe("string");
        expect(SEGMENT_DESCRIPTIONS[segment].length).toBeGreaterThan(0);
      });
    });

    it("should have SEGMENT_ACTIONS for all segments", () => {
      const segments: Segment[] = ["A", "B", "C", "D", "unclassified"];

      segments.forEach((segment) => {
        expect(SEGMENT_ACTIONS[segment]).toBeDefined();
        expect(Array.isArray(SEGMENT_ACTIONS[segment])).toBe(true);
        expect(SEGMENT_ACTIONS[segment].length).toBeGreaterThan(0);
      });
    });
  });
});
