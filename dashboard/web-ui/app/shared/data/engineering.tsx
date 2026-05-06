import { architectureDeepDiveArticle } from "./engineeringArticles/architectureDeepDive";
import { mapsPerformanceArticle } from "./engineeringArticles/mapsPerformance";
import { mobileSessionReplayCostArticle } from "./engineeringArticles/mobileSessionReplayCost";
import { rejourney13MillionSessionReplaysArticle } from "./engineeringArticles/rejourney13MillionSessionReplays";
import { swiftPackageOpenBetaArticle } from "./engineeringArticles/swiftPackageOpenBeta";
import type { Article } from "./engineeringTypes";

export type { Article } from "./engineeringTypes";

export const ARTICLES: Article[] = [
    mobileSessionReplayCostArticle,
    swiftPackageOpenBetaArticle,
    rejourney13MillionSessionReplaysArticle,
    mapsPerformanceArticle,
    architectureDeepDiveArticle,
];
