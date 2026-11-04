import type { Metadata } from "next";
import { AfterchoiceGame } from "@/components/afterchoice/game";

export const metadata: Metadata = {
  title: "AFTERCHOICE — Strategy Challenge",
  description: "Build a crisis response, anticipate disruption, and survive the consequences in KAVANDRO's original 2D strategy prototype.",
};

export default function AfterchoicePage() {
  return <AfterchoiceGame />;
}
