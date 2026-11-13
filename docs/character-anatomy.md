# Anatomy of a character

How character-forge builds a character: what shapes them, the path that made them who they are, how the story changes them, and how the audience gets to know them.

The running example is **Marta Vell** ([examples/marta-vell.json](../examples/marta-vell.json)), a storm-reader who heard the flood coming and sold her silence.

---

## 1. The core: one causal chain

A strong character is one system, not a list of traits. They are born with a **DNA** (a temperament of six scales and an innate body) that never changes, and everything else grows from a single **wound** that lands on it. The same wound turns inward in a withdrawn, sensitive child and into bravado in an outgoing, thick-skinned one.

```mermaid
flowchart TD
    DNA["🧬 DNA<br/>born temperament & body<br/>never changes"] -->|"the wound lands on it"| W["🩸 WOUND<br/>the formative hurt<br/>one of the life events"]
    W --> L["🗯 LIE<br/>false belief the wound taught"]
    L --> F["😨 FEAR<br/>what the lie makes them dread"]
    F --> D["🛡 DEFENSE<br/>= WORST trait<br/>how they protect the lie"]
    W --> G["✨ GIFT<br/>= BEST trait<br/>what the same wound forged"]
    D <-.->|"two faces of one wound,<br/>on this temperament<br/>= CENTRAL PARADOX"| G

    L --> WANT["🎯 WANT<br/>external goal, feeds the lie"]
    T["💡 TRUTH<br/>= NEED, never changes"] -.->|"opposes"| L
    WANT --> C{"⚖ CLIMAX<br/>lie or truth?"}
    T --> C
    C -->|"chooses truth"| TR["🦋 TRANSFORMATION"]
    C -->|"clings to the lie"| TRAG["⚰ TRAGEDY"]

    classDef core fill:#3B4A57,color:#fff,stroke:#3B4A57
    classDef good fill:#7FB7A4,color:#1c1917,stroke:#7FB7A4
    classDef bad fill:#A2532D,color:#fff,stroke:#A2532D
    class DNA,W,L core
    class G,T,TR good
    class F,D,TRAG bad
```

| Link | Marta Vell |
|---|---|
| Wound | Her father dismissed her forecasts. At 26 she heard the flood coming three days out and sold her silence |
| Lie | "I am only worth what my gift is worth to someone, and I've already proved what I'm worth" |
| Fear | Being exposed; being loved for herself *(unconscious)* |
| Defense → worst trait | Self-destructive: she carries a safety line and never clips on |
| Gift → best trait | Survivor: no one alive reads a storm better |
| Central paradox | The best storm-reader alive is the reason a town drowned unwarned |
| Want | Get the drowned town's bell back from the man who bought her silence |
| Need = truth | "I am worth saving even when I have nothing left to give" |
| Climax | Chalk CALM (call a girl's true forecast a lie, as her father did to her) and get the bell, or chalk WAVE, sign it and confess |

---|---|
| Wound | Loved by her father only when useful; then she sold that usefulness, and her silenced horn drowned the town |
| Lie | "I am only worth what I can do — and I've already done the unforgivable" |
| Fear | Being caught for what she did; being loved for herself *(unconscious)* |
| Defense → worst trait | Self-destructive: she takes reef runs without a safety line |
| Gift → best trait | Survivor: no one reads a storm better |
| Central paradox | The survivor who wants to drown |
| Want | Buy back the town's bell |
| Need = truth | "I am worth saving even when I have nothing left to give" |
| Climax | Ring the bell to save the man who bought her silence? |

---

## 2. What shapes them

Outside forces press on the core. Each one should either feed the wound or put pressure on the lie. Anything that does neither is decoration.

```mermaid
flowchart LR
    subgraph WORLD["🌍 World"]
        direction TB
        W1["who rules · who decides"]
        W2["boundaries — what lies beyond"]
        W3["hierarchy · good & bad"]
        W4["worth living / dying for"]
        W5["survival vs comfort"]
    end
    subgraph ROOTS["🏠 Roots"]
        direction TB
        R1["childhood family climate"]
        R2["cultural background"]
        R3["sociology: status, money,<br/>education, place"]
        R4["world events"]
    end
    subgraph LIFE["📅 Life"]
        direction TB
        L1["3 formative events"]
        L2["biggest disappointment"]
        L3["biography"]
    end
    subgraph PEOPLE["👥 People"]
        direction TB
        P1["mentor / parent"]
        P2["ally who sees through the mask"]
        P3["antagonist who exploits the lie"]
    end

    ROOTS --> CORE(("CORE<br/>wound · lie · truth"))
    LIFE --> CORE
    WORLD --> CORE
    PEOPLE -->|"contradictions:<br/>reveal other sides"| CORE
    CORE --> OUT["what we see:<br/>traits · quirks · speech ·<br/>look · decisions"]
```

---

## 3. The path that made them who they are

From birth to the first page of the story. The **biography** tells this path as prose; the card breaks it into its parts.

```mermaid
flowchart LR
    B["👶 Birth<br/>& family climate"] --> CH["🧒 Childhood<br/>how love was given"]
    CH --> E1["① first formative event<br/>plants the wound"]
    E1 --> E2["② second event<br/>deepens it"]
    E2 --> E3["③ third event<br/>seals the lie"]
    E3 --> M["🎭 The mask<br/>defense becomes personality"]
    M --> OW["🏚 Ordinary world<br/>day one of the story"]

    style E1 fill:#A2532D,color:#fff
    style E2 fill:#A2532D,color:#fff
    style E3 fill:#A2532D,color:#fff
    style OW fill:#3B4A57,color:#fff
```

Marta's path:
- Raised as her father's apprentice rather than his daughter.
- **At 9:** blamed for a storm she predicted.
- **At 26:** hears the flood coming, signs Hale's receipt and tells her father "no storm". The town drowns, and the horn she sounds too late deafens her.
- **At 30:** walks into the sea, and a raft girl, Pell, drags her back.
- Today: she scrapes hulls for food and chalks the forecast free every dawn.

---

## 4. The path the story takes them on

The destiny arc. In the ordinary world there is a **void** that nothing there can fill. They have to cross the boundary of their world to fill it.

```mermaid
flowchart LR
    A["🏚 Ordinary world"] --> V["🕳 The void<br/>nothing here fills it"]
    V --> S["🔍 Searches at home<br/>and fails"]
    S --> TH["🚪 Threshold<br/>crosses the world's boundary"]
    TH --> O["🌊 Ordeal<br/>the lie is tested"]
    O --> CL{"⚖ Climax<br/>want vs need"}
    CL --> TF["🦋 Transformation<br/>lie → truth"]
    TF --> R["🏠 Returns changed<br/>master of two worlds"]
```

Along the way the character moves through three psychological states:

```mermaid
stateDiagram-v2
    direction LR
    Passive: 😶 PASSIVE<br/>no goal, numb routine
    Reactive: 😬 REACTIVE<br/>has a goal, needs a push
    Active: 🔥 ACTIVE<br/>fully committed
    [*] --> Passive
    Passive --> Reactive: inciting event
    Reactive --> Active: point of no return
    Active --> Reactive: setback
    Active --> [*]: climax
```

Fear works against this movement. The more they fear, the less they act. Courage is acting in spite of fear. The story has to show what pushes them through.

```mermaid
flowchart LR
    FEAR["😨 Fear<br/>from the biggest disappointment"] -->|"freezes"| MASK["🎭 Mask<br/>looks fearless"]
    MASK --> BOTTOM["⬇ Pressure / rock bottom"]
    BOTTOM --> SRC["❤ Source of courage<br/>a person, a cause"]
    SRC --> ACT["⚡ Acts while afraid"]
    ACT --> FREE["🕊 The feared thing<br/>loses its power"]
```

---

## 5. How the audience gets to know them

Character is never stated. It is revealed.

```mermaid
mindmap
  root((Character<br/>revealed))
    Choices & actions
      first appearance
      decisions under pressure
      scene goals
    Reactions
      to thanks, insults, danger
      the strongest trigger
    Own words
      speech manner
      pet words
      inner monologue
    Others' words
      what secondary characters say
      how they treat the hero
    Look
      silhouette
      palette
      marks & scars
      non-verbal tics
    Audience bond
      sympathy hook
      jeopardy
      flaws & superpower
      humor, love, calling
```

---

## 6. The card at a glance

How the card's sections relate to each other. The core feeds everything else.

```mermaid
flowchart TB
    CORE["00 · CORE<br/>DNA · wound · self-story · lie · truth · paradox · dramatic question"]
    CORE --> G["01 · Goals<br/>want / need / climax"]
    CORE --> P["03 · Psychology<br/>states · inner voice · triggers"]
    CORE --> FE["05 · Fears<br/>fears · mask · courage"]
    CORE --> TRT["08 · Traits<br/>1 best · 1 worst · 3 other"]
    CORE --> BK["07 · Backstory & world<br/>biography · world · contradictions"]
    BK --> DSC["04 · Description<br/>name · look · events · speech · sociology"]
    TRT --> U["06 · Universal & unique<br/>archetype + twist · quirks · lifestyle"]
    P --> ID["02 · Identification<br/>why we bond · flaws · first appearance"]
    G --> DST["09 · Destiny<br/>void → threshold → transformation"]
    DSC --> VIS["🎨 Look<br/>shape · silhouette · signature item ·<br/>marks · movement · outfit · palette"]
    U --> VIS
    BK --> VIS
    VIS --> TP["🧍 A-pose concept"]
    VIS -.->|"on request"| MP["🎬 Prompts<br/>illustration · voice · video · song"]
```

---

## 7. The look grows out of the story

The designer gets the finished story and derives the look from it. Every element has to answer the question "which part of the story does this show?" Anything that can't answer is cut.

```mermaid
flowchart LR
    CORE["Core<br/>wound · lie · truth"] --> SH["Shape language<br/>Marta: one tall vertical,<br/>always leaning to her hearing side"]
    BIO["Biography & events"] --> MK["Marks with origins<br/>scar behind the deaf ear,<br/>chalk-cut knuckles"]
    BIO --> IT["Signature item<br/>father's cracked barometer"]
    PSY["Psychology & traits"] --> MV["Movement<br/>finger to the wind ·<br/>morse NO STORM under stress"]
    SOC["Sociology & world"] --> OF["Outfit with reasons<br/>gansey worn inside out ·<br/>cartel stencil on her back"]
    DEF["Defense vs gift"] --> PF["Perfection<br/>tools immaculate,<br/>herself neglected"]
    SH & MK & IT & MV & OF & PF --> READ["3 seconds, no words:<br/>she listens for a storm ·<br/>she gave away more than she has ·<br/>someone owns her"]
```

Rules of restraint:
- 1–2 strong symbols carry the look; don't repeat a motif across many fields.
- Leave one detail that raises a question instead of answering it. Marta's jersey is inside out, and only the ending reveals why.

---

## 8. How character-forge produces one

The variant tournament: three versions of the same concept compete, and only the strongest ships.

```mermaid
flowchart TB
    REQ["🗣 Request<br/>random or brief · e.g. 'a fisherman'"] --> ROLL["🎲 Roll 3 variants<br/>same role & world<br/>different wound · archetype · age"]
    ROLL --> A["Variant A"] & B["Variant B"] & C["Variant C"]
    A & B & C --> COH["🔗 Coherence reviewers<br/>does everything trace to the core?"]
    COH --> FIX1["✏ Author fixes broken links"]
    FIX1 --> CRIT["⚔ Critics<br/>prove it should NOT ship"]
    CRIT --> DEF["🛡 Author defends or fixes<br/>one round"]
    DEF --> JUDGE["⚖ Judge<br/>rubric · exactly one winner"]
    JUDGE --> DES["🎨 Designer<br/>look from the story"]
    DES --> WIN["🏆 Winner<br/>card + look + A-pose concept"]
    JUDGE --> LOSE["📁 Runners-up<br/>kept with verdict"]
```

Judge's rubric, out of 100:

| Criterion | Points |
|---|---|
| Coherence: everything traces back to the core | 20 |
| Conflict: want vs need forces an impossible choice | 20 |
| Specificity: concrete, filmable, not swappable into another story | 15 |
| Playability: generates scenes, the character is active | 15 |
| Fit: matches the brief, role and medium | 10 |
| Visual: readable silhouette that tells the story | 10 |
| Voice: recognisable with the name removed | 10 |
