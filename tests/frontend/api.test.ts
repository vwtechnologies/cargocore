import { describe, it, expect } from "vitest";
import { money } from "../../resources/js/lib/api";
describe("PKR presentation", () => {
    it("preserves fixed-precision amounts beyond the JavaScript safe-integer range", () => {
        expect(money("99999999999999999.99")).toBe(
            "PKR 99,999,999,999,999,999.99",
        );
        expect(money("-0.05")).toBe("PKR -0.05");
        expect(money(null)).toBe("—");
    });
});
