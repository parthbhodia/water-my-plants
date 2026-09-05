// Real botany, told the way Granny would tell it. Every species in the garden
// is modelled on a plant that behaves this way for an actual reason, and the
// care contract makes far more sense once you know the reason — so the card
// that explains the rule also explains the plant.

export type PlantFact = {
  /** Why the care contract is what it is. Shown under the rules. */
  why: string;
  /** A small delight. Shown last, always true. */
  didYouKnow: string;
  /** What happens if you water it when it is not asking. */
  tooMuch: string;
};

export const PLANT_FACTS: Record<string, PlantFact> = {
  // ---- seasonal ----
  blossom: {
    why: "She spends the whole year building buds and then spends them all in a week. Prune her once while she is bare — cut into blossom wood and you have thrown the season away.",
    didYouKnow: "Cherry blossom opens on accumulated warmth, not on a date: the tree counts the hours above about 5°C since winter. That is why a mild February brings the whole country forward at once.",
    tooMuch: "She is a tree, not a pot plant. Give her time to drink what she has.",
  },
  lavender: {
    why: "She is a Mediterranean hillside plant — thin, stony, dry soil. Every three days is generous, and wet feet rot her faster than any drought.",
    didYouKnow: "The scent is a defence. Those oils deter grazing animals and slow fungus, which is exactly why they also keep moths out of a wardrobe.",
    tooMuch: "Root rot. She would rather be forgotten than fussed over — wait until she asks.",
  },
  pumpkin: {
    why: "She is building something enormous out of nothing but water and light, so she wants a drink every day and three good feeds. Skip either and the fruit stalls where it is.",
    didYouKnow: "A pumpkin can put on 20kg in a single week at its peak, and the whole fruit is filled by a single vine — the record holders are hand-fed like prize animals.",
    tooMuch: "Not the worst thing, but split skins come from a sudden soaking after a dry spell. Steady beats generous.",
  },
  snowdrop: {
    why: "She flowers in the cold on purpose, while nothing is competing for the light or the bees. Shade suits her; she has finished before the trees come into leaf.",
    didYouKnow: "Snowdrops make their own heat — the plant can be several degrees warmer than the air, which is how a green shoot pushes up through frozen ground.",
    tooMuch: "Cold, wet ground and a bulb do not mix. Let her be.",
  },

  lily: {
    // "She is never really thirsty" was a shrug, not an answer — and it left
    // the daily visit looking pointless while the button still said Water.
    // You are not watering the lily. You are topping up the pond she floats
    // in, which is a real job with a real deadline.
    why: "You are not watering her — you are topping up the pond. A pond loses an inch a week to the summer sun, and her stem is cut to one depth: let the level fall and the pad strands on the mud and cooks.",
    didYouKnow: "A lily pad's waxy top sheds rain so beads roll clean off, and its breathing pores sit on TOP of the leaf instead of underneath — the only side that ever meets the air.",
    tooMuch: "Nothing dreadful — a pond takes what you give it. But the level is already up, so save your arms for tomorrow.",
  },
  sunflower: {
    why: "She drinks like a horse but only while the sun is up, because that is when she is actually moving water through those big leaves.",
    didYouKnow: "Young sunflowers really do track the sun across the sky — it is called heliotropism, and they turn back east overnight to be ready for the morning.",
    tooMuch: "She will cope, but water sitting in the dark does her no good at all.",
  },
  fern: {
    why: "Ferns evolved under a forest canopy, so full sun scorches them. Damp shade, every other day — that is the whole trick.",
    didYouKnow: "Ferns are older than flowers by about 200 million years. They never bothered with seeds — they spread by spores from the little brown dots under their fronds.",
    tooMuch: "Soggy roots and a sulk. She likes damp, not drowned.",
  },
  cactus: {
    why: "He stores his own water in that thick body, so he is full for days after a drink. Watering early does not top him up — it drowns roots that are built for drought.",
    didYouKnow: "Cactus spines are leaves. Shrinking them to needles cut water loss to almost nothing, and the shade they cast keeps the stem cooler too.",
    tooMuch: "Root rot — the one thing in this garden that punishes kindness. Wait until he asks.",
  },
  moonflower: {
    why: "She keeps her flowers shut all day and opens them after dusk, so daytime water simply runs off a closed-up plant.",
    didYouKnow: "Moonflowers open in minutes — fast enough to watch — and glow pale in low light to catch night-flying moths, who pollinate them instead of bees.",
    tooMuch: "Wasted. Come back when the light goes.",
  },
  tomato: {
    why: "Fruit costs a plant a great deal, so she needs feeding as well as watering — three good meals before she can ripen anything.",
    didYouKnow: "Tomatoes are berries, botanically. And that green tomato smell on your fingers comes from the leaves, not the fruit — it is the plant's own insect repellent.",
    tooMuch: "Split skins. Sudden floods after a dry spell crack the fruit right open.",
  },
  orchid: {
    why: "Ghost orchids are fussy for real reasons: deep shade, steady damp, and a long slow feed. Rushing her does nothing.",
    didYouKnow: "The ghost orchid has no leaves at all. Its roots do the photosynthesis, and it cannot survive without a particular fungus living inside them.",
    tooMuch: "She rots quietly and you will not notice until it is done. Patience is the whole plant.",
  },
  bonsai: {
    why: "A bonsai is a full-sized tree kept small on purpose, which means small everything — small pot, small root run, small drinks.",
    didYouKnow: "Bonsai is not a species, it is a practice. Some living bonsai are over 800 years old and have been handed between gardeners for thirty generations.",
    tooMuch: "A small pot cannot drain a big drink. Keep it modest.",
  },
};
