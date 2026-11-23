// Each branch supplies the questions, tags, and text available to this small editor.
export type Kind = "story" | "essay" | "ad";
export interface Passage {
  label: string;
  direction?: "rise" | "fall";
  summary: string;
  formPhrases?: [string, string, string];
  lines: [string, string, string]; // concrete detail, metaphor, simile
}
interface WritingDecision {
  question: string;
  answers: readonly string[];
}
export const storyFrameworks = {
  viewpoint: {
    source: "phsc writing center",
    url: "https://writing-center.phsc.edu/writing/literature/fiction/fiction-point-view",
    answers: [
      "first person",
      "second person",
      "third-person objective",
      "third-person limited",
      "third-person omniscient",
    ],
  },
  emotionalArc: {
    source: "reagan et al.",
    url: "https://doi.org/10.1140/epjds/s13688-016-0093-1",
    question: "which emotional arc should the story follow?",
    answers: [
      "fall then rise",
      "rise then fall",
      "rise",
      "fall",
      "rise, fall, rise",
      "fall, rise, fall",
    ],
  },
  characterArchetype: {
    source: "dramatica",
    url: "https://platform.dramatica.com/theory/book/chapters/06.html",
    question: "which archetype fits the main character?",
    answers: [
      "skeptic",
      "emotion",
      "reason",
      "sidekick",
      "guardian",
      "contagonist",
      "protagonist",
      "antagonist",
    ],
  },
} as const;
interface Version {
  label: string;
  premise: string;
  premiseDecision: WritingDecision;
  passages: Passage[];
}
interface Example {
  lens: string;
  fact: string;
  factSubject?: string;
  factDecision: WritingDecision;
  leads: [string, string];
  versions: [Version, Version];
}
function passage(
  label: string | { act: "i" | "ii" | "iii"; direction: "rise" | "fall" },
  summary: string,
  detail: string,
  metaphor: string,
  simile: string,
  formPhrases?: Passage["formPhrases"]
): Passage {
  return {
    ...(typeof label === "string"
      ? { label }
      : {
          label: `act ${label.act} · ${label.direction}`,
          direction: label.direction,
        }),
    summary,
    formPhrases,
    lines: [detail, metaphor, simile],
  };
}
export const forms = ["concrete detail", "metaphor", "simile"] as const;
export const mysteryArc =
  "rise, fall, rise" satisfies (typeof storyFrameworks.emotionalArc.answers)[number];
export const examples: Record<Kind, Example> = {
  story: {
    lens: "genre",
    fact: "archetype",
    factSubject: "nell",
    factDecision: storyFrameworks.characterArchetype,
    leads: [
      "nell wrote down the time to the minute.",
      "nell liked to think letters knew their way home.",
    ],
    versions: [
      {
        label: "mystery",
        premise:
          "on the morning a village postbox is sealed, nell finds a fresh letter inside it.",
        premiseDecision: storyFrameworks.emotionalArc,
        passages: [
          passage(
            { act: "i", direction: "rise" },
            "nell thinks everyone has forgotten her last collection until she hears a letter land.",
            "the slot was bolted shut. inside, an envelope hit the tin floor. someone had remembered her last collection.",
            "the sealed postbox cleared its throat. nell grinned. someone had remembered her last collection.",
            "the envelope hit the floor of the sealed box like a knuckle tapping tin. someone had remembered her last collection.",
            [
              "hit the tin floor",
              "cleared its throat",
              "like a knuckle tapping tin",
            ]
          ),
          passage(
            { act: "ii", direction: "fall" },
            "a floury print leads her to the bakery, where nobody has come to say goodbye.",
            "a floury thumbprint led her next door. she had pictured the whole village squeezed into the bakery. the baker was stacking chairs.",
            "the white thumbprint was a signpost to the bakery. nell went expecting a crowd and found the baker stacking chairs.",
            "the flour on the flap lay in ridges like the dust on the baker’s sleeves. behind him, every chair was empty."
          ),
          passage(
            { act: "iii", direction: "rise" },
            "the baker shows her the sorting hatch. inside the envelope, every house on her route has signed.",
            "the baker slid a tray aside and showed her the old sorting hatch. “go on, open it.” inside, in delivery order, was a signature from every house on her route.",
            "the hatch behind the bread trays was the postbox’s second mouth. nell opened the envelope. every house on her route had signed.",
            "a square of wall swung open like a cupboard door. “that’s how i posted it,” he said. nell unfolded a goodbye signed by every house on her route."
          ),
        ],
      },
      {
        label: "ghost story",
        premise:
          "when nell seals the village postbox, a letter in her late mother’s hand slips out.",
        premiseDecision: storyFrameworks.emotionalArc,
        passages: [
          passage(
            "arrival",
            "nell recognizes the handwriting.",
            "the envelope caught on the lip. nobody else crossed a t quite that low.",
            "that low cross on the t was her mother’s fingerprint.",
            "the low cross on the t tilted like the brim of her mother’s hat."
          ),
          passage(
            "request",
            "the letter asks for a reply.",
            "inside were five words. did the pear tree take?",
            "the five words were an open door. did the pear tree take?",
            "the question sounded like her voice through the back screen. did the pear tree take?"
          ),
          passage(
            "reply",
            "nell sends a blossom back.",
            "nell folded a pear blossom in the envelope. by morning there was only its scent in the box.",
            "the blossom was nell’s whole reply. by morning the envelope was gone.",
            "nell slipped in a blossom like a small white yes. the box was empty by breakfast."
          ),
        ],
      },
    ],
  },
  essay: {
    lens: "structure",
    fact: "reader",
    factDecision: {
      question: "who is the reader?",
      answers: [
        "renter",
        "landlord",
        "student",
        "homeowner",
        "housemate",
        "neighbor",
      ],
    },
    leads: [
      "suppose you rent the flat upstairs.",
      "suppose you own a flat across town.",
    ],
    versions: [
      {
        label: "worked example",
        premise:
          "a spare key helps only when someone can reach it from the other side of the door.",
        premiseDecision: {
          question: "what should the spare key protect against?",
          answers: [
            "a lockout",
            "a lost key ring",
            "a broken key",
            "an emergency while away",
          ],
        },
        passages: [
          passage(
            "case",
            "a locked door tests the spare.",
            "you shut the door. both keys are in the kitchen.",
            "the latch is a pop quiz. both answers are in the kitchen.",
            "the latch clicks like a stopwatch. both keys are inside."
          ),
          passage(
            "test",
            "try the same accident with a neighbor holding a key.",
            "give the spare to a neighbor. repeat the accident and count the doors you can open.",
            "a neighbor becomes your second way in.",
            "the neighbor’s drawer works like a second entrance."
          ),
          passage(
            "rule",
            "store the spare outside the failure it covers.",
            "before you cut another copy, ask who can reach it when you cannot.",
            "a good backup is an exit from the original problem.",
            "keep a spare like a fire exit, reachable when the usual route fails."
          ),
        ],
      },
      {
        label: "analogy",
        premise:
          "a spare key and a backup drive share a weakness when both copies sit behind the same door.",
        premiseDecision: {
          question: "what should the reader do about backups?",
          answers: [
            "move a copy off-site",
            "test a recovery",
            "look for shared risks",
            "give someone else access",
          ],
        },
        passages: [
          passage(
            "image",
            "put both keys on one ring.",
            "a locksmith gives you two keys. you thread both onto one ring.",
            "the ring is one point of failure dressed as two keys.",
            "the new key follows the old one like a shadow."
          ),
          passage(
            "parallel",
            "picture a backup in the same bag.",
            "now put a laptop and its backup drive in the same bag. leave the bag on the train.",
            "the laptop bag is another key ring. leave it on the train and both copies go.",
            "the drive disappears with the laptop like two keys on one ring."
          ),
          passage(
            "rule",
            "separate the copies that can fail together.",
            "put the second copy somewhere the first accident cannot reach.",
            "give each copy a different fate.",
            "store the backup like a spare key held by a neighbor."
          ),
        ],
      },
    ],
  },
  ad: {
    lens: "framework",
    fact: "audience",
    factDecision: {
      question: "who is the audience?",
      answers: [
        "commuter",
        "traveler",
        "parent",
        "student",
        "cyclist",
        "neighbor",
      ],
    },
    leads: [
      "the platform doors are closing.",
      "you are already halfway to the airport.",
    ],
    versions: [
      {
        label: "problem–solution",
        premise:
          "a return tag helps a stranger get your keys back to you without printing your address.",
        premiseDecision: {
          question: "which worry should the ad lead with?",
          answers: [
            "losing the keys for good",
            "exposing a home address",
            "paying for new locks",
            "being stranded outside",
          ],
        },
        passages: [
          passage(
            "problem",
            "a finder has keys and no way to reach you.",
            "someone finds your keys on a bench. who should they call?",
            "your keys are a letter with no return address.",
            "a loose key ring is like a lost parcel with its label torn off."
          ),
          passage(
            "solution",
            "a scan opens a private message.",
            "scan the tag to send the owner a message. their home address stays off the ring.",
            "the tag is a private line from the bench to your pocket.",
            "the tag works like a doorbell you can answer anywhere."
          ),
          passage(
            "invitation",
            "give the next finder a way to help.",
            "clip a return loop to your keys.",
            "give your keys a route home. add return loop.",
            "clip it on like a luggage tag for your keys."
          ),
        ],
      },
      {
        label: "before–after–bridge",
        premise:
          "turn a stranger who finds your keys into someone who can tell you where they are.",
        premiseDecision: {
          question: "what moment should the ad promise?",
          answers: [
            "hearing from the finder",
            "getting home on time",
            "canceling the locksmith",
            "holding your keys again",
          ],
        },
        passages: [
          passage(
            "before",
            "the key bowl is empty.",
            "you check the bowl twice. then every pocket.",
            "the empty bowl is the start of a long evening.",
            "you retrace your route like a detective working backward."
          ),
          passage(
            "after",
            "a message says where to collect them.",
            "a message lights up your phone. keys at the station desk.",
            "three words are your way home. station desk, upstairs.",
            "the message feels like hearing the latch turn."
          ),
          passage(
            "bridge",
            "a return tag connects you to the finder.",
            "give the next finder a way to reach you. attach a return loop.",
            "return loop is the introduction between you and your finder.",
            "return loop works like a forwarding address for your keys."
          ),
        ],
      },
    ],
  },
};
