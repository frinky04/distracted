import {
  IconClock,
  IconHandStop,
  IconKeyboard,
} from "@tabler/icons-react";
import type { UnlockMethod } from "@/lib/storage";
import { TimerChallenge } from "./timer";
import { HoldChallenge } from "./hold";
import { TypeChallenge } from "./type";
import type { ComponentType } from "react";

export interface ChallengeComponentProps {
  duration?: number;
  onComplete: () => void;
}

export const CHALLENGE_COMPONENTS: Record<
  UnlockMethod,
  ComponentType<ChallengeComponentProps>
> = {
  timer: TimerChallenge as ComponentType<ChallengeComponentProps>,
  hold: HoldChallenge as ComponentType<ChallengeComponentProps>,
  type: TypeChallenge as ComponentType<ChallengeComponentProps>,
};

export const CHALLENGE_METADATA: Record<
  UnlockMethod,
  {
    label: string;
    icon: React.ReactNode;
    description: string;
    title: string;
  }
> = {
  timer: {
    label: "Wait Timer",
    icon: <IconClock className="size-5" />,
    description: "Wait for a countdown to finish",
    title: "Wait to Access",
  },
  hold: {
    label: "Hold Button",
    icon: <IconHandStop className="size-5" />,
    description: "Hold a button continuously",
    title: "Hold to Access",
  },
  type: {
    label: "Type Text",
    icon: <IconKeyboard className="size-5" />,
    description: "Type a random UUID (no copy/paste)",
    title: "Type to Access",
  },
};

// Re-export components
export { TimerChallenge } from "./timer";
export { HoldChallenge } from "./hold";
export { TypeChallenge } from "./type";
