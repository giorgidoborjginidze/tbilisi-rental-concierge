export { runMatching } from "./engine";
export { passesHardGates } from "./gates";
export { dedupeListings, dedupeKey } from "./dedupe";
export {
  scoreListing,
  districtScore,
  priceHeadroomScore,
  furnishedScore,
  heatingScore,
  petsScore,
  recencyScore,
  daysBetween,
} from "./score";
export type {
  MatchableListing,
  MatchOptions,
  MatchResult,
  MatchReason,
  ScoredListing,
  SoftSignalKey,
} from "./types";
export { DEFAULT_WEIGHTS } from "./types";
