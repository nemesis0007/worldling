export type MissionToolName = "set_waypoint" | "remember_fact" | "give_item" | "complete_step";

export type AgentAction = {
  tool: MissionToolName;
  value: string;
  reason?: string;
};

export type MissionStep = {
  id: string;
  npcIndex: number;
  title: string;
  instruction: string;
  handoff: string;
  reward: string;
};

export type CityMission = {
  id: string;
  title: string;
  summary: string;
  finale: string;
  steps: [MissionStep, MissionStep, MissionStep];
};

export const FLAGSHIP_MISSIONS: Record<string, CityMission> = {
  "new-york": {
    id: "nyc-local-plan",
    title: "A New York minute",
    summary: "Turn one local recommendation into a complete afternoon plan across Midtown.",
    finale: "You built a real Midtown plan and handled food, transit, and a local follow-up.",
    steps: [
      {
        id: "deli-order",
        npcIndex: 0,
        title: "Stop at the cafe",
        instruction: "Ask Maya for a coffee and a classic New York bite, then confirm the order.",
        handoff: "Maya's Midtown cafe recommendation",
        reward: "New York cafe stamp",
      },
      {
        id: "subway-route",
        npcIndex: 1,
        title: "Get the route",
        instruction: "Tell Theo where Maya sent you and confirm the subway line or walking route.",
        handoff: "Theo's route to Bryant Park",
        reward: "Metro route",
      },
      {
        id: "park-plan",
        npcIndex: 2,
        title: "Finish the plan",
        instruction: "Use Theo's route with Jordan, then ask what New Yorkers do here after work.",
        handoff: "Jordan's after-work tip",
        reward: "NYC local badge",
      },
    ],
  },
  madrid: {
    id: "madrid-cafe-hop",
    title: "Cafe, cab, and El Rastro",
    summary: "Order at a Madrid cafe, handle a taxi question, and finish at the market.",
    finale: "You crossed Madrid using practical Spanish for coffee, transport, and shopping.",
    steps: [
      {
        id: "madrid-cafe",
        npcIndex: 0,
        title: "Order at the cafe",
        instruction: "Greet Lucia, order a coffee and something small, then confirm the price in Spanish.",
        handoff: "Lucia's cafe recommendation",
        reward: "Madrid cafe stamp",
      },
      {
        id: "madrid-taxi",
        npcIndex: 1,
        title: "Confirm the ride",
        instruction: "Tell Mateo you are going to El Rastro and ask how long the taxi ride takes.",
        handoff: "Mateo's El Rastro route",
        reward: "Madrid taxi receipt",
      },
      {
        id: "madrid-market",
        npcIndex: 2,
        title: "Browse like a local",
        instruction: "Ask Sofia about one local item, understand the price, and respond naturally.",
        handoff: "Sofia's market tip",
        reward: "Madrid local badge",
      },
    ],
  },
  paris: {
    id: "paris-sunset-gift",
    title: "A gift before sunset",
    summary: "Order at the cafe, follow a bookseller's directions, and buy a small market gift.",
    finale: "You completed a Paris errand using polite French across three connected encounters.",
    steps: [
      {
        id: "cafe-clue",
        npcIndex: 0,
        title: "Start at the cafe",
        instruction: "Order from Camille politely and ask where to find a thoughtful local gift.",
        handoff: "Camille's gift suggestion",
        reward: "Cafe receipt",
      },
      {
        id: "bookseller-directions",
        npcIndex: 1,
        title: "Follow the Seine",
        instruction: "Mention Camille to Luc and ask for clear directions to the street market.",
        handoff: "Luc's market directions",
        reward: "Marked bookstall map",
      },
      {
        id: "market-purchase",
        npcIndex: 2,
        title: "Choose the gift",
        instruction: "Ask Amelie the price, choose an item, and confirm how you would like to pay.",
        handoff: "Amelie's market recommendation",
        reward: "Paris keepsake",
      },
    ],
  },
  mumbai: {
    id: "mumbai-market-run",
    title: "The monsoon market run",
    summary: "Get a local food tip, navigate the train, and finish an everyday Dadar market errand.",
    finale: "You crossed Mumbai through food, transport, and shopping conversations in Marathi.",
    steps: [
      {
        id: "irani-cafe",
        npcIndex: 0,
        title: "Fuel up first",
        instruction: "Ask Ira for a cafe recommendation and what to order before heading to Dadar.",
        handoff: "Ira's cafe recommendation",
        reward: "Irani cafe token",
      },
      {
        id: "local-train",
        npcIndex: 1,
        title: "Navigate the local",
        instruction: "Tell Rohan you are going to Dadar and confirm the platform and stop.",
        handoff: "Rohan's Dadar route",
        reward: "Local train pass",
      },
      {
        id: "dadar-market",
        npcIndex: 2,
        title: "Complete the errand",
        instruction: "Ask Sahil for an item, understand the price, and respond naturally.",
        handoff: "Sahil's market tip",
        reward: "Mumbai local badge",
      },
    ],
  },
};

export function genericMission(cityId: string, cityName: string, goals: string[]): CityMission {
  return {
    id: `${cityId}-street-intro`,
    title: `${cityName} street run`,
    summary: "Meet three locals and complete one useful exchange with each of them.",
    finale: `You completed the ${cityName} street run.`,
    steps: goals.slice(0, 3).map((goal, index) => ({
      id: `street-${index + 1}`,
      npcIndex: index,
      title: [`Meet a local`, `Handle the details`, `Ask like a regular`][index],
      instruction: goal,
      handoff: `Conversation ${index + 1} insight`,
      reward: [`Local introduction`, `Useful direction`, `${cityName} badge`][index],
    })) as CityMission["steps"],
  };
}
