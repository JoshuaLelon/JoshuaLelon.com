// Curated references for this walkthrough. Examples apply each concept to the draft.
import { storyFrameworks } from "./writingExamples";

type Source = { name: string; url?: string };
export type Help = { definition: string; example?: string; source: Source };
type Entry = readonly [definition: string, example: string];

const vocabulary: Source = {
  name: "library of congress · genre/form vocabulary",
  url: "https://www.loc.gov/aba/publications/FreeLCGFT/freelcgft.html",
};
const arcs: Source = {
  name: "reagan et al. · six emotional arcs",
  url: storyFrameworks.emotionalArc.url,
};
const archetypes: Source = {
  name: "dramatica · eight archetypal characters",
  url: storyFrameworks.characterArchetype.url,
};
const rhetoric: Source = {
  name: "silva rhetoricae · figures of speech",
  url: "https://rhetoric.byu.edu/",
};
const editor: Source = { name: "this editor · drafting controls" };
const brief: Source = { name: "the example writing briefs" };

const reference = new Map<string, Help>();
function glossary(source: Source, entries: Record<string, Entry>) {
  for (const [term, [definition, example]] of Object.entries(entries))
    reference.set(term, { source, definition, example });
}

glossary(vocabulary, {
  "what are you making?": [
    "form describes what kind of work the reader will encounter. it shapes what the editor asks next.",
    "the same postbox could anchor a story, a poem, or a speech.",
  ],
  story: [
    "a narrative in which events unfold and something changes.",
    "nell finds a letter in a sealed postbox and sets out to learn who sent it.",
  ],
  essay: [
    "a piece of prose that explores an idea or develops a claim.",
    "why does losing the village postbox matter when everyone has a phone?",
  ],
  ad: [
    "a message intended to persuade an audience to take an action.",
    "send one last letter before the village postbox closes.",
  ],
  poem: [
    "a work that uses sound, rhythm, imagery, or line breaks to concentrate attention.",
    "one red box / keeps the shape / of a thousand goodbyes.",
  ],
  speech: [
    "words composed to be spoken to listeners.",
    "at the closing ceremony, nell tells her neighbors about the first letter she posted.",
  ],
  script: [
    "a text written for performance, with dialogue and cues for action.",
    "nell bolts the slot. a soft thud. she turns.",
  ],
  letter: [
    "a written message addressed to a particular recipient.",
    "dear nell, did the pear tree take?",
  ],
  "which genre?": [
    "genre groups stories by conventions readers recognize, such as a central puzzle or a supernatural presence.",
    "the same envelope can be a clue in a mystery or a visit from the dead in a ghost story.",
  ],
  adventure: [
    "a story built around a risky undertaking or journey.",
    "nell follows the last mail route across a flooded valley.",
  ],
  romance: [
    "a story centered on a developing love relationship.",
    "two strangers trade letters through the box before meeting at its closing.",
  ],
  fantasy: [
    "a story in which magic or an invented world shapes what can happen.",
    "the postbox delivers letters to any day its keeper names.",
  ],
  thriller: [
    "a story that sustains suspense as danger gets closer.",
    "a letter gives nell an hour to find a missing courier.",
  ],
  mystery: [
    "a story organized around a puzzle whose answer emerges through clues.",
    "a floury thumbprint tells nell where the letter came from.",
  ],
  "ghost story": [
    "a story in which a haunting or a possible encounter with the dead shapes the action.",
    "the envelope that slips out bears her late mother’s handwriting.",
  ],
  "historical fiction": [
    "fiction set in a past period whose circumstances shape the characters’ lives.",
    "wartime censorship forces nell to hide the real message between the lines.",
  ],
  comedy: [
    "a story that creates amusement through its characters, situations, or timing.",
    "everyone at the ceremony insists the anonymous love letter must be for them.",
  ],
});
glossary(arcs, {
  [storyFrameworks.emotionalArc.question]: [
    "an emotional arc traces how the feeling of a story changes from beginning to end. reagan and colleagues found six recurring shapes by studying the emotional tone of fiction.",
    "a letter can bring dread or relief. the arc describes how those feelings unfold across the story.",
  ],
  "fall then rise": [
    "the story grows more painful before turning toward hope.",
    "recognizing the handwriting makes nell miss her mother all over again. by morning, her mother has answered.",
  ],
  "rise then fall": [
    "hope builds before giving way to loss.",
    "nell discovers she can write to her mother again. then the postbox is taken away.",
  ],
  rise: [
    "the emotional tone grows more positive overall.",
    "a familiar greeting comforts nell. each letter makes her feel a little less alone.",
  ],
  fall: [
    "the emotional tone grows more negative overall.",
    "the first letter hints at a loss. each one after it confirms what nell feared.",
  ],
  "rise, fall, rise": [
    "an initial gain gives way to a setback and a final recovery.",
    "a reply arrives. the box is sealed. then nell hears the letter slot in her own door lift.",
  ],
  "fall, rise, fall": [
    "a setback gives way to hope before a final loss.",
    "nell attends the funeral, then finds a letter in her mother’s hand. its last line says goodbye.",
  ],
});
glossary(archetypes, {
  [storyFrameworks.characterArchetype.question]: [
    "an archetype here is a role a character plays in the story’s central effort. dramatica describes eight such roles.",
    "nell can question every clue as the skeptic, or help someone else follow the trail as the sidekick.",
  ],
  skeptic: [
    "questions a claim or doubts that a proposed course will work.",
    "nell compares the ink against an old birthday card before accepting who signed the letter.",
  ],
  emotion: [
    "acts on feeling and responds to events from the heart.",
    "nell writes back the instant she recognizes the hand.",
  ],
  reason: [
    "relies on logic to decide what to do.",
    "nell lists everyone with a key and checks their routes.",
  ],
  sidekick: [
    "gives another character loyalty and support.",
    "nell keeps watch while the young courier tests his unlikely theory.",
  ],
  guardian: [
    "offers guidance or protection as someone pursues a goal.",
    "nell teaches the new carrier which old sorting hatches are still safe.",
  ],
  contagonist: [
    "tempts someone away from their course or puts obstacles in their way.",
    "nell offers the courier an easier way out if he leaves the letter unopened.",
  ],
  protagonist: [
    "drives the effort to achieve the story’s central goal.",
    "nell tracks the last delivery herself so the rightful recipient gets the letter.",
  ],
  antagonist: [
    "opposes the effort to achieve the story’s central goal.",
    "when the courier tries to deliver the letter, nell bolts the hatch.",
  ],
});
glossary(rhetoric, {
  "which rhetorical form?": [
    "a rhetorical device changes how words make an impression. writers can express the same event through comparison, emphasis, or repetition.",
    "the envelope can strike the tin, or land like a knuckle tapping it.",
  ],
  metaphor: [
    "describes one thing in terms of another.",
    "the sealed postbox was the village’s last ear.",
  ],
  simile: [
    "makes a comparison explicit, often using “like” or “as.”",
    "the envelope hit the floor like a knuckle tapping tin.",
  ],
  personification: [
    "gives something nonhuman a human action or quality.",
    "the sealed postbox cleared its throat.",
  ],
  understatement: [
    "deliberately downplays something to create an effect.",
    "a letter from her dead mother was a little out of the ordinary.",
  ],
  repetition: [
    "repeats a word or phrase to give it weight or rhythm.",
    "she checked the date. checked the stamp. checked the hand.",
  ],
  hyperbole: [
    "exaggerates deliberately for emphasis.",
    "the whole village could have heard that envelope land.",
  ],
});
glossary(
  {
    name: storyFrameworks.viewpoint.source,
    url: storyFrameworks.viewpoint.url,
  },
  {
    "which point of view?": [
      "point of view determines who tells the story and whose thoughts the reader can hear.",
      "nell can tell the story herself, or a narrator can follow her until she discovers the hatch.",
    ],
    "point of view": [
      "choose whose perceptions reach the reader.",
      "follow nell’s suspicions or let the reader in on the baker’s plan.",
    ],
    "first person": [
      "a character tells the story as “i.”",
      "i held the key. i knew that slot was bolted.",
    ],
    "second person": [
      "the narration addresses a character as “you.”",
      "you turn the key and hear an envelope land.",
    ],
    "third-person objective": [
      "a narrator reports observable actions and speech.",
      "nell tried the bolt twice. the baker wiped flour from his hands.",
    ],
    "third-person limited": [
      "a narrator follows one character’s perceptions and thoughts.",
      "nell could hear the envelope. how had it got past the bolt?",
    ],
    "third-person omniscient": [
      "a narrator can reveal what several characters know or think.",
      "nell feared a trick. behind the wall, the baker hoped she would smile.",
    ],
  }
);
glossary(editor, {
  "concrete detail": [
    "name something the reader can picture, hear, or otherwise sense.",
    "the envelope hit the tin floor.",
  ],
});
glossary(brief, {
  "which structure?": [
    "structure organizes an essay’s reasoning.",
    "test a spare key with a worked example, or compare it with a backup drive.",
  ],
  comparison: [
    "set two cases alongside each other to show a consequential difference.",
    "compare a spare in the kitchen with a spare held by a neighbor.",
  ],
  argument: [
    "arrange claims and evidence in support of a conclusion.",
    "show why a second key only helps if it is reachable.",
  ],
  chronology: [
    "arrange events in time order.",
    "follow the renter from cutting a spare to the day the door locks behind her.",
  ],
  "worked example": [
    "walk the reader through a concrete case step by step.",
    "lock the door, locate the spare, and see who can get in.",
  ],
  analogy: [
    "use one familiar relationship to explain another.",
    "a spare on the same ring is like a backup drive in the same laptop bag.",
  ],
  "which framework?": [
    "a copywriting framework organizes the sequence of a pitch.",
    "start with a finder’s problem, then explain how a return tag solves it.",
  ],
  testimonial: [
    "let a customer’s experience carry the pitch.",
    "a commuter recounts how the tag helped recover a lost key ring.",
  ],
  "before and after": [
    "contrast the customer’s situation on either side of using the product.",
    "from retracing every step to finding a message at the station.",
  ],
  demonstration: [
    "show the product doing its job.",
    "a finder scans the tag and sends the owner a message.",
  ],
  "problem–solution": [
    "introduce a difficulty, then show how the product addresses it.",
    "a finder has no way to contact you until they scan your tag.",
  ],
  "before–after–bridge": [
    "describe the current problem, picture a better outcome, and connect them with the product.",
    "keys missing, a message with their location, and the tag that made it possible.",
  ],
  "who is the reader?": [
    "identify whose situation the essay should address.",
    "a renter and a landlord have different reasons to need a spare.",
  ],
  "who is the audience?": [
    "choose the person whose needs shape the pitch.",
    "a commuter may need keys back before the next train.",
  ],
});
glossary(brief, {
  "what should the spare key protect against?": [
    "choose the failure the spare must still work through. this sets up the essay’s test case.",
    "lock the door while both keys are inside, then try it again with a spare held next door.",
  ],
  "what should the reader do about backups?": [
    "choose the practical conclusion that the key-and-drive analogy should lead to.",
    "end with a test the reader can try on their own files.",
  ],
  "which worry should the ad lead with?": [
    "pick the cost of losing the keys that the opening should make tangible.",
    "a locksmith bill makes a different opening than a stranger finding an address on the ring.",
  ],
  "what moment should the ad promise?": [
    "choose the specific result the reader should be able to picture.",
    "a message saying “station desk” makes the benefit of the tag visible.",
  ],
  renter: [
    "someone living in a home they rent.",
    "the upstairs tenant cannot change the locks or rely on the building office after hours.",
  ],
  landlord: [
    "the person renting the property to someone else.",
    "the owner needs an agreed way to let a locked-out tenant back in.",
  ],
  student: [
    "a reader juggling classes and shared spaces.",
    "a set of keys left in a campus library can mean missing a class.",
  ],
  homeowner: [
    "someone responsible for access to their own home.",
    "the owner leaves a spare with the neighbor who waters the plants.",
  ],
  housemate: [
    "someone who shares the home and its access arrangements.",
    "both housemates are away when the spare is needed.",
  ],
  neighbor: [
    "a person living nearby who may be able to help quickly.",
    "the woman next door can meet the finder at the station.",
  ],
  commuter: [
    "someone regularly traveling between home and work.",
    "the keys turn up after the last train leaves.",
  ],
  traveler: [
    "someone away from their usual routes and local support.",
    "a traveler sees a finder’s message on the way to the airport.",
  ],
  parent: [
    "someone whose lost keys can disrupt a child’s routine too.",
    "a parent needs the keys back in time for school pickup.",
  ],
  cyclist: [
    "someone whose keys may also secure their ride home.",
    "the rider is standing beside a locked bicycle when a message arrives.",
  ],
  "a lockout": [
    "the key works, but its owner cannot get to it.",
    "the door clicks shut with both keys still in the kitchen.",
  ],
  "a lost key ring": [
    "everything carried on one ring goes missing together.",
    "both copies are on the ring left on the train.",
  ],
  "a broken key": [
    "damage makes the regular key unusable.",
    "the key bends in a bike crash and will no longer turn.",
  ],
  "an emergency while away": [
    "someone else needs access before the owner can get home.",
    "a neighbor needs to turn off a leaking tap.",
  ],
  "move a copy off-site": [
    "keep one usable copy in a different physical location.",
    "the drive at a friend’s house survives the theft of the laptop bag.",
  ],
  "test a recovery": [
    "check that the backup can actually restore what was lost.",
    "restore yesterday’s draft to a second computer and open it.",
  ],
  "look for shared risks": [
    "identify an event that could disable the original and its backup together.",
    "a single stolen bag takes both the laptop and the drive.",
  ],
  "give someone else access": [
    "designate another person who can retrieve the backup.",
    "a housemate can fetch the spare when its owner is away.",
  ],
  "losing the keys for good": [
    "lead with the fear that nobody can reunite the ring with its owner.",
    "a passerby finds the keys on a bench with no clue whom to contact.",
  ],
  "exposing a home address": [
    "lead with the privacy cost of labeling a key ring.",
    "the finder can send a note without seeing which door the key opens.",
  ],
  "paying for new locks": [
    "lead with the replacement expense.",
    "the finder’s message arrives just as the owner calls a locksmith.",
  ],
  "being stranded outside": [
    "lead with the immediate experience of being locked out.",
    "the owner is on the doorstep with groceries and an empty pocket.",
  ],
  "hearing from the finder": [
    "promise the first sign that the keys have turned up.",
    "a message says “found your keys by the south exit.”",
  ],
  "getting home on time": [
    "make avoiding a delay the payoff.",
    "the owner collects the ring before the last train.",
  ],
  "canceling the locksmith": [
    "make an avoided replacement the payoff.",
    "a second call cancels the lock change before the van leaves.",
  ],
  "holding your keys again": [
    "end with the physical relief of recovery.",
    "the station clerk slides the familiar ring across the desk.",
  ],
});
export function helpFor(label: string): Help {
  const entry = reference.get(label);
  if (entry) return entry;
  throw new Error(`missing writing reference for “${label}”`);
}
