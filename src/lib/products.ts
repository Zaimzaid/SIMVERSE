import {
  Bot,
  Flame,
  Landmark,
  Sprout,
  Swords,
  Volleyball,
  type LucideIcon,
} from "lucide-react";

export type ProductStatus = "In development" | "Concept" | "Planned";

export interface ProductPreview {
  name: string;
  tagline: string;
  icon: LucideIcon;
  status: ProductStatus;
  /** Tailwind gradient classes for the card's icon tile. */
  gradient: string;
}

/**
 * Product concepts shown across the platform. These are NOT built — every card
 * is explicitly labeled with its (pre-release) status. Products are a separate
 * architectural layer from the platform foundation delivered in Phase 0.
 */
export const PRODUCTS: ProductPreview[] = [
  {
    name: "Anything Wars",
    tagline: "Pit anything against anything and watch it play out.",
    icon: Swords,
    status: "In development",
    gradient: "from-accent/30 to-blue/30",
  },
  {
    name: "Robot Arena",
    tagline: "Design bots, tune behaviors, and battle for supremacy.",
    icon: Bot,
    status: "Concept",
    gradient: "from-blue/30 to-purple/30",
  },
  {
    name: "Farm Empire",
    tagline: "Grow, automate, and optimize a living economy.",
    icon: Sprout,
    status: "Concept",
    gradient: "from-success/30 to-accent/30",
  },
  {
    name: "Civilization",
    tagline: "Seed societies and simulate the rise of worlds.",
    icon: Landmark,
    status: "Planned",
    gradient: "from-warning/30 to-danger/30",
  },
  {
    name: "Survival",
    tagline: "Drop entities into harsh worlds and see who endures.",
    icon: Flame,
    status: "Planned",
    gradient: "from-danger/30 to-purple/30",
  },
  {
    name: "Sports Lab",
    tagline: "Model teams, rules, and seasons, then run the tape.",
    icon: Volleyball,
    status: "Concept",
    gradient: "from-purple/30 to-accent/30",
  },
];
