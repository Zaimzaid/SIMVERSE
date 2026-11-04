import type { Metadata } from "next";
import { AfterchoiceCampaignGame } from "@/components/afterchoice/campaign-game";

export const metadata: Metadata = {
  title: "AFTERCHOICE — Three-Night Campaign",
  description: "An interconnected, three-round strategy campaign with delayed consequences and an adaptive challenger.",
};

export default function AfterchoiceCampaignPage() {
  return <AfterchoiceCampaignGame />;
}
