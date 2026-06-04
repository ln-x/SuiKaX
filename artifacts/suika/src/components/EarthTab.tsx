import React, { useState } from "react";
import { useGetEarthFeeds } from "@workspace/api-client-react";
import type { EarthEvent } from "@workspace/api-client-react";
import { Globe, AlertTriangle, Newspaper, RefreshCw, ExternalLink } from "lucide-react";

type FeedType = "all" | "disasters" | "news";

export function EarthTab() {
  const [feedType, setFeedType] = useState<FeedType>("all");

  const { data, isLoading, error, refetch, isFetching } = useGetEarthFeeds();

  const allItems: EarthEvent[] = data ?? [];
  const items =
    feedType === "all"
      ? allItems
      : allItems.filter((e) =>
          feedType === "disasters" ? e.type === "disaster" : e.type !== "disaster"
        );

  const severityColor = (sev?: string) => {
    if (!sev) return "text-muted-foreground";
    const s = sev.toLowerCase();
    if (s === "red" || s === "extreme" || s === "critical") return "text-red-400";
    if (s === "orange" || s === "severe" || s === "high") return "text-orange-400";
    if (s === "yellow" || s === "moderate") return "text-yellow-400";
    return "text-blue-400";
  };

  const typeIcon = (type?: string) => {
    if (type === "disaster") return <AlertTriangle size={14} className="shrink-0" />;
    return <Newspaper size={14} className="shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-primary" />
          <h2 className="text-lg font-semibold">Earth Feeds</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-full hover:bg-card transition-colors disabled:opacity-40"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex gap-2 px-4 pb-4">
        {(["all", "disasters", "news"] as FeedType[]).map((t) => (
          <button
            key={t}
            onClick={() => setFeedType(t)}
            className={`px-3 py-1 rounded-full text-xs capitalize border transition-colors ${
              feedType === t
                ? "bg-primary text-white border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 animate-pulse h-20 border border-border/40" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-muted-foreground text-center py-12 text-sm">
            <AlertTriangle size={24} className="mx-auto mb-3 text-orange-400" />
            Unable to load feeds. Tap refresh to try again.
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="text-muted-foreground text-center py-12 text-sm">
            No events found right now.
          </div>
        )}

        {items.map((item, i) => (
          <div key={item.id ?? i} className="bg-card rounded-xl p-4 border border-border/40">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${severityColor(item.severity)}`}>
                {typeIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {item.countries && item.countries.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {item.countries.join(", ")}
                    </span>
                  )}
                  {item.severity && (
                    <span className={`text-xs font-medium ${severityColor(item.severity)}`}>
                      {item.severity}
                    </span>
                  )}
                  {item.publishedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-primary"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
