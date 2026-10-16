/**
 * The design model. A design (any piece of jewellery) is one plain JSON object: what the 3D model renders,
 * what gets saved to the database, what Claude reads, and what Claude proposes changes to.
 * The pieces live in src/lib/design/; import from here.
 */
export * from "./design/vocab";
export * from "./design/styles";
export * from "./design/schema";
export * from "./design/presets";
export * from "./design/varieties";
export * from "./design/edit";
export * from "./design/dropParts";
export * from "./design/measures";
export * from "./design/describe";
export * from "./design/character";
export * from "./design/forAi";
export * from "./design/showcase";
