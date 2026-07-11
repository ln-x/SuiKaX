import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { EoNewsCard } from "../components/EarthTab";
import type { EarthEvent } from "@workspace/api-client-react";

const baseItem: EarthEvent = {
  id: "test-1",
  title: "Test EO News Item",
  type: "eo-news",
  severity: "low",
  source: "NASA EONET",
  publishedAt: new Date().toISOString(),
  description: null,
  url: "https://example.com",
  imageUrl: null,
};

const itemWithBrokenImage: EarthEvent = {
  ...baseItem,
  id: "broken-img",
  imageUrl: "http://localhost:9999/nonexistent-image-that-will-404.jpg",
};

const itemWithGoodImage: EarthEvent = {
  ...baseItem,
  id: "good-img",
  imageUrl: "https://example.com/real-image.jpg",
};

describe("EoNewsCard — broken image URL", () => {
  it("shows the skeleton and image container on initial render when imageUrl is set", () => {
    render(<EoNewsCard item={itemWithBrokenImage} />);

    expect(screen.getByTestId("eo-news-image-container")).toBeInTheDocument();
    expect(screen.getByTestId("eo-news-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("eo-news-img")).toBeInTheDocument();
  });

  it("removes the image container and skeleton when the image errors", () => {
    render(<EoNewsCard item={itemWithBrokenImage} />);

    const img = screen.getByTestId("eo-news-img");
    fireEvent.error(img);

    expect(screen.queryByTestId("eo-news-image-container")).not.toBeInTheDocument();
    expect(screen.queryByTestId("eo-news-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByTestId("eo-news-img")).not.toBeInTheDocument();
  });

  it("still renders the card title and text content after an image error", () => {
    render(<EoNewsCard item={itemWithBrokenImage} />);

    const img = screen.getByTestId("eo-news-img");
    fireEvent.error(img);

    expect(screen.getByText("Test EO News Item")).toBeInTheDocument();
    expect(screen.getByTestId("eo-news-card")).toBeInTheDocument();
  });

  it("renders no image container at all when imageUrl is null", () => {
    render(<EoNewsCard item={baseItem} />);

    expect(screen.queryByTestId("eo-news-image-container")).not.toBeInTheDocument();
    expect(screen.queryByTestId("eo-news-skeleton")).not.toBeInTheDocument();
  });

  it("surrounding cards are unaffected when the middle card errors", () => {
    const { container } = render(
      <div>
        <EoNewsCard item={{ ...baseItem, id: "before", title: "Card Before" }} />
        <EoNewsCard item={{ ...itemWithBrokenImage, title: "Broken Card" }} />
        <EoNewsCard item={{ ...baseItem, id: "after", title: "Card After" }} />
      </div>
    );

    const cards = screen.getAllByTestId("eo-news-card");
    expect(cards).toHaveLength(3);

    const brokenImg = screen.getByTestId("eo-news-img");
    fireEvent.error(brokenImg);

    const cardsAfter = screen.getAllByTestId("eo-news-card");
    expect(cardsAfter).toHaveLength(3);

    expect(within(cardsAfter[0]).getByText("Card Before")).toBeInTheDocument();
    expect(within(cardsAfter[1]).getByText("Broken Card")).toBeInTheDocument();
    expect(within(cardsAfter[2]).getByText("Card After")).toBeInTheDocument();

    expect(screen.queryByTestId("eo-news-image-container")).not.toBeInTheDocument();
  });

  it("does not leave a residual h-36 container after image error", () => {
    const { container } = render(<EoNewsCard item={itemWithBrokenImage} />);

    const img = screen.getByTestId("eo-news-img");
    fireEvent.error(img);

    const h36Elements = container.querySelectorAll(".h-36");
    expect(h36Elements).toHaveLength(0);
  });
});

describe("EoNewsCard — successful image load", () => {
  it("hides the skeleton after the image loads", () => {
    render(<EoNewsCard item={itemWithGoodImage} />);

    expect(screen.getByTestId("eo-news-skeleton")).toBeInTheDocument();

    const img = screen.getByTestId("eo-news-img");
    fireEvent.load(img);

    expect(screen.queryByTestId("eo-news-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("eo-news-image-container")).toBeInTheDocument();
  });
});
