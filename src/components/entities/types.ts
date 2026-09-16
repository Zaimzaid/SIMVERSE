/** Shared client-side types for the entity editor components. */

/** One attribute assignment as edited in the form; value is a raw string ("" clears it). */
export interface AttributeAssignment {
  attributeDefinitionId: string;
  value: string;
}

/** One flexible key/value pair for an entity's Additional Info (metadata). */
export interface MetadataPair {
  /** stable local id for React keys */
  id: string;
  key: string;
  value: string;
}
