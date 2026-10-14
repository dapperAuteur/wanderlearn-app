import { describe, expect, it } from "vitest";
import { isToursOrder, orderTours } from "./tours-order";

const t = (name: string, day: number, indexPosition: number | null = null) => ({
  name,
  createdAt: new Date(2026, 0, day),
  indexPosition,
});
const tours = [t("patina gallery", 3), t("Nkyinkyim Museum", 1, 2), t("Ábaco House", 5), t("MO-CON 2026", 2, 1)];
const names = (list: { name: string }[]) => list.map((x) => x.name);

describe("orderTours", () => {
  it("A to Z ignores case and accents", () => {
    expect(names(orderTours(tours, "name_asc"))).toEqual(["Ábaco House", "MO-CON 2026", "Nkyinkyim Museum", "patina gallery"]);
  });
  it("Z to A", () => {
    expect(names(orderTours(tours, "name_desc"))).toEqual(["patina gallery", "Nkyinkyim Museum", "MO-CON 2026", "Ábaco House"]);
  });
  it("newest and oldest first", () => {
    expect(names(orderTours(tours, "created_desc"))[0]).toBe("Ábaco House");
    expect(names(orderTours(tours, "created_asc"))[0]).toBe("Nkyinkyim Museum");
  });
  it("custom puts placed tours first in their order, then the rest newest first", () => {
    expect(names(orderTours(tours, "custom"))).toEqual(["MO-CON 2026", "Nkyinkyim Museum", "Ábaco House", "patina gallery"]);
  });
  it("does not mutate the input", () => {
    const copy = [...tours];
    orderTours(tours, "name_asc");
    expect(tours).toEqual(copy);
  });
});

describe("isToursOrder", () => {
  it("accepts the five orders and nothing else", () => {
    expect(isToursOrder("custom")).toBe(true);
    expect(isToursOrder("random")).toBe(false);
    expect(isToursOrder(null)).toBe(false);
  });
});
